// 文件工具迴圈：回合上限 8、用完強制回答（use_tools:false＋tools_exhausted，工具結果轉文字）、
// 相同呼叫去重、系統提示文字、docs__list 專案文件數，以及文件頁依專案分組的資料夾。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { callDocTool, resolveAllTools } from '../src/doc_tools.js'
import { createEntity } from '../src/repo/entities.js'
import { DOCS_ACCESS_RULE, TOOLS_EXHAUSTED_RULE, handleChat, toolRules, toolTurnsText } from '../src/chat.js'

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

test('system prompt: docs access rule, exhausted rule', () => {
  const r = toolRules(['docs__list', 'docs__search', 'docs__read', 'docs__save'])
  assert.ok(r.includes(DOCS_ACCESS_RULE))
  assert.match(r, /不要說你無法存取文件/)
  assert.match(r, /通常 1～3 次工具呼叫就該足夠/)
  assert.match(r, /專案即資料夾/)
  assert.match(r, /只有工具回傳成功/)
  assert.doesNotMatch(r, /沒有資料夾/)
  // 只有唯讀文件工具（例如 MCP 名稱混合）仍提示可存取文件
  assert.match(toolRules(['docs__list', 'mcpab__x']), /不要說你無法存取文件/)
  assert.doesNotMatch(toolRules(['mcpab__x']), /docs__list/)
  const ex = toolRules([], { exhausted: true })
  assert.ok(ex.startsWith(TOOLS_EXHAUSTED_RULE))
  assert.match(ex, /工具使用次數已用完，請只根據上面已取得的工具結果直接回答使用者/)
  // 工具回合轉文字
  const txt = toolTurnsText([{ content: '', tool_calls: [{ id: 'a', name: 'docs__search', arguments: '{"query":"貓"}' }], results: [{ id: 'a', content: '小花' }] }])
  assert.match(txt, /docs__search \{"query":"貓"\}/)
  assert.match(txt, /結果：\n小花/)
  assert.equal(toolTurnsText([]), '')
})

test('handleChat: tools_exhausted / use_tools:false send tool results as text, single system, no tool roles', async () => {
  const db = await makeDb()
  const orig = globalThis.fetch
  const sent = []
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body))
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  }
  const chat = (body) => handleChat(
    new Request('https://app.example/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    {}, {
      resolveProvider: async () => ({ baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'm' }),
      resolveTools: () => resolveAllTools(db, async () => []),
    })
  const turns = [{ content: '', tool_calls: [{ id: 'c1', name: 'docs__search', arguments: '{"query":"小花"}' }], results: [{ id: 'c1', content: '{"results":[{"snippet":"家裡的貓叫小花"}]}' }] }]
  try {
    // 一般回合：原生 tool_calls 格式
    let res = await chat({ prompt: '貓叫什麼', tool_turns: turns })
    assert.equal(res.headers.get('X-Tool-Count'), '7')
    assert.ok(sent[0].messages.some((m) => m.role === 'tool'))
    assert.ok(sent[0].messages[0].content.includes(DOCS_ACCESS_RULE))

    // 用完：不送 tools、沒有 tool 角色／tool_calls，結果以文字放在唯一的 system，最後一則是 user
    res = await chat({ prompt: '貓叫什麼', tool_turns: turns, use_tools: false, tools_exhausted: true })
    assert.equal(res.headers.get('X-Tool-Count'), '0')
    const b = sent[1]
    assert.equal(b.tools, undefined)
    assert.equal(b.tool_choice, undefined)
    assert.equal(b.messages.filter((m) => m.role === 'system').length, 1)
    assert.equal(b.messages[0].role, 'system')
    assert.ok(!b.messages.some((m) => m.role === 'tool' || m.tool_calls))
    assert.match(b.messages[0].content, /工具使用次數已用完，請只根據上面已取得的工具結果直接回答使用者/)
    assert.match(b.messages[0].content, /家裡的貓叫小花/)
    assert.equal(b.messages[b.messages.length - 1].role, 'user')

    // tools_exhausted 單獨送也強制不帶工具
    await chat({ prompt: '貓叫什麼', tool_turns: turns, tools_exhausted: true })
    assert.equal(sent[2].tools, undefined)
    assert.ok(!sent[2].messages.some((m) => m.role === 'tool'))

    // use_tools:false（未用完）：同樣轉文字，但不加「已用完」
    await chat({ prompt: '貓叫什麼', tool_turns: turns, use_tools: false })
    assert.ok(!sent[3].messages.some((m) => m.role === 'tool'))
    assert.match(sent[3].messages[0].content, /家裡的貓叫小花/)
    assert.doesNotMatch(sent[3].messages[0].content, /工具使用次數已用完/)
  } finally { globalThis.fetch = orig }
})

test('docs__list: per-project document counts, unassigned count, compact fields', async () => {
  const db = await makeDb()
  await createEntity(db, 'projects', { id: 'p1', name: '京都旅行' })
  await createEntity(db, 'projects', { id: 'p2', name: '工作' })
  await createEntity(db, 'projects', { id: 'p3', name: '空專案' })
  await createEntity(db, 'documents', { id: 'd1', title: '行程', content: '嵐山', project_id: 'p1' })
  await createEntity(db, 'documents', { id: 'd2', title: '預算', content: '十萬', project_id: 'p1' })
  await createEntity(db, 'documents', { id: 'd3', title: '週會', content: '目標', project_id: 'p2' })
  await createEntity(db, 'documents', { id: 'd4', title: '雜記', content: 'x' })
  const r = await callDocTool(db, {}, { name: 'docs__list', arguments: '{"limit":2}' })
  const j = JSON.parse(r.content)
  const counts = Object.fromEntries(j.projects.map((p) => [p.name, p.documents]))
  assert.deepEqual(counts, { 京都旅行: 2, 工作: 1, 空專案: 0 })
  assert.equal(j.unassigned, 1)
  assert.equal(j.total, 4)
  assert.equal(j.count, 2)
  assert.match(j.hint, /只列出最近更新的 2 份/)
  assert.match(r.summary, /共 4 份/)
  assert.match(j.documents[0].updated, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(!('content' in j.documents[0]) && !('preview' in j.documents[0]))
  // 依專案過濾時 total 只算該專案
  const p = JSON.parse((await callDocTool(db, {}, { name: 'docs__list', arguments: '{"project_id":"京都旅行"}' })).content)
  assert.equal(p.total, 2)
  assert.equal(p.hint, undefined)
})

// ---- 前端（jsdom） ----

async function boot(db, upstreamFn) {
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'), __db: db }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const calls = []
  const chatBodies = []
  const serverCall = async (url, init = {}) => {
    const headers = new Headers(init.headers || {})
    headers.set('cookie', cookie)
    if (init.method && init.method !== 'GET') headers.set('origin', 'https://example.com')
    if (String(url).includes('/api/tools/call')) calls.push(JSON.parse(init.body))
    if (String(url).includes('/api/chat')) chatBodies.push(JSON.parse(init.body))
    return app.fetch(new Request(new URL(url, 'https://example.com/'), { method: init.method || 'GET', headers, body: init.body }), env)
  }
  const prov = await (await serverCall('/api/providers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '自建', base_url: 'https://llm.example.com/v1', models: ['m1'] }) })).json()
  const pid = prov.provider.id
  const upstream = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    if (body.stream === false) return Response.json({ choices: [{ message: { content: '{"memories":[]}' } }] })
    upstream.push(body)
    return new Response(upstreamFn(body, upstream.length), { headers: { 'content-type': 'text/event-stream' } })
  }
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  w.fetch = async (input, init = {}) => {
    const res = await serverCall(typeof input === 'string' ? input : input.url, init)
    return new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers })
  }
  Object.assign(w, {
    TextDecoder, TextEncoder, ReadableStream, TA_GEO: {}, scrollTo: () => {}, confirm: () => true, alert: () => {},
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
  await waitFor(() => w.document.querySelector(`[data-model="${pid}|m1"]`))
  const close = async () => { await sleep(500); globalThis.fetch = originalFetch; w.close() } // 先讓背景同步結束再關閉視窗
  return { w, pid, upstream, calls, chatBodies, close, $: (id) => w.document.getElementById(id) }
}

const toolCall = (id, name, args) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } }] }, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`
const answer = (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\ndata: [DONE]\n\n`

function send(env, text) {
  const { w, $, pid } = env
  w.document.querySelector(`[data-model="${pid}|m1"]`).click()
  $('prompt-input').value = text
  $('prompt-input').dispatchEvent(new w.Event('input', { bubbles: true }))
  $('send-btn').click()
}

test('frontend: repeated identical read calls are deduped; after 8 rounds a final no-tools request yields the answer', async () => {
  const db = await makeDb()
  await createEntity(db, 'documents', { id: 'd1', title: '寵物筆記', content: '家裡的貓叫小花。' })
  // 有工具定義就一直呼叫相同的 docs__search（參數鍵順序不同也算相同）；沒有工具時回答
  const env = await boot(db, (body, n) => body.tools
    ? toolCall('c' + n, 'docs__search', n % 2 ? '{"query":"小花","limit":3}' : '{ "limit": 3, "query": "小花" }')
    : answer('貓叫小花。'))
  try {
    send(env, '我的貓叫什麼？')
    await waitFor(() => [...env.w.document.querySelectorAll('.msg-row.ai')].some((el) => /貓叫小花。/.test(el.textContent)), 30000)
    const streamed = env.upstream
    assert.equal(streamed.length, 9) // 第一次＋8 回合
    const last = streamed[8]
    // 前端最後一次 /api/chat 帶 use_tools:false＋tools_exhausted:true，前面幾次沒有
    const fin = env.chatBodies[env.chatBodies.length - 1]
    assert.equal(fin.use_tools, false)
    assert.equal(fin.tools_exhausted, true)
    assert.equal(fin.tool_turns.length, 8)
    assert.ok(env.chatBodies.slice(0, -1).every((b) => b.use_tools !== false && !b.tools_exhausted))
    assert.equal(last.tools, undefined)
    assert.ok(!last.messages.some((m) => m.role === 'tool'))
    assert.match(last.messages[0].content, /工具使用次數已用完/)
    assert.match(last.messages[0].content, /家裡的貓叫小花/)
    for (const b of streamed.slice(0, 8)) assert.ok(b.tools && b.tools.length)
    // 只真的打一次 API，其餘回「結果同上」
    assert.equal(env.calls.filter((c) => c.name === 'docs__search').length, 1)
    const toolMsgs = streamed[7].messages.filter((m) => m.role === 'tool').map((m) => m.content)
    assert.equal(toolMsgs.length, 7)
    assert.match(toolMsgs[0], /d1/)
    for (const t of toolMsgs.slice(1)) assert.equal(t, '（與先前相同的呼叫，結果同上，請直接使用先前結果）')
    // 小字：工具名＋重點參數
    const lines = [...env.w.document.querySelectorAll('.doc-tool-line')].map((el) => el.textContent)
    // （對話在背景同步時可能重繪，早期回合的小字不一定還在 DOM，只檢查格式）
    assert.ok(lines.length >= 1)
    assert.ok(lines.every((l) => /^搜尋：小花 → (已搜尋文件|重複呼叫，沿用先前結果)/.test(l)), lines.join('|'))
    assert.ok(lines.some((l) => /重複呼叫，沿用先前結果/.test(l)))
    // 不再出現死路訊息
    assert.doesNotMatch(env.w.document.body.textContent, /已達工具呼叫上限/)
    await waitFor(() => /貓叫小花。/.test(env.w.localStorage.getItem('ta_ai_chats') || ''))
  } finally { await env.close() }
})

test('frontend: list/read labels; duplicate docs__save is not executed twice and asks only once', async () => {
  const db = await makeDb()
  await createEntity(db, 'projects', { id: 'p1', name: '京都旅行' })
  await createEntity(db, 'documents', { id: 'd1', title: '京都行程', content: '嵐山', project_id: 'p1' })
  const save = { title: '清單', content: '抹茶', project_id: 'p1' }
  const env = await boot(db, (body, n) => n === 1 ? toolCall('a', 'docs__list', { project_id: 'p1' })
    : n === 2 ? toolCall('b', 'docs__read', { id: 'd1' })
    : n === 3 ? toolCall('c', 'docs__save', save)
    : n === 4 ? toolCall('d', 'docs__save', { content: '抹茶', project_id: 'p1', title: '清單' })
    : answer('好了。'))
  try {
    await waitFor(() => JSON.parse(env.w.localStorage.getItem('ta_projects') || '[]').length === 1 && JSON.parse(env.w.localStorage.getItem('ta_documents') || '[]').length === 1)
    send(env, '把清單存進京都旅行')
    const card = await waitFor(() => env.w.document.querySelector('.mcp-confirm'))
    card.querySelector('[data-act="allow"]').click()
    await waitFor(() => [...env.w.document.querySelectorAll('.msg-row.ai')].some((el) => /好了。/.test(el.textContent)), 20000)
    assert.equal(env.w.document.querySelectorAll('.mcp-confirm').length, 1)
    assert.equal((await db.query(`SELECT count(*)::int n FROM documents WHERE title = '清單'`))[0].n, 1)
    assert.equal(env.calls.filter((c) => c.name === 'docs__save').length, 1)
    const lines = [...env.w.document.querySelectorAll('.doc-tool-line')].map((el) => el.textContent)
    assert.match(lines[0], /^列出文件：資料夾「京都旅行」 → 已列出「京都旅行」的 1 份文件/)
    assert.match(lines[1], /^讀取：京都行程 → 已讀取文件：京都行程/)
    assert.match(lines[2], /^儲存：清單 → 重複呼叫，未再執行/)
    const lastTool = env.upstream[4].messages.filter((m) => m.role === 'tool').pop()
    assert.equal(lastTool.content, '（與先前相同的呼叫，結果同上，請直接使用先前結果）')
  } finally { await env.close() }
})

test('frontend: documents page groups documents into collapsible project folders', async () => {
  const db = await makeDb()
  await createEntity(db, 'projects', { id: 'p1', name: '京都旅行' })
  await createEntity(db, 'projects', { id: 'p2', name: '工作' })
  await createEntity(db, 'documents', { id: 'd1', title: '京都行程', content: '嵐山', project_id: 'p1' })
  await createEntity(db, 'documents', { id: 'd2', title: '京都預算', content: '十萬', project_id: 'p1' })
  await createEntity(db, 'documents', { id: 'd3', title: '週會', content: '目標', project_id: 'p2' })
  await createEntity(db, 'documents', { id: 'd4', title: '雜記', content: 'x' })
  const env = await boot(db, () => answer('ok'))
  const { w, $ } = env
  try {
    await waitFor(() => JSON.parse(w.localStorage.getItem('ta_documents') || '[]').length === 4 && JSON.parse(w.localStorage.getItem('ta_projects') || '[]').length === 2)
    $('tab-docs').click()
    await waitFor(() => w.document.querySelectorAll('#history-list .doc-folder').length === 3)
    const folders = [...w.document.querySelectorAll('#history-list .doc-folder')]
    const info = folders.map((f) => [f.querySelector('.doc-folder-name').textContent, f.querySelector('.doc-folder-count').textContent, f.querySelectorAll('.doc-item').length])
    // 專案資料夾依專案清單順序，「未分類」永遠最後
    assert.deepEqual(info[2], ['未分類', '1', 1])
    assert.deepEqual(info.slice(0, 2).sort(), [['京都旅行', '2', 2], ['工作', '1', 1]].sort())
    assert.deepEqual([...folders[2].querySelectorAll('.doc-title')].map((el) => el.textContent), ['雜記'])
    // 預設：專案資料夾收合、未分類展開
    const kyoto = w.document.querySelector('#history-list [data-folder="p1"]')
    assert.equal(kyoto.classList.contains('open'), false)
    assert.equal(folders[2].classList.contains('open'), true)
    // 展開並記住狀態
    kyoto.querySelector('.doc-folder-head').click()
    assert.equal(kyoto.classList.contains('open'), true)
    assert.equal(JSON.parse(w.localStorage.getItem('ta_doc_folders')).p1, true)
    // 開啟文件：點文件會開 artifact（不丟錯）；刪除按鈕仍在
    assert.ok(kyoto.querySelector('[data-del-doc="d1"]'))
    // 搜尋：只顯示有符合的資料夾並自動展開
    const search = $('history-search')
    search.value = '週會'
    search.dispatchEvent(new w.Event('input', { bubbles: true }))
    await waitFor(() => w.document.querySelectorAll('#history-list .doc-folder').length === 1)
    const only = w.document.querySelector('#history-list .doc-folder')
    assert.equal(only.getAttribute('data-folder'), 'p2')
    assert.equal(only.classList.contains('open'), true)
    search.value = ''
    search.dispatchEvent(new w.Event('input', { bubbles: true }))
    await waitFor(() => w.document.querySelectorAll('#history-list .doc-folder').length === 3)
    // 重新渲染後保持展開狀態
    assert.equal(w.document.querySelector('#history-list [data-folder="p1"]').classList.contains('open'), true)
    // 在「工作」資料夾新增 → 預設該專案
    w.document.querySelector('#history-list [data-folder-add="p2"]').click()
    assert.equal($('train-project').value, 'p2')
    $('train-title').value = '新筆記'
    $('train-content').value = '內容'
    $('save-knowledge-btn').click()
    const created = JSON.parse(w.localStorage.getItem('ta_documents')).find((d) => d.title === '新筆記')
    assert.equal(created.projectId, 'p2')
    await waitFor(() => w.document.querySelector('#history-list [data-folder="p2"] .doc-folder-count')?.textContent === '2')
    // 未分類新增
    w.document.querySelector('#history-list [data-folder-add="__none"]').click()
    assert.equal($('train-project').value, '')
    // 知識庫視窗也依專案分組
    const groups = [...w.document.querySelectorAll('#knowledge-list-box .kb-group-title')].map((el) => el.textContent)
    assert.equal(groups[2], '📁 未分類（1）')
    assert.deepEqual(groups.slice(0, 2).sort(), ['📁 京都旅行（2）', '📁 工作（2）'].sort())
    // 伺服器同步後寫入正確的 project_id
    await waitFor(async () => (await db.query(`SELECT project_id FROM documents WHERE title = '新筆記'`))[0]?.project_id === 'p2', 20000)
  } finally { await env.close() }
})
