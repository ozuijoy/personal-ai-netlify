// 前端第五階段（jsdom）：嵌入模型設定與補建索引、金鑰狀態、伺服器備份下載與還原。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { vector } from '@electric-sql/pglite/vector'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(40) }
  throw new Error('timeout waiting for condition')
}
async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm, vector } })
  await pg.exec(read('db/migrations/0001_init.sql'))
  await pg.exec(read('db/migrations/0002_vectors.sql'))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
}

async function boot(db) {
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 5).toString('base64'), __db: db }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const serverCall = async (url, init = {}) => {
    const headers = new Headers(init.headers || {})
    headers.set('cookie', cookie)
    if (init.method && init.method !== 'GET') headers.set('origin', 'https://example.com')
    return app.fetch(new Request(new URL(url, 'https://example.com/'), { method: init.method || 'GET', headers, body: init.body }), env)
  }
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  w.fetch = async (input, init = {}) => {
    const res = await serverCall(typeof input === 'string' ? input : input.url, init)
    return new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers })
  }
  const downloads = []
  Object.assign(w, {
    TextDecoder, TextEncoder, ReadableStream, TA_GEO: {}, scrollTo: () => {}, confirm: () => true,
    matchMedia: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
    marked: { parse: (t) => String(t), setOptions() {}, use() {}, Renderer: function () {} },
  })
  w.URL.createObjectURL = (blob) => { downloads.push(blob); return 'blob:x' }
  w.URL.revokeObjectURL = () => {}
  w.HTMLAnchorElement.prototype.click = function () {}
  w.HTMLElement.prototype.scrollIntoView = function () {}
  w.HTMLElement.prototype.scrollTo = function () {}
  const blobText = function () { return new Promise((res) => { const r = new w.FileReader(); r.onload = () => res(r.result); r.readAsText(this) }) }
  if (!w.Blob.prototype.text) w.Blob.prototype.text = blobText
  for (const f of ['i18n/zh-TW.js', 'i18n.js', 'app.js', 'prompts.js']) {
    if (fs.existsSync(path.join(root, 'public/assets', f))) w.eval(read('public/assets/' + f))
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'))
  w.dispatchEvent(new w.Event('load'))
  return { w, serverCall, downloads, $: (id) => w.document.getElementById(id) }
}

test('frontend phase 5: embeddings UI, key status, backup round trip', async () => {
  const original = globalThis.fetch
  const embedCalls = []
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    embedCalls.push(body)
    return Response.json({ data: body.input.map((t, i) => ({ index: i, embedding: /貓|feline/.test(t) ? [1, 0, 0] : [0, 1, 0] })) })
  }
  const db = await makeDb()
  const A = await boot(db)
  let B
  try {
    const json = (o) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) })
    const prov = await (await A.serverCall('/api/providers', json({ name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: 'sk-test-embed-key', models: ['gpt-4o-mini'] }))).json()
    await A.serverCall('/api/documents', json({ id: 'd1', title: '寵物', content: '家裡的貓很懶。' }))
    await A.serverCall('/api/documents', json({ id: 'd2', title: '天氣', content: '今天下雨。' }))
    await A.serverCall('/api/conversations', json({ id: 'c1', title: '測試對話', messages: [{ role: 'user', content: '你好' }, { role: 'assistant', content: '嗨' }] }))
    await A.serverCall('/api/memories', json({ id: 'm1', content: '使用者叫 Lord' }))
    await waitFor(() => A.$('settings-logout-btn'))
    await sleep(300)

    // 1) 供應商頁：設定嵌入模型 → 自動補建索引
    A.w.document.querySelector('[data-pane="pane-providers"]').click()
    await waitFor(() => A.$('embed-provider').options.length >= 2)
    assert.match(A.$('embed-status').textContent, /未設定/)
    A.$('embed-provider').value = prov.provider.id
    A.$('embed-model').value = 'text-embedding-3-small'
    A.$('embed-save-btn').click()
    await waitFor(() => /已索引 2 \/ 2/.test(A.$('embed-status').textContent))
    assert.match(A.$('embed-status').textContent, /3 維/)
    assert.equal(A.$('embed-run-btn').disabled, true)
    const res = await (await A.serverCall('/api/documents/search?q=feline')).json()
    assert.equal(res.mode, 'hybrid')
    assert.equal(res.results[0].document_id, 'd1')

    // 2) 資料頁：金鑰狀態、下載備份
    A.w.document.querySelector('[data-pane="pane-data"]').click()
    await waitFor(() => /目前金鑰版本 v1/.test(A.$('keys-status').textContent))
    assert.equal(A.$('rekey-btn').style.display, 'none')
    A.$('backup-download-btn').click()
    await waitFor(() => /備份完成/.test(A.$('backup-status').textContent))
    const backupText = await A.downloads[0].text()
    const backup = JSON.parse(backupText)
    assert.equal(backup.format, 'personal-ai-backup')
    assert.equal(backup.tables.documents.length, 2)
    assert.equal(backup.tables.messages.length, 2)
    assert.equal(backupText.includes('sk-test-embed-key'), false)

    // 3) 新的空資料庫：從備份還原
    const db2 = await makeDb()
    B = await boot(db2)
    await waitFor(() => B.$('settings-logout-btn'))
    await sleep(300)
    B.w.document.querySelector('[data-pane="pane-data"]').click()
    const input = B.$('backup-restore-input')
    const file = new B.w.File([backupText], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new B.w.Event('change'))
    await waitFor(() => /還原完成/.test(B.$('backup-status').textContent), 20000)
    assert.equal((await db2.query('SELECT count(*)::int n FROM messages'))[0].n, 2)
    assert.equal((await db2.query(`SELECT content FROM memories WHERE id = 'm1'`))[0].content, '使用者叫 Lord')
    // 嵌入設定隨 settings 還原 → 背景補建向量（供應商沒有 Key，但假上游不檢查）
    await waitFor(async () => (await db2.query('SELECT count(*)::int n FROM doc_chunks WHERE embedding IS NOT NULL'))[0].n === 2)
  } finally {
    globalThis.fetch = original
    A.w.close()
    if (B) B.w.close()
  }
})
