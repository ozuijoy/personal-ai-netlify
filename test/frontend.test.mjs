// 前端整合測試：jsdom 載入實際的 public/assets/*.js，fetch 導向真正的 router（app.fetch）+ PGlite。
// 驗證：舊瀏覽器資料（對話、文件、專案、供應商含 Key）自動上傳、Key 從瀏覽器移除、
// 模型選單依供應商分組、聊天請求改送 provider_id、本機刪除會同步到伺服器。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { JSDOM } from 'jsdom'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { getConversation } from '../src/repo/conversations.js'

const read = (p) => fs.readFileSync(new URL(`../public/assets/${p}`, import.meta.url), 'utf8')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm } })
  await pg.exec(fs.readFileSync(new URL('../db/migrations/0001_init.sql', import.meta.url), 'utf8'))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (statements) => pg.transaction(async (t) => {
      const out = []
      for (const [text, params] of statements) out.push((await t.query(text, params || [])).rows)
      return out
    }),
  }
}

async function waitFor(fn, ms = 8000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await sleep(50)
  }
  throw new Error('timeout waiting for condition')
}

test('frontend: server-first store, provider import, grouped models, provider_id chat', async () => {
  const db = await makeDb()
  const env = {
    APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456',
    ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'), GROQ_API_KEY: 'gsk_server_side', __db: db,
  }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const chatBodies = []

  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
    url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true,
  })
  const w = dom.window
  // 舊版瀏覽器資料
  w.localStorage.setItem('ta_ai_chats', JSON.stringify({ 1700000000000: { title: '舊對話', messages: [{ role: 'user', content: '你好', at: 1 }, { role: 'ai', content: '嗨！', at: 2, sources: [] }] } }))
  w.localStorage.setItem('ta_documents', JSON.stringify([{ id: 'doc_a', title: '旅遊筆記', content: '京都嵐山的竹林很漂亮', type: 'note', projectId: null }]))
  w.localStorage.setItem('ta_projects', JSON.stringify([{ id: 'p_1', name: '網站', description: 'd', instructions: 'i', role: '' }]))
  w.localStorage.setItem('ta_providers_v1', JSON.stringify([
    { id: 'p170', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-browser-secret-1234', model: 'gpt-x' },
    { id: 'p171', name: '自建', baseUrl: 'https://llm.example.com/v1', apiKey: '', model: 'qwen-local' },
  ]))
  w.localStorage.setItem('ta_tone', 'direct')

  w.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'https://example.com/')
    const headers = new Headers(init.headers || {})
    headers.set('cookie', cookie)
    if (init.method && init.method !== 'GET') headers.set('origin', 'https://example.com')
    if (url.pathname === '/api/chat') {
      chatBodies.push(JSON.parse(init.body))
      return new Response('data: {"choices":[{"delta":{"content":"回覆"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
    }
    const res = await app.fetch(new Request(url, { method: init.method || 'GET', headers, body: init.body }), env)
    return new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers })
  }
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
  w.HTMLElement.prototype.scrollIntoView = function () {}
  w.HTMLElement.prototype.scrollTo = function () {}
  w.scrollTo = () => {}
  w.TA_GEO = {}
  w.TextDecoder = TextDecoder
  w.TextEncoder = TextEncoder
  w.ReadableStream = ReadableStream
  w.marked = { parse: (t) => String(t), setOptions() {}, use() {}, Renderer: function () {} }
  const errors = []
  w.addEventListener('error', (e) => errors.push(e.message))
  const origErr = w.console.error
  w.console.error = (...a) => { errors.push(a.map(String).join(' ')); origErr.apply(w.console, a) }

  for (const f of ['i18n/zh-TW.js', 'i18n.js', 'app.js', 'prompts.js']) {
    if (!fs.existsSync(new URL(`../public/assets/${f}`, import.meta.url))) continue
    w.eval(read(f))
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'))
  w.dispatchEvent(new w.Event('load'))

  // 1) 舊資料上傳、Key 從瀏覽器移除
  await waitFor(async () => (await db.query('SELECT count(*)::int n FROM conversations'))[0].n === 1)
  await waitFor(async () => (await db.query('SELECT count(*)::int n FROM providers'))[0].n === 2)
  await waitFor(() => w.localStorage.getItem('ta_providers_v1') === null)
  await waitFor(async () => (await db.query(`SELECT count(*)::int n FROM settings WHERE key = 'tone'`))[0].n === 1)
  const conv = await getConversation(db, '1700000000000')
  assert.deepEqual(conv.messages.map((m) => m.role), ['user', 'assistant'])
  assert.equal((await db.query('SELECT count(*)::int n FROM documents'))[0].n, 1)
  assert.equal((await db.query('SELECT count(*)::int n FROM projects'))[0].n, 1)
  const enc = (await db.query(`SELECT api_key_enc FROM providers WHERE id = 'p170'`))[0].api_key_enc
  assert.ok(enc && !enc.includes('sk-browser'))
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(w.localStorage))).includes('sk-browser-secret'), false)

  // 2) 模型選單分組：Groq（內建）、OpenAI、自建
  const labels = await waitFor(() => {
    const els = [...w.document.querySelectorAll('#model-menu .model-group-label')].map((e) => e.textContent)
    return els.length === 3 ? els : null
  })
  assert.match(labels[0], /Groq/)
  assert.match(labels[2], /自建.*無 Key/)
  const opts = [...w.document.querySelectorAll('#model-menu .model-option')].map((e) => e.getAttribute('data-model'))
  assert.ok(opts.includes('p171|qwen-local'))

  // 3) 選自建模型後送出：聊天請求帶 provider_id，不帶任何 Key
  w.document.querySelector('[data-model="p171|qwen-local"]').click()
  const input = w.document.getElementById('prompt-input')
  input.value = '京都竹林在哪裡？'
  input.dispatchEvent(new w.Event('input', { bubbles: true }))
  w.document.getElementById('send-btn').click()
  const body = await waitFor(() => chatBodies[0])
  assert.equal(body.provider_id, 'p171')
  assert.equal(body.model, 'qwen-local')
  assert.equal(body.provider, undefined)
  assert.equal(JSON.stringify(body).includes('sk-'), false)
  assert.ok(body.knowledge_snippets.some((s) => s.title === '旅遊筆記'))
  // 回覆存檔到伺服器
  await waitFor(async () => (await db.query(`SELECT count(*)::int n FROM messages WHERE content = '回覆'`))[0].n === 1)

  // 4) 新增無 Key 供應商（表單）
  w.document.getElementById('provider-new-btn').click()
  w.document.getElementById('provider-name').value = 'Ollama 閘道'
  w.document.getElementById('provider-base').value = 'https://ollama.example.com/v1'
  w.document.getElementById('provider-key').value = ''
  w.document.getElementById('provider-model').value = 'llama3, mistral'
  w.document.getElementById('provider-save-btn').click()
  await waitFor(async () => (await db.query(`SELECT count(*)::int n FROM provider_models pm JOIN providers p ON p.id = pm.provider_id WHERE p.name = 'Ollama 閘道'`))[0].n === 2)
  await waitFor(() => w.document.querySelectorAll('#model-menu .model-group-label').length === 4)

  // 5) 釘選（本機修改）→ 伺服器更新；本機刪除 → 伺服器軟刪除
  w.confirm = () => true
  const pinBtn = await waitFor(() => w.document.querySelector('[data-pin-id="1700000000000"]'))
  pinBtn.click()
  await waitFor(async () => (await db.query(`SELECT pinned FROM conversations WHERE id = '1700000000000'`))[0].pinned === true)
  w.document.querySelector('[data-del-id="1700000000000"]').click()
  await waitFor(async () => (await db.query(`SELECT deleted_at FROM conversations WHERE id = '1700000000000'`))[0].deleted_at !== null)

  // 6) 其他裝置刪除（伺服器端刪除）→ 按「與伺服器同步」後本機移除
  await db.query(`UPDATE documents SET deleted_at = now() WHERE id = 'doc_a'`)
  // 其他裝置新增的對話 → 本機出現
  await app.fetch(new Request('https://example.com/api/conversations', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: 'https://example.com' },
    body: JSON.stringify({ id: 'remote1', title: '手機上的對話', messages: [{ role: 'user', content: 'from phone' }] }),
  }), env)
  w.document.getElementById('sync-now-btn').click()
  await waitFor(() => JSON.parse(w.localStorage.getItem('ta_documents')).every((d) => d.id !== 'doc_a'))
  await waitFor(() => JSON.parse(w.localStorage.getItem('ta_ai_chats')).remote1)
  assert.equal(JSON.parse(w.localStorage.getItem('ta_ai_chats')).remote1.messages[0].content, 'from phone')

  assert.equal(errors.filter((e) => !/Not implemented|speech|audio/i.test(e)).length, 0, errors.join('\n'))
  w.close()
})
