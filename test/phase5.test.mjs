// 第五階段：pgvector 混合檢索、金鑰輪替、備份匯出與還原。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { vector } from '@electric-sql/pglite/vector'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { rrfMerge, toVectorLiteral, embeddingsUrl } from '../src/embeddings.js'
import { keyStatus, rekeyProviders, providerCredentials } from '../src/repo/providers.js'
import { TABLE_ORDER } from '../src/backup.js'

const ORIGIN = 'https://example.com'
const sql = (f) => fs.readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8')

async function makeDb({ vectors = true } = {}) {
  const pg = new PGlite({ extensions: { pg_trgm, vector } })
  await pg.exec(sql('0001_init.sql'))
  if (vectors) await pg.exec(sql('0002_vectors.sql'))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
}

async function client(db, extraEnv = {}) {
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), __db: db, ...extraEnv }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const call = async (method, path, body) => {
    const headers = { cookie }
    if (method !== 'GET') headers.origin = ORIGIN
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await app.fetch(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env)
    return { status: res.status, data: await res.json() }
  }
  return { env, call }
}

// 假嵌入模型：依概念給向量，讓「feline」能找到中文「貓」的段落（關鍵字做不到）
function fakeEmbedding(text) {
  const t = String(text).toLowerCase()
  const v = [0.05, 0.05, 0.05, 0.05]
  if (/貓|cat|feline|kitten/.test(t)) v[0] = 1
  if (/車|car|automobile|vehicle/.test(t)) v[1] = 1
  if (/預算|budget|cost/.test(t)) v[2] = 1
  return v
}

async function withEmbeddings(fn, { fail = false } = {}) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body, auth: new Headers(init.headers).get('authorization') })
    if (fail) return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 })
    return Response.json({ data: body.input.map((t, i) => ({ index: i, embedding: fakeEmbedding(t) })) })
  }
  try { return await fn(calls) } finally { globalThis.fetch = original }
}

test('helpers: vector literal, embeddings URL, RRF', () => {
  assert.equal(toVectorLiteral([1, 0.5, -2]), '[1,0.5,-2]')
  assert.throws(() => toVectorLiteral([1, NaN]))
  assert.throws(() => toVectorLiteral([]))
  assert.equal(embeddingsUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1/embeddings')
  const merged = rrfMerge([
    [{ document_id: 'a', chunk_index: 0 }, { document_id: 'b', chunk_index: 0 }],
    [{ document_id: 'b', chunk_index: 0, similarity: 0.9 }, { document_id: 'c', chunk_index: 0, similarity: 0.5 }],
  ], 3)
  assert.equal(merged[0].document_id, 'b') // 兩邊都有 → 排第一
  assert.equal(merged.length, 3)
})

test('hybrid search: config, backfill, semantic hit, fallback', async () => {
  const db = await makeDb()
  const { call } = await client(db)
  const prov = (await call('POST', '/api/providers', { name: 'Embed', base_url: 'https://embed.example.com/v1', api_key: 'sk-embed-secret-123', models: ['emb-small'] })).data.provider
  await call('POST', '/api/documents', { id: 'd_cat', title: '寵物筆記', content: '我家的貓喜歡曬太陽，每天睡十四個小時。' })
  await call('POST', '/api/documents', { id: 'd_car', title: '交通', content: '這台車每公里耗油不多。' })
  await call('POST', '/api/documents', { id: 'd_misc', title: '雜記', content: '今天天氣晴朗。' })

  // 未設定：純關鍵字
  let r = await call('GET', '/api/documents/search?q=feline')
  assert.equal(r.data.mode, 'keyword')
  assert.equal(r.data.results.length, 0)
  let st = (await call('GET', '/api/embeddings/status')).data.status
  assert.equal(st.vector_available, true)
  assert.equal(st.configured, false)
  assert.equal(st.total, 3)

  await withEmbeddings(async (calls) => {
    const cfg = await call('PUT', '/api/embeddings/config', { provider_id: prov.id, model: 'emb-small' })
    assert.equal(cfg.status, 200)
    assert.equal(cfg.data.config.dims, 4)
    assert.equal(calls[0].url, 'https://embed.example.com/v1/embeddings')
    assert.equal(calls[0].auth, 'Bearer sk-embed-secret-123') // Key 由伺服器解密帶上
    assert.equal(cfg.data.status.pending, 3)

    const bf = await call('POST', '/api/embeddings/backfill', {})
    assert.equal(bf.data.done, 3)
    assert.equal(bf.data.remaining, 0)

    r = await call('GET', '/api/documents/search?q=feline')
    assert.equal(r.data.mode, 'hybrid')
    assert.equal(r.data.results[0].document_id, 'd_cat')
    assert.ok(r.data.results[0].similarity > 0.9)
    // 關鍵字命中仍然有效
    r = await call('GET', '/api/documents/search?q=' + encodeURIComponent('耗油'))
    assert.equal(r.data.results[0].document_id, 'd_car')

    // 文件內容更新 → 舊向量清掉，待補
    await call('PATCH', '/api/documents/d_misc', { content: 'automobile 保養紀錄' })
    st = (await call('GET', '/api/embeddings/status')).data.status
    assert.equal(st.pending, 1)
    await call('POST', '/api/embeddings/backfill', {})
    // 換模型 → 全部待補
    await call('PUT', '/api/embeddings/config', { provider_id: prov.id, model: 'emb-large' })
    st = (await call('GET', '/api/embeddings/status')).data.status
    assert.equal(st.pending, 3)
    // 換了模型但未補：舊模型向量不會被拿來比
    r = await call('GET', '/api/documents/search?q=feline')
    assert.equal(r.data.results.length, 0)
  })

  // 嵌入 API 失敗 → 退回關鍵字，不讓檢索整個失敗
  await withEmbeddings(async () => {
    r = await call('GET', '/api/documents/search?q=' + encodeURIComponent('耗油'))
    assert.equal(r.status, 200)
    assert.equal(r.data.mode, 'keyword')
    assert.match(r.data.vector_error, /404/)
    assert.equal(r.data.results[0].document_id, 'd_car')
    const bad = await call('PUT', '/api/embeddings/config', { provider_id: prov.id, model: 'nope' })
    assert.equal(bad.status, 400)
  }, { fail: true })

  // 關閉
  const off = await call('PUT', '/api/embeddings/config', { provider_id: null })
  assert.equal(off.data.config, null)
  assert.equal(off.data.status.configured, false)
})

test('embedding config rejected when pgvector migration is missing', async () => {
  const db = await makeDb({ vectors: false })
  const { call } = await client(db)
  const prov = (await call('POST', '/api/providers', { name: 'E', base_url: 'https://embed.example.com/v1', models: ['e'] })).data.provider
  const r = await call('PUT', '/api/embeddings/config', { provider_id: prov.id, model: 'e' })
  assert.equal(r.status, 400)
  assert.match(r.data.error, /0002/)
  assert.equal((await call('GET', '/api/documents/search?q=x')).status, 200)
})

test('key rotation: re-encrypt providers with the new key', async () => {
  const db = await makeDb({ vectors: false })
  const oldKey = Buffer.alloc(32, 1).toString('base64')
  const newKey = Buffer.alloc(32, 2).toString('base64')
  const v1 = await client(db, { ENCRYPTION_KEY: oldKey, KEY_VERSION: 'v1' })
  const a = (await v1.call('POST', '/api/providers', { name: 'A', base_url: 'https://a.example.com/v1', api_key: 'sk-aaaaaaaaaaaa' })).data.provider
  const b = (await v1.call('POST', '/api/providers', { name: 'B', base_url: 'https://b.example.com/v1', api_key: 'sk-bbbbbbbbbbbb' })).data.provider
  await v1.call('POST', '/api/providers', { name: 'NoKey', base_url: 'https://c.example.com/v1' })

  const rotated = { ENCRYPTION_KEY: newKey, KEY_VERSION: 'v2', ENCRYPTION_KEY_PREVIOUS: oldKey, KEY_VERSION_PREVIOUS: 'v1' }
  const v2 = await client(db, rotated)
  let ks = (await v2.call('GET', '/api/admin/keys')).data.keys
  assert.deepEqual(ks.versions, { v1: 2 })
  assert.equal(ks.outdated, 2)
  // 輪替期間舊密文仍可解
  assert.equal((await providerCredentials(db, v2.env, a.id)).apiKey, 'sk-aaaaaaaaaaaa')

  const r = (await v2.call('POST', '/api/admin/rekey', {})).data
  assert.equal(r.rekeyed, 2)
  assert.deepEqual(r.failed, [])
  assert.deepEqual(r.keys.versions, { v2: 2 })
  assert.equal(r.keys.outdated, 0)
  // 移除 PREVIOUS 後仍可解；舊金鑰已解不開
  const only = { ...v2.env, ENCRYPTION_KEY_PREVIOUS: undefined, KEY_VERSION_PREVIOUS: undefined }
  assert.equal((await providerCredentials(db, only, b.id)).apiKey, 'sk-bbbbbbbbbbbb')
  await assert.rejects(providerCredentials(db, v1.env, b.id))
  // 冪等
  assert.equal((await rekeyProviders(db, v2.env)).rekeyed, 0)
  // 缺舊金鑰時：回報失敗、不動資料
  const db2 = await makeDb({ vectors: false })
  const w1 = await client(db2, { ENCRYPTION_KEY: oldKey, KEY_VERSION: 'v1' })
  await w1.call('POST', '/api/providers', { name: 'A', base_url: 'https://a.example.com/v1', api_key: 'sk-aaaaaaaaaaaa' })
  const noPrev = { ...w1.env, ENCRYPTION_KEY: newKey, KEY_VERSION: 'v2' }
  const r2 = await rekeyProviders(db2, noPrev)
  assert.equal(r2.rekeyed, 0)
  assert.equal(r2.failed.length, 1)
  assert.deepEqual((await keyStatus(db2, noPrev)).unreadable, ['v1'])
})

test('backup: paged export without secrets, restore into empty database', async () => {
  const src = await makeDb()
  const A = await client(src)
  await A.call('POST', '/api/projects', { id: 'p1', name: '旅行', instructions: '用台灣用語' })
  const prov = (await A.call('POST', '/api/providers', { name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: 'sk-very-secret-key-1', models: ['gpt-4o-mini', 'gpt-4o'] })).data.provider
  await A.call('PUT', '/api/settings', { settings: { tone: 'direct', 'ui.theme': 'dark' } })
  await A.call('PUT', '/api/profile', { profile: { name: 'Lord' } })
  const big = '京都嵐山竹林。'.repeat(120_000) // 約 840k 字、2.5 MB
  await A.call('POST', '/api/documents', { id: 'd_big', title: '大文件', content: big, project_id: 'p1' })
  await A.call('POST', '/api/documents', { id: 'd_big2', title: '大文件二', content: big.replace(/京都/g, '奈良') })
  await A.call('POST', '/api/documents', { id: 'd_small', title: '小', content: '貓' })
  await A.call('POST', '/api/documents', { id: 'd_gone', title: '已刪', content: 'x' })
  await A.call('DELETE', '/api/documents/d_gone')
  await A.call('POST', '/api/conversations', { id: 'c1', title: '行程', project_id: 'p1', messages: [{ role: 'user', content: '去哪裡' }, { role: 'assistant', content: '嵐山' }] })
  await A.call('POST', '/api/skills', { id: 's1', name: '翻譯', instructions: '翻成英文', trigger_mode: 'keyword', keywords: ['翻譯', 'translate'] })
  await A.call('POST', '/api/memories', { id: 'm1', content: '使用者叫 Lord', pinned: true, project_id: 'p1' })
  await A.call('POST', '/api/prompts', { content: '幫我摘要', kind: 'favorite' })

  const meta = (await A.call('GET', '/api/backup')).data
  assert.deepEqual(meta.tables, TABLE_ORDER)
  const backup = {}
  let pages = 0
  for (const table of meta.tables) {
    backup[table] = []
    let cursor = ''
    do {
      const page = (await A.call('GET', `/api/backup?table=${table}&cursor=${encodeURIComponent(cursor)}`)).data
      backup[table].push(...page.rows)
      cursor = page.next_cursor
      pages++
    } while (cursor)
  }
  const text = JSON.stringify(backup)
  assert.equal(text.includes('sk-very-secret'), false)
  assert.equal(text.includes('api_key_enc'), false)
  assert.equal(backup.documents.some((d) => d.id === 'd_gone'), false)
  assert.equal(backup.documents.find((d) => d.id === 'd_big').content.length, big.length)
  assert.equal(backup.messages.length, 2)
  assert.equal(backup.provider_models.length, 2)
  assert.ok(pages > meta.tables.length) // documents 至少分兩頁（每頁 ≤ 3.5 MB）

  // 還原到空資料庫（模擬換一個 Neon 專案）
  const dst = await makeDb()
  const B = await client(dst)
  for (const table of meta.tables) {
    const r = await B.call('POST', '/api/backup/restore', { table, rows: backup[table] })
    assert.equal(r.status, 200, table + ' ' + JSON.stringify(r.data))
  }
  const conv = (await B.call('GET', '/api/conversations/c1')).data.conversation
  assert.equal(conv.messages.length, 2)
  assert.equal(conv.project_id, 'p1')
  const sk = (await B.call('GET', '/api/skills/s1')).data.item
  assert.deepEqual(sk.keywords, ['翻譯', 'translate'])
  assert.equal((await B.call('GET', '/api/settings')).data.settings.tone, 'direct')
  assert.equal((await B.call('GET', '/api/profile')).data.profile.name, 'Lord')
  // 知識庫重新切塊、可檢索
  const hits = (await B.call('GET', '/api/documents/search?q=' + encodeURIComponent('京都嵐山'))).data.results
  assert.equal(hits[0].document_id, 'd_big')
  // 供應商還原但沒有 Key（需重新輸入）
  const provs = (await B.call('GET', '/api/providers')).data.providers
  const p = provs.find((x) => x.id === prov.id)
  assert.ok(p)
  assert.equal(p.has_key, false)
  // 重複還原 → 冪等，不重複訊息
  await B.call('POST', '/api/backup/restore', { table: 'messages', rows: backup.messages })
  assert.equal((await dst.query('SELECT count(*)::int n FROM messages'))[0].n, 2)
  // 不能把訊息塞進別人的對話 / 未知資料表
  const r1 = await B.call('POST', '/api/backup/restore', { table: 'messages', rows: [{ conversation_id: 'nope', seq: 1, role: 'user', content: 'x' }] })
  assert.equal(r1.data.restored, 0)
  assert.equal((await B.call('POST', '/api/backup/restore', { table: 'login_attempts', rows: [] })).status, 400)
})
