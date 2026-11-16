// 內建網路搜尋工具（web__search）：注入條件（搜尋服務、tools.web 開關）、Jina／Tavily 執行與字數上限、
// /api/tools/call 路由、系統提示規則、工具回合沿用首輪搜尋結果（不重查），
// 以及前端（jsdom）：免確認、同輪去重、小字「網路搜尋：…」、來源框、search_web 沿用、搜尋未執行的提示。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { resolveAllTools } from '../src/doc_tools.js'
import { callWebTool, isWebTool, resolveWebTools, webToolsEnabled } from '../src/web_tool.js'
import { createEntity, putSettings } from '../src/repo/entities.js'
import { WEB_SEARCH_TOOL_RULE, handleChat, reusedSearchResults, toolRules } from '../src/chat.js'

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

const jinaItems = (n, tag) => Array.from({ length: n }, (_, i) => ({
  title: `${tag} 結果 ${i + 1}`, url: `https://news.example.com/${encodeURIComponent(tag)}/${i + 1}`, description: `${tag} 的摘要 ${i + 1} ` + 'x'.repeat(900),
}))

/** 以 handler 取代 globalThis.fetch，記錄搜尋服務的請求。 */
function mockFetch(handler) {
  const orig = globalThis.fetch
  const searches = []
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    if (u.startsWith('https://s.jina.ai/')) {
      searches.push({ provider: 'jina', url: u, headers: init.headers })
      const q = decodeURIComponent(u.split('?q=')[1] || '')
      return handler ? handler('jina', q, init) : Response.json({ data: jinaItems(5, q) })
    }
    if (u.startsWith('https://api.tavily.com/')) {
      const body = JSON.parse(init.body)
      searches.push({ provider: 'tavily', body, headers: init.headers })
      return handler ? handler('tavily', body.query, init)
        : Response.json({ results: Array.from({ length: body.max_results }, (_, i) => ({ title: `T${i + 1}`, url: `https://t.example.com/${i + 1}`, content: `tavily 內容 ${i + 1}` })) })
    }
    return orig(url, init)
  }
  return { searches, restore: () => { globalThis.fetch = orig } }
}

const callTool = (db, env, args, name = 'web__search') => callWebTool(db, env, { name, arguments: JSON.stringify(args) })

test('web tool: switch, prefix and injection conditions', async () => {
  const db = await makeDb()
  assert.equal(webToolsEnabled({}), true)
  assert.equal(webToolsEnabled({ 'tools.web': false }), false)
  assert.equal(webToolsEnabled({ 'tools.web': 0 }), false)
  assert.equal(webToolsEnabled({ 'tools.web': 'off' }), false)
  assert.equal(webToolsEnabled({ 'tools.web': true }), true)
  assert.equal(isWebTool('web__search'), true)
  assert.equal(isWebTool('docs__search'), false)
  assert.equal(isWebTool('mcpab__web__search'), false)

  // 沒有搜尋服務：不注入
  assert.deepEqual(await resolveWebTools(db, {}), [])
  const mcp = async () => [{ type: 'function', function: { name: 'mcpab__x', description: '', parameters: { type: 'object', properties: {} } } }]
  assert.deepEqual((await resolveAllTools(db, mcp)).map((t) => t.function.name), ['docs__list', 'docs__search', 'docs__read', 'docs__save', 'docs__edit', 'docs__create_folder', 'docs__delete', 'mcpab__x'])

  // 有 Key（環境變數）：注入，順序 docs → web → MCP；max_results 上限依面板結果數
  const env = { JINA_API_KEY: 'jina_test' }
  const tools = await resolveWebTools(db, env)
  assert.equal(tools.length, 1)
  assert.equal(tools[0].function.name, 'web__search')
  assert.deepEqual(tools[0].function.parameters.required, ['query'])
  assert.match(tools[0].function.parameters.properties.max_results.description, /上限 3/)
  assert.deepEqual((await resolveAllTools(db, mcp, undefined, env)).map((t) => t.function.name),
    ['docs__list', 'docs__search', 'docs__read', 'docs__save', 'docs__edit', 'docs__create_folder', 'docs__delete', 'web__search', 'mcpab__x'])

  // 面板關閉搜尋服務、或 tools.web 關閉：不注入
  await putSettings(db, { 'search.web': { provider: 'off' } })
  assert.deepEqual(await resolveWebTools(db, env), [])
  await putSettings(db, { 'search.web': null, 'tools.web': false })
  assert.deepEqual(await resolveWebTools(db, env), [])
  assert.ok(!(await resolveAllTools(db, mcp, undefined, env)).some((t) => t.function.name === 'web__search'))
  await putSettings(db, { 'tools.web': null })

  // 系統提示
  const rules = toolRules(['docs__list', 'web__search'])
  assert.ok(rules.includes(WEB_SEARCH_TOOL_RULE))
  assert.match(rules, /不要說你無法上網/)
  assert.match(rules, /來源網址/)
  assert.doesNotMatch(toolRules(['docs__list']), /web__search/)
})

test('web tool: Jina / Tavily execution, limits and errors', async () => {
  const db = await makeDb()
  const m = mockFetch()
  try {
    // Jina：預設回傳數＝面板上限（預設 3）；摘要依面板字數截斷；只回 title/url/snippet
    let r = await callTool(db, { JINA_API_KEY: 'jina_k' }, { query: '  台北 天氣  ' })
    assert.equal(r.is_error, false)
    assert.equal(r.server, '網路')
    assert.equal(r.tool, 'search')
    let j = JSON.parse(r.content)
    assert.equal(j.query, '台北 天氣')
    assert.equal(j.provider, 'Jina')
    assert.equal(j.count, 3)
    assert.deepEqual(Object.keys(j.results[0]).sort(), ['snippet', 'title', 'url'])
    assert.ok(j.results[0].snippet.length <= 401)
    assert.match(j.results[0].url, /^https:\/\/news\.example\.com\//)
    assert.equal(r.summary, '找到 3 筆結果')
    assert.equal(r.sources.length, 3)
    assert.equal(m.searches[0].headers.Authorization, 'Bearer jina_k')
    assert.equal(m.searches[0].headers['X-Respond-With'], 'no-content')

    // 面板上限 5、要求 2 → 2；要求 99 → 5
    await putSettings(db, { 'search.web': { maxResults: 5, snippetChars: 1200, contextChars: 6000 } })
    j = JSON.parse((await callTool(db, { JINA_API_KEY: 'jina_k' }, { query: '股價', max_results: 2 })).content)
    assert.equal(j.count, 2)
    j = JSON.parse((await callTool(db, { JINA_API_KEY: 'jina_k' }, { query: '匯率', max_results: 99 })).content)
    assert.equal(j.count, 5)
    // 結果總字數受限（工具輸出上限 12,000 字）
    assert.ok((await callTool(db, { JINA_API_KEY: 'jina_k' }, { query: '長摘要', max_results: 5 })).content.length <= 12_100)

    // Tavily：只有 TAVILY_API_KEY 時使用 Tavily，max_results 送給 API
    r = await callTool(db, { TAVILY_API_KEY: 'tvly-k' }, { query: 'tavily 測試', max_results: 4 })
    j = JSON.parse(r.content)
    assert.equal(j.provider, 'Tavily')
    assert.equal(j.count, 4)
    assert.equal(j.results[0].snippet, 'tavily 內容 1')
    const tv = m.searches.find((s) => s.provider === 'tavily')
    assert.equal(tv.body.max_results, 4)
    assert.equal(tv.headers.Authorization, 'Bearer tvly-k')

    // 缺 query：is_error 回給模型
    r = await callTool(db, { JINA_API_KEY: 'jina_k' }, {})
    assert.equal(r.is_error, true)
    assert.match(r.content, /query/)
  } finally { m.restore() }

  // 搜尋服務回 401：is_error，訊息清楚
  const m2 = mockFetch(() => new Response('no', { status: 401 }))
  try {
    const r = await callTool(db, { JINA_API_KEY: 'jina_bad' }, { query: '壞 key 測試' })
    assert.equal(r.is_error, true)
    assert.match(r.content, /API Key 無效/)
    assert.match(r.summary, /網路搜尋失敗/)
  } finally { m2.restore() }

  // 沒有搜尋服務：400 清楚錯誤；tools.web 關閉：403；未知名稱：404
  await putSettings(db, { 'search.web': null })
  await assert.rejects(callTool(db, {}, { query: 'x' }), (e) => e.status === 400 && /尚未設定網路搜尋服務/.test(e.message))
  await putSettings(db, { 'tools.web': false })
  await assert.rejects(callTool(db, { JINA_API_KEY: 'k' }, { query: 'x' }), (e) => e.status === 403)
  await putSettings(db, { 'tools.web': null })
  await assert.rejects(callTool(db, { JINA_API_KEY: 'k' }, { query: 'x' }, 'web__fetch'), (e) => e.status === 404)
})

test('web tool: /api/tools/call routes web__ names', async () => {
  const db = await makeDb()
  const base = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', __db: db }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(base, 1))}`
  const post = (env, body) => app.fetch(new Request('https://example.com/api/tools/call', {
    method: 'POST', headers: { cookie, origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), env)
  const m = mockFetch()
  try {
    let res = await post({ ...base, JINA_API_KEY: 'jina_k' }, { name: 'web__search', arguments: '{"query":"路由測試"}' })
    assert.equal(res.status, 200)
    const j = await res.json()
    assert.equal(j.result.server, '網路')
    assert.equal(JSON.parse(j.result.content).count, 3)
    // 沒有 Key：400，訊息說明去哪裡設定
    res = await post(base, { name: 'web__search', arguments: '{"query":"x"}' })
    assert.equal(res.status, 400)
    assert.match((await res.json()).error || '', /網頁搜尋/)
    // tools.web 關閉：403
    await putSettings(db, { 'tools.web': false })
    res = await post({ ...base, JINA_API_KEY: 'jina_k' }, { name: 'web__search', arguments: '{"query":"x"}' })
    assert.equal(res.status, 403)
  } finally { m.restore() }
})

test('handleChat: web__search offered without search_web; tool rounds reuse first-round search results', async () => {
  const db = await makeDb()
  const env = { JINA_API_KEY: 'jina_k' }
  const sent = []
  const m = mockFetch()
  const orig = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://llm.example.com')) {
      sent.push(JSON.parse(init.body))
      return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    }
    return orig(url, init)
  }
  const chat = (body) => handleChat(
    new Request('https://app.example/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    env, {
      resolveProvider: async () => ({ baseUrl: 'https://llm.example.com/v1', apiKey: 'k', model: 'm' }),
      resolveTools: (e) => resolveAllTools(db, async () => [], undefined, e),
    })
  try {
    // 1) 輸入框開關關閉：仍提供 web__search，系統提示要求用工具、附來源
    let res = await chat({ prompt: '今天有什麼新聞？' })
    assert.equal(res.headers.get('X-Search-Status'), 'off')
    assert.equal(res.headers.get('X-Tool-Count'), '8')
    await res.text()
    assert.ok(sent[0].tools.some((t) => t.function.name === 'web__search'))
    assert.match(sent[0].messages[0].content, /web__search/)
    assert.match(sent[0].messages[0].content, /不要說你無法上網/)
    assert.equal(m.searches.length, 0)

    // 2) 開關開啟：首輪預先搜尋一次，SSE 最前面帶 search_context 給前端
    res = await chat({ prompt: '台北今天的天氣預報', search_web: true })
    assert.equal(res.headers.get('X-Search-Status'), 'ok')
    const raw = await res.text()
    const first = JSON.parse(raw.split('\n')[0].slice(5))
    assert.equal(first.search_context.length, 3)
    assert.match(first.search_context[0].url, /^https:\/\//)
    assert.equal(m.searches.length, 1)
    assert.ok(sent[1].tools.some((t) => t.function.name === 'web__search')) // 預搜與工具並存
    assert.match(sent[1].messages[0].content, /網頁搜尋結果/)

    // 3) 工具回合：帶 tool_turns＋search_context → 不重查，沿用結果
    const turns = [{ content: '', tool_calls: [{ id: 'a', name: 'docs__list', arguments: '{}' }], results: [{ id: 'a', content: '{}' }] }]
    res = await chat({ prompt: '台北今天的天氣預報', search_web: true, tool_turns: turns, search_context: first.search_context })
    assert.equal(res.headers.get('X-Search-Status'), 'reused')
    const raw2 = await res.text()
    assert.doesNotMatch(raw2, /search_context/)
    assert.equal(m.searches.length, 1)
    assert.match(sent[2].messages[0].content, /網頁搜尋結果/)
    assert.ok(sent[2].messages[0].content.includes(first.search_context[0].url))
    assert.equal(JSON.parse(decodeURIComponent(res.headers.get('X-Sources'))).length, 3)

    // 4) 工具回合但沒有 search_context：也不重查
    res = await chat({ prompt: '台北今天的天氣預報', search_web: true, tool_turns: turns })
    await res.text()
    assert.equal(res.headers.get('X-Search-Status'), 'skipped')
    assert.equal(m.searches.length, 1)
  } finally { globalThis.fetch = orig; m.restore() }

  // 前端回傳的結果會被清理：非 http(s) 網址丟棄、長度截斷、最多 5 筆
  const cleaned = reusedSearchResults([
    { title: 'ok', url: 'https://a.example', content: 'y'.repeat(5000) },
    { title: 'bad', url: 'javascript:alert(1)', content: 'z' },
    'junk', null,
    ...Array.from({ length: 6 }, (_, i) => ({ title: 't' + i, url: 'https://b.example/' + i, content: 'c' })),
  ])
  assert.equal(cleaned.length, 5)
  assert.ok(cleaned.every((r) => /^https:\/\//.test(r.url)))
  assert.ok(cleaned[0].content.length <= 1201)
  assert.deepEqual(reusedSearchResults('nope'), [])
})

// ---- 前端（jsdom） ----

async function boot(db, extraEnv, upstreamFn, { autoSearch = false } = {}) {
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'), __db: db, ...extraEnv }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const calls = []
  const chatBodies = []
  const chatResponses = []
  const serverCall = async (url, init = {}) => {
    const headers = new Headers(init.headers || {})
    headers.set('cookie', cookie)
    if (init.method && init.method !== 'GET') headers.set('origin', 'https://example.com')
    if (String(url).includes('/api/tools/call')) calls.push(JSON.parse(init.body))
    if (String(url).includes('/api/chat')) chatBodies.push(JSON.parse(init.body))
    const res = await app.fetch(new Request(new URL(url, 'https://example.com/'), { method: init.method || 'GET', headers, body: init.body }), env)
    if (String(url).includes('/api/chat')) chatResponses.push(res.headers.get('x-search-status'))
    return res
  }
  const prov = await (await serverCall('/api/providers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '自建', base_url: 'https://llm.example.com/v1', models: ['m1'] }) })).json()
  const pid = prov.provider.id
  const upstream = []
  const m = mockFetch()
  const mocked = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://llm.example.com')) return mocked(url, init)
    const body = JSON.parse(init.body)
    if (body.stream === false) return Response.json({ choices: [{ message: { content: '{"memories":[]}' } }] })
    upstream.push(body)
    return new Response(upstreamFn(body, upstream.length), { headers: { 'content-type': 'text/event-stream' } })
  }
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  if (autoSearch) w.localStorage.setItem('ta_auto_search', '1')
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
  const close = async () => { await sleep(500); m.restore(); w.close() }
  return { w, pid, upstream, calls, chatBodies, chatResponses, searches: m.searches, close, $: (id) => w.document.getElementById(id) }
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
const aiText = (env, re) => [...env.w.document.querySelectorAll('.msg-row.ai')].some((el) => re.test(el.textContent))

test('frontend: web__search runs without a card, dedupes, labels the line and lists cited sources', async () => {
  const db = await makeDb()
  const q = '高雄 天氣'
  const url = `https://news.example.com/${encodeURIComponent(q)}/1`
  const env = await boot(db, { JINA_API_KEY: 'jina_k' }, (body, n) => n <= 2 ? toolCall('w' + n, 'web__search', n === 1 ? { query: q } : { query: q })
    : answer(`明天會下雨（來源：${url}）`))
  try {
    // 設定頁：網路搜尋工具勾選預設開啟
    env.w.document.querySelector('[data-pane="pane-providers"]').click()
    await waitFor(() => env.$('web-tools-toggle') && env.$('web-tools-toggle').checked)
    assert.ok(env.upstream.length === 0)
    send(env, '明天高雄會下雨嗎')
    await waitFor(() => aiText(env, /明天會下雨/), 30000)
    assert.equal(env.w.document.querySelectorAll('.mcp-confirm').length, 0)
    assert.ok(env.upstream[0].tools.some((t) => t.function.name === 'web__search'))
    // 同輪相同參數只打一次
    assert.equal(env.calls.filter((c) => c.name === 'web__search').length, 1)
    assert.equal(env.searches.length, 1)
    const lines = [...env.w.document.querySelectorAll('.doc-tool-line')].map((el) => el.textContent)
    assert.ok(lines.some((l) => l === `網路搜尋：${q} → 找到 3 筆結果`), lines.join('|'))
    assert.ok(lines.some((l) => l === `網路搜尋：${q} → 重複呼叫，沿用先前結果`), lines.join('|'))
    // 來源框：工具結果的來源併入，只列回答中引用到的網址或網域（本例三筆同網域）
    await waitFor(() => env.w.document.querySelector('.sources-box .source-tag'))
    const hrefs = [...env.w.document.querySelectorAll('.sources-box .source-tag')].map((a) => a.getAttribute('href'))
    assert.ok(hrefs.includes(url), hrefs.join('|'))
    assert.ok(hrefs.every((h) => h.startsWith('https://news.example.com/')))
  } finally { await env.close() }
})

test('frontend: search_web stays on in tool rounds and reuses first-round results; no-key note', async () => {
  const db = await makeDb()
  await createEntity(db, 'documents', { id: 'd1', title: '筆記', content: '內容' })
  const env = await boot(db, { JINA_API_KEY: 'jina_k' }, (body, n) => n === 1 ? toolCall('a', 'docs__list', {})
    : answer('根據搜尋，股市上漲 https://news.example.com/x'), { autoSearch: true })
  try {
    send(env, '今天股市表現如何')
    await waitFor(() => aiText(env, /股市上漲/), 30000)
    assert.equal(env.chatBodies[0].search_web, true)
    assert.equal(env.chatBodies[1].search_web, true)
    assert.ok(Array.isArray(env.chatBodies[1].search_context) && env.chatBodies[1].search_context.length === 3)
    assert.ok(env.chatBodies[1].tool_turns.length === 1)
    // 只在首輪搜尋一次；第二輪的系統提示仍有搜尋結果
    assert.equal(env.searches.length, 1)
    assert.deepEqual(env.chatResponses, ['ok', 'reused'])
    assert.match(env.upstream[1].messages[0].content, /網頁搜尋結果/)
    assert.equal(env.w.document.querySelectorAll('.search-status-note').length, 0)
  } finally { await env.close() }

  // 開關開啟但沒有任何搜尋 Key：回答下方出現小字提示；也不提供 web__search
  const db2 = await makeDb()
  const env2 = await boot(db2, {}, () => answer('我不確定。'), { autoSearch: true })
  try {
    // 背景同步可能在回答後重繪對話，故以 MutationObserver 記錄曾出現的提示
    const notes = []
    new env2.w.MutationObserver((list) => {
      for (const mu of list) for (const n of mu.addedNodes) {
        if (n.nodeType !== 1) continue
        if (n.classList.contains('search-status-note')) notes.push(n.textContent)
        n.querySelectorAll('.search-status-note').forEach((el) => notes.push(el.textContent))
      }
    }).observe(env2.w.document.body, { childList: true, subtree: true })
    send(env2, '今天股市表現如何')
    await waitFor(() => notes.length > 0, 30000)
    assert.equal(notes[0], '網路搜尋未執行：未設定搜尋 Key（設定 → 供應商 →「網頁搜尋」）')
    assert.deepEqual(env2.chatResponses, ['no_key'])
    assert.ok(!(env2.upstream[0].tools || []).some((t) => t.function.name === 'web__search'))
  } finally { await env2.close() }
})
