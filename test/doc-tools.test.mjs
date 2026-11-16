// 內建文件工具（docs__*）：列出、檢索、分段讀取、新增／修改／附加、專案名稱解析、開關、聊天注入，
// 以及前端（jsdom）：唯讀工具免確認、docs__save 顯示確認卡、允許後刷新文件快取。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { DOC_TOOLS, callDocTool, docToolsEnabled, resolveAllTools, resolveDocTools } from '../src/doc_tools.js'
import { createEntity, getEntity, putSettings } from '../src/repo/entities.js'
import { handleChat, toolRules } from '../src/chat.js'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(40) }
  throw new Error('timeout waiting for condition')
}

async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm } })
  await pg.exec(read('db/migrations/0001_init.sql'))
  await pg.exec(read('db/migrations/0003_model_kinds.sql'))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
}

const call = (db, name, args) => callDocTool(db, {}, { name, arguments: typeof args === 'string' ? args : JSON.stringify(args || {}) })
const parse = (r) => JSON.parse(r.content)

test('doc tools: list / search / read in parts', async () => {
  const db = await makeDb()
  await createEntity(db, 'projects', { id: 'p1', name: '京都旅行' })
  await createEntity(db, 'projects', { id: 'p2', name: '工作' })
  await createEntity(db, 'documents', { id: 'd1', title: '京都行程', content: '第一天去嵐山看竹林，晚上吃湯豆腐。', project_id: 'p1' })
  await createEntity(db, 'documents', { id: 'd2', title: '會議記錄', content: '週會討論季度目標。', project_id: 'p2' })
  const long = 'A'.repeat(1000) + 'B'.repeat(500)
  await createEntity(db, 'documents', { id: 'd3', title: '長文', content: long })

  // list：全部、依專案名稱、標題關鍵字；附專案清單
  let r = parse(await call(db, 'docs__list', {}))
  assert.equal(r.count, 3)
  assert.deepEqual(r.projects.map((p) => p.name).sort(), ['京都旅行', '工作'].sort())
  const kyoto = r.documents.find((d) => d.id === 'd1')
  assert.equal(kyoto.project, '京都旅行')
  assert.equal(kyoto.chars, '第一天去嵐山看竹林，晚上吃湯豆腐。'.length)
  assert.equal(kyoto.type, 'note')
  r = parse(await call(db, 'docs__list', { project_id: '京都旅行' }))
  assert.deepEqual(r.documents.map((d) => d.id), ['d1'])
  r = parse(await call(db, 'docs__list', { query: '會議' }))
  assert.deepEqual(r.documents.map((d) => d.id), ['d2'])
  r = parse(await call(db, 'docs__list', { limit: 1 }))
  assert.equal(r.documents.length, 1)
  const missing = await call(db, 'docs__list', { project_id: '不存在' })
  assert.equal(missing.is_error, true)
  assert.match(missing.content, /找不到專案[\s\S]*京都旅行/)

  // search：回片段與 document_id
  const s = await call(db, 'docs__search', { query: '嵐山竹林' })
  assert.equal(s.is_error, false)
  assert.equal(parse(s).results[0].document_id, 'd1')
  assert.match(parse(s).results[0].snippet, /嵐山/)
  assert.equal(parse(await call(db, 'docs__search', { query: '季度目標', project_id: 'p1' })).count, 0)
  assert.equal((await call(db, 'docs__search', {})).is_error, true)

  // read：分段
  let part = parse(await call(db, 'docs__read', { id: 'd3', max_chars: 1000 }))
  assert.equal(part.total_length, 1500)
  assert.equal(part.returned, 1000)
  assert.equal(part.next_offset, 1000)
  assert.equal(part.content, 'A'.repeat(1000))
  part = parse(await call(db, 'docs__read', { id: 'd3', offset: part.next_offset, max_chars: 1000 }))
  assert.equal(part.content, 'B'.repeat(500))
  assert.equal(part.next_offset, null)
  const whole = await call(db, 'docs__read', { id: 'd1' })
  assert.equal(parse(whole).project, '京都旅行')
  assert.match(whole.summary, /已讀取文件：京都行程/)
  assert.equal((await call(db, 'docs__read', { id: 'nope' })).is_error, true)
  await assert.rejects(call(db, 'docs__read', '{bad json'))
  await assert.rejects(callDocTool(db, {}, { name: 'docs__unknown', arguments: {} }))
})

test('doc tools: save create / replace / append, project name resolution', async () => {
  const db = await makeDb()
  await createEntity(db, 'projects', { id: 'p1', name: '京都旅行' })

  // 新增：專案名稱 → id；doc_type note；回傳 item 給前端
  let r = await call(db, 'docs__save', { title: '購物清單', content: '抹茶', project_id: '京都旅行' })
  assert.equal(r.is_error, false)
  const out = parse(r)
  assert.equal(out.action, 'created')
  assert.equal(out.project, '京都旅行')
  assert.equal(out.chars, 2)
  assert.match(r.summary, /已新增文件：購物清單/)
  const id = out.id
  let doc = await getEntity(db, 'documents', id)
  assert.equal(doc.doc_type, 'note')
  assert.equal(doc.project_id, 'p1')
  assert.equal(r.item.id, id)
  assert.equal(r.item.content, '抹茶')
  // 新增後立即可被檢索（doc_chunks 已重切）
  assert.equal(parse(await call(db, 'docs__search', { query: '抹茶' })).results[0].document_id, id)

  // 附加
  r = await call(db, 'docs__save', { id, content: '八橋', mode: 'append' })
  assert.equal(parse(r).action, 'appended')
  doc = await getEntity(db, 'documents', id)
  assert.equal(doc.content, '抹茶\n\n八橋')
  assert.equal(doc.title, '購物清單')
  assert.equal(doc.project_id, 'p1')

  // 取代＋改標題＋移出專案（空字串）
  r = await call(db, 'docs__save', { id, title: '清單', content: '只剩抹茶', project_id: '' })
  assert.equal(parse(r).action, 'updated')
  doc = await getEntity(db, 'documents', id)
  assert.equal(doc.content, '只剩抹茶')
  assert.equal(doc.title, '清單')
  assert.equal(doc.project_id, null)
  assert.equal(parse(await call(db, 'docs__search', { query: '八橋' })).count, 0)

  // 錯誤：專案找不到（列出現有專案、不寫入）、新增缺標題、id 不存在、檔案抽出的文件
  const before = (await db.query('SELECT count(*)::int n FROM documents'))[0].n
  r = await call(db, 'docs__save', { title: '新', content: 'x', project_id: '大阪' })
  assert.equal(r.is_error, true)
  assert.match(r.content, /找不到專案「大阪」[\s\S]*京都旅行（p1）/)
  assert.equal((await call(db, 'docs__save', { content: 'x' })).is_error, true)
  assert.equal((await call(db, 'docs__save', { id: 'nope', content: 'x' })).is_error, true)
  assert.equal((await db.query('SELECT count(*)::int n FROM documents'))[0].n, before)
  await db.query(`INSERT INTO files (id, owner_id, filename, mime, size_bytes, storage_key, status) VALUES ('f1', 'owner', 'a.pdf', 'application/pdf', 1, 'k1', 'extracted')`)
  await createEntity(db, 'documents', { id: 'fd', title: 'PDF', content: '抽出文字', doc_type: 'file', file_id: 'f1' })
  r = await call(db, 'docs__save', { id: 'fd', content: 'x' })
  assert.equal(r.is_error, true)
  assert.match(r.content, /上傳檔案抽出/)
  assert.equal((await getEntity(db, 'documents', 'fd')).content, '抽出文字')
})

test('doc tools: settings switch and chat injection', async () => {
  const db = await makeDb()
  assert.equal(docToolsEnabled({}), true)
  assert.equal(docToolsEnabled({ 'tools.docs': false }), false)
  assert.equal(docToolsEnabled({ 'tools.docs': 'false' }), false)
  assert.equal(docToolsEnabled({ 'tools.docs': true }), true)
  assert.deepEqual((await resolveDocTools(db)).map((t) => t.function.name), ['docs__list', 'docs__search', 'docs__read', 'docs__save', 'docs__edit', 'docs__create_folder', 'docs__delete'])
  const mcp = async () => [{ type: 'function', function: { name: 'mcpab__x', description: '', parameters: { type: 'object', properties: {} } } }]
  assert.equal((await resolveAllTools(db, mcp)).length, 8)
  // MCP 失敗不影響文件工具
  assert.equal((await resolveAllTools(db, async () => { throw new Error('down') })).length, 7)

  await putSettings(db, { 'tools.docs': false })
  assert.equal((await resolveDocTools(db)).length, 0)
  assert.deepEqual((await resolveAllTools(db, mcp)).map((t) => t.function.name), ['mcpab__x'])
  await assert.rejects(call(db, 'docs__list', {}), /已在設定中關閉/)
  await putSettings(db, { 'tools.docs': null })

  // 系統提示規則
  assert.match(toolRules(['docs__list', 'docs__save']), /只有工具回傳成功/)
  assert.match(toolRules([]), /無法自行儲存/)
  assert.match(toolRules(['mcpab__x']), /無法自行儲存/)

  const orig = globalThis.fetch
  const sent = []
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body))
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  }
  const chat = async (body) => handleChat(
    new Request('https://app.example/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    {}, {
      resolveProvider: async () => ({ baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'm' }),
      resolveTools: () => resolveAllTools(db, async () => []),
    })
  try {
    let res = await chat({ prompt: '幫我記下', __toolNames: ['docs__save'] })
    assert.equal(res.headers.get('X-Tool-Count'), '7')
    assert.equal(sent[0].tool_choice, 'auto')
    assert.ok(sent[0].tools.some((t) => t.function.name === 'docs__save'))
    assert.match(sent[0].messages[0].content, /只有工具回傳成功/)
    assert.equal(sent[0].messages.filter((m) => m.role === 'system').length, 1)

    res = await chat({ prompt: '幫我記下', use_tools: false, __toolNames: ['docs__save'] })
    assert.equal(res.headers.get('X-Tool-Count'), '0')
    assert.equal(sent[1].tools, undefined)
    assert.match(sent[1].messages[0].content, /無法自行儲存/)

    await putSettings(db, { 'tools.docs': false })
    res = await chat({ prompt: '幫我記下' })
    assert.equal(res.headers.get('X-Tool-Count'), '0')
    assert.equal(sent[2].tools, undefined)
    assert.match(sent[2].messages[0].content, /無法自行儲存/)
  } finally { globalThis.fetch = orig }
})

test('doc tools: /api/tools/call routes docs__ and MCP names', async () => {
  const db = await makeDb()
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', __db: db }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const post = (url, body) => app.fetch(new Request('https://example.com' + url, {
    method: 'POST', headers: { cookie, origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), env)
  let res = await post('/api/tools/call', { name: 'docs__save', arguments: '{"title":"T","content":"內容"}' })
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.equal(j.result.server, '文件')
  assert.equal(j.result.tool, 'save')
  assert.equal(j.result.item.title, 'T')
  res = await post('/api/tools/call', { name: 'mcpdeadbeef__x', arguments: '{}' })
  assert.equal(res.status, 404)
})

test('frontend: read-only doc tools run without a card, docs__save asks first and refreshes documents', async () => {
  const db = await makeDb()
  await createEntity(db, 'documents', { id: 'd1', title: '寵物筆記', content: '家裡的貓叫小花。' })
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'), __db: db }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const serverCall = async (url, init = {}) => {
    const headers = new Headers(init.headers || {})
    headers.set('cookie', cookie)
    if (init.method && init.method !== 'GET') headers.set('origin', 'https://example.com')
    return app.fetch(new Request(new URL(url, 'https://example.com/'), { method: init.method || 'GET', headers, body: init.body }), env)
  }
  const prov = await (await serverCall('/api/providers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '自建', base_url: 'https://llm.example.com/v1', models: ['m1'] }) })).json()
  const pid = prov.provider.id

  // 上游模型：第 1 回合呼叫 docs__search，第 2 回合呼叫 docs__save，第 3 回合回答
  const upstream = []
  const toolCall = (id, name, args) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    upstream.push(body)
    if (body.stream === false) return Response.json({ choices: [{ message: { content: '{"memories":[]}' } }] })
    const toolMsgs = (body.messages || []).filter((m) => m.role === 'tool').length
    const sse = toolMsgs === 0 ? toolCall('c1', 'docs__search', { query: '小花' })
      : toolMsgs === 1 ? toolCall('c2', 'docs__save', { title: '貓的名字', content: '貓叫小花，三歲。' })
      : 'data: {"choices":[{"delta":{"content":"已儲存。"}}]}\n\ndata: [DONE]\n\n'
    return new Response(sse, { headers: { 'content-type': 'text/event-stream' } })
  }

  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  try {
    w.fetch = async (input, init = {}) => {
      const res = await serverCall(typeof input === 'string' ? input : input.url, init)
      return new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers })
    }
    Object.assign(w, {
      TextDecoder, TextEncoder, ReadableStream, TA_GEO: {}, scrollTo: () => {}, confirm: () => true,
      matchMedia: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
      marked: { parse: (t) => String(t), setOptions() {}, use() {}, Renderer: function () {} },
    })
    w.HTMLElement.prototype.scrollIntoView = function () {}
    w.HTMLElement.prototype.scrollTo = function () {}
    for (const f of ['i18n/zh-TW.js', 'i18n.js', 'app.js', 'prompts.js']) {
      if (fs.existsSync(path.join(root, 'public/assets', f))) w.eval(read('public/assets/' + f))
    }
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'))
    w.dispatchEvent(new w.Event('load'))
    const $ = (id) => w.document.getElementById(id)
    await waitFor(() => w.document.querySelector(`[data-model="${pid}|m1"]`))

    // 設定頁：文件工具勾選預設開啟
    w.document.querySelector('[data-pane="pane-providers"]').click()
    await waitFor(() => $('doc-tools-toggle') && $('doc-tools-toggle').checked)

    w.document.querySelector(`[data-model="${pid}|m1"]`).click()
    $('prompt-input').value = '把貓的名字存成筆記'
    $('prompt-input').dispatchEvent(new w.Event('input', { bubbles: true }))
    $('send-btn').click()

    // docs__search：不出現確認卡，只有一行小字
    await waitFor(() => [...w.document.querySelectorAll('.doc-tool-line')].some((el) => /已搜尋文件/.test(el.textContent)))
    // docs__save：確認卡，顯示動作、標題、內容預覽；尚未寫入
    const card = await waitFor(() => w.document.querySelector('.mcp-confirm'))
    assert.equal(w.document.querySelectorAll('.mcp-confirm').length, 1)
    assert.match(card.textContent, /要新增文件嗎/)
    assert.match(card.textContent, /貓的名字/)
    assert.match(card.querySelector('.doc-save-preview').textContent, /貓叫小花，三歲/)
    assert.equal((await db.query(`SELECT count(*)::int n FROM documents WHERE title = '貓的名字'`))[0].n, 0)
    card.querySelector('[data-act="allow"]').click()
    await waitFor(async () => (await db.query(`SELECT count(*)::int n FROM documents WHERE title = '貓的名字'`))[0].n === 1)
    await waitFor(() => /已新增文件：貓的名字/.test(card.textContent))
    // 前端文件快取立即更新
    await waitFor(() => JSON.parse(w.localStorage.getItem('ta_documents') || '[]').some((d) => d.title === '貓的名字' && d.content === '貓叫小花，三歲。'))
    await waitFor(() => upstream.filter((b) => b.stream !== false).length === 3)
    const last = upstream.filter((b) => b.stream !== false)[2]
    const toolResults = last.messages.filter((m) => m.role === 'tool').map((m) => m.content)
    assert.match(toolResults[0], /d1/)
    assert.match(toolResults[1], /"action": "created"/)
  } finally {
    await sleep(500) // 讓背景同步／載入在關閉視窗前結束，避免測試結束後的非同步錯誤
    globalThis.fetch = originalFetch
    w.close()
  }
})
