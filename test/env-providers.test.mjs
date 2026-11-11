// 環境變數供應商（PROVIDER_N_*）與「沒有內建供應商」：HTTP 層整合測試（PGlite + pgvector）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { vector } from '@electric-sql/pglite/vector'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { TABLE_ORDER } from '../src/backup.js'

const ORIGIN = 'https://example.com'
const sql = (f) => fs.readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8')

async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm, vector } })
  for (const f of ['0001_init.sql', '0002_vectors.sql', '0003_model_kinds.sql']) await pg.exec(sql(f))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
}

const ENV_KEY_CHAT = 'gsk_env_chat_secret_111'
const ENV_KEY_EMBED = 'cf_env_embed_secret_222'
const PROVIDER_ENV = {
  PROVIDER_1_NAME: 'Groq',
  PROVIDER_1_BASE_URL: 'https://api.groq.com/openai/v1',
  PROVIDER_1_API_KEY: ENV_KEY_CHAT,
  PROVIDER_1_MODELS: 'openai/gpt-oss-120b,openai/gpt-oss-20b',
  // 2 空號；3 只有嵌入模型
  PROVIDER_3_NAME: 'Cloudflare Workers AI',
  PROVIDER_3_BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1',
  PROVIDER_3_API_KEY: ENV_KEY_EMBED,
  PROVIDER_3_EMBED_MODELS: '@cf/baai/bge-m3',
  // 4 自建、無 Key，兩種都有
  PROVIDER_4_NAME: '自建閘道',
  PROVIDER_4_BASE_URL: 'https://llm.example.com/v1',
  PROVIDER_4_MODELS: 'qwen-local',
  PROVIDER_4_EMBED_MODELS: 'bge-local',
  // 6 網址不合法 → 略過
  PROVIDER_6_NAME: '內網',
  PROVIDER_6_BASE_URL: 'https://10.0.0.8/v1',
  PROVIDER_6_API_KEY: 'sk-should-not-leak-666',
}

async function client(db, extraEnv = {}) {
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), __db: db, ...extraEnv }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const raw = async (method, path, body) => {
    const headers = { cookie }
    if (method !== 'GET') headers.origin = ORIGIN
    if (body !== undefined) headers['content-type'] = 'application/json'
    return app.fetch(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env)
  }
  const call = async (method, path, body) => {
    const res = await raw(method, path, body)
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch {}
    return { status: res.status, data, text }
  }
  return { env, call }
}

function fakeEmbedding(text) {
  const t = String(text).toLowerCase()
  const v = [0.05, 0.05, 0.05, 0.05]
  if (/貓|cat|feline/.test(t)) v[0] = 1
  if (/車|car/.test(t)) v[1] = 1
  return v
}

// 攔截上游：/embeddings 回假向量、/chat/completions 回 SSE、/models 回清單
async function withUpstream(fn) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ url: u, body, auth: new Headers(init.headers).get('authorization') })
    if (u.endsWith('/embeddings')) return Response.json({ data: body.input.map((t, i) => ({ index: i, embedding: fakeEmbedding(t) })) })
    if (u.endsWith('/models')) return Response.json({ data: [{ id: 'openai/gpt-oss-120b' }, { id: 'whisper-large-v3' }] })
    return new Response('data: {"choices":[{"delta":{"content":"env 回覆"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  try { return await fn(calls) } finally { globalThis.fetch = original }
}

test('env providers are listed read-only, keys never reach the DB or any API response', async () => {
  const db = await makeDb()
  const { call } = await client(db, PROVIDER_ENV)
  await call('POST', '/api/providers', { name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: 'sk-db-secret-333', models: ['gpt-4o-mini'], embed_models: ['text-embedding-3-small'] })

  const list = await call('GET', '/api/providers')
  assert.equal(list.status, 200)
  const ids = list.data.providers.map((p) => p.id)
  assert.deepEqual(ids.slice(0, 3), ['env-1', 'env-3', 'env-4'])
  assert.equal(ids.includes('env-6'), false)
  assert.equal(list.data.providers.length, 4)
  const groq = list.data.providers[0]
  assert.equal(groq.readonly, true)
  assert.equal(groq.source, 'env')
  assert.equal(groq.note, '由環境變數管理')
  assert.equal(groq.has_key, true)
  assert.equal(groq.api_key_hint, '')
  assert.equal(list.data.providers[2].has_key, false) // 空 Key 允許
  assert.equal(list.data.providers[3].source, 'db')
  assert.deepEqual(list.data.env_errors.map((e) => e.index), [6])
  assert.match(list.data.env_errors[0].error, /主機/)

  const responses = [
    list.text,
    (await call('GET', '/api/models/grouped')).text,
    (await call('GET', '/api/me')).text,
    (await call('GET', '/api/embeddings/status')).text,
    (await call('GET', '/api/settings')).text,
    (await call('GET', '/api/config')).text,
  ]
  for (const t of TABLE_ORDER) responses.push((await call('GET', '/api/backup?table=' + t)).text)
  for (const text of responses) {
    for (const secret of [ENV_KEY_CHAT, ENV_KEY_EMBED, 'sk-should-not-leak', 'sk-db-secret']) assert.equal(text.includes(secret), false, secret)
  }
  const me = (await call('GET', '/api/me')).data.config
  assert.equal(me.env_providers, 3)
  for (const k of ['defaultProvider', 'defaultModel', 'embeddingBuiltin']) assert.equal(k in me, false, k)

  // 資料庫裡沒有任何環境變數供應商或其 Key
  const dump = JSON.stringify(await db.query('SELECT * FROM providers')) + JSON.stringify(await db.query('SELECT * FROM provider_models')) +
    JSON.stringify(await db.query('SELECT * FROM settings'))
  assert.equal(dump.includes(ENV_KEY_CHAT) || dump.includes(ENV_KEY_EMBED), false)
  assert.equal((await db.query(`SELECT count(*)::int n FROM providers WHERE id LIKE 'env-%'`))[0].n, 0)
})

test('chat and embedding model lists are separate', async () => {
  const db = await makeDb()
  const { call } = await client(db, PROVIDER_ENV)
  const prov = (await call('POST', '/api/providers', { name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: 'sk-x', models: ['gpt-4o-mini'], embed_models: ['text-embedding-3-small'] })).data.provider
  assert.deepEqual(prov.models.map((m) => m.model_id), ['gpt-4o-mini'])
  assert.deepEqual(prov.embed_models.map((m) => m.model_id), ['text-embedding-3-small'])
  // 同一個 id 可以同時是聊天與嵌入模型
  await call('PUT', `/api/providers/${prov.id}/models`, { embed_models: ['text-embedding-3-small', 'gpt-4o-mini'] })

  const groups = (await call('GET', '/api/models/grouped')).data.groups
  assert.deepEqual(groups.map((g) => g.provider.id), ['env-1', 'env-4', prov.id]) // env-3 只有嵌入模型 → 不在聊天選單
  assert.deepEqual(groups[0].models.map((m) => m.id), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
  assert.deepEqual(groups[1].models.map((m) => m.id), ['qwen-local'])
  assert.deepEqual(groups[2].models.map((m) => m.id), ['gpt-4o-mini'])
  const allChat = groups.flatMap((g) => g.models.map((m) => m.id))
  for (const e of ['@cf/baai/bge-m3', 'bge-local', 'text-embedding-3-small']) assert.equal(allChat.includes(e), false, e)

  const options = (await call('GET', '/api/embeddings/status')).data.status.options
  const byId = Object.fromEntries(options.map((o) => [o.provider.id, o.models]))
  assert.deepEqual(byId['env-1'], [])
  assert.deepEqual(byId['env-3'], ['@cf/baai/bge-m3'])
  assert.deepEqual(byId['env-4'], ['bge-local'])
  assert.deepEqual(byId[prov.id], ['text-embedding-3-small', 'gpt-4o-mini'])
  // 只改嵌入清單不動聊天清單
  const after = (await call('GET', '/api/providers')).data.providers.find((p) => p.id === prov.id)
  assert.deepEqual(after.models.map((m) => m.model_id), ['gpt-4o-mini'])
})

test('chat: no default model → asks to pick; env-N provider works with the env key; panel default is used', async () => {
  const db = await makeDb()
  const none = await client(await makeDb(), { GROQ_API_KEY: 'gsk_legacy', GROQ_MODEL: 'x' })
  const r0 = await none.call('POST', '/api/chat', { prompt: '你好' })
  assert.equal(r0.status, 400)
  assert.equal(r0.data.error, '請先在設定中新增供應商並選擇模型')

  const { call } = await client(db, PROVIDER_ENV)
  // 有環境變數供應商但沒選模型 → 仍不自動挑
  const r1 = await call('POST', '/api/chat', { prompt: '你好' })
  assert.equal(r1.status, 400)
  assert.equal(r1.data.error, '請先在設定中新增供應商並選擇模型')

  await withUpstream(async (calls) => {
    const r = await call('POST', '/api/chat', { prompt: '你好', provider_id: 'env-1', model: 'openai/gpt-oss-20b' })
    assert.equal(r.status, 200)
    assert.match(r.text, /env 回覆/)
    assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions')
    assert.equal(calls[0].auth, `Bearer ${ENV_KEY_CHAT}`)
    assert.equal(calls[0].body.model, 'openai/gpt-oss-20b')

    // 無 Key 的環境變數供應商不帶 Authorization
    await call('POST', '/api/chat', { prompt: 'hi', provider_id: 'env-4', model: 'qwen-local' })
    assert.equal(calls[1].url, 'https://llm.example.com/v1/chat/completions')
    assert.equal(calls[1].auth, null)

    // 設定面板選的預設模型（active_provider_id + active_model_id）在請求沒帶供應商時使用
    await call('PUT', '/api/settings', { settings: { active_provider_id: 'env-1', active_model_id: 'openai/gpt-oss-120b' } })
    const r2 = await call('POST', '/api/chat', { prompt: '用預設' })
    assert.equal(r2.status, 200)
    assert.equal(calls[2].body.model, 'openai/gpt-oss-120b')
    assert.equal(calls[2].auth, `Bearer ${ENV_KEY_CHAT}`)

    // 模型探索可用環境變數 Key（Key 不回傳）
    const d = await call('POST', '/api/providers/env-1/discover', {})
    assert.equal(d.status, 200)
    assert.deepEqual(d.data.models, ['openai/gpt-oss-120b', 'whisper-large-v3'])
    assert.equal(calls[3].auth, `Bearer ${ENV_KEY_CHAT}`)
    assert.equal(d.text.includes(ENV_KEY_CHAT), false)
  })

  // 不存在 / 設定錯誤的 env 編號
  const bad = await call('POST', '/api/chat', { prompt: 'x', provider_id: 'env-6', model: 'm' })
  assert.equal(bad.status, 400)
  assert.match(bad.data.error, /環境變數/)
})

test('env providers cannot be edited, deleted or shadowed through the API', async () => {
  const db = await makeDb()
  const { call } = await client(db, PROVIDER_ENV)
  for (const [method, path, body] of [
    ['PATCH', '/api/providers/env-1', { name: 'hacked', base_url: 'https://evil.example.com/v1' }],
    ['DELETE', '/api/providers/env-1', undefined],
    ['PUT', '/api/providers/env-1/models', { models: ['x'] }],
  ]) {
    const r = await call(method, path, body)
    assert.equal(r.status, 403, `${method} ${path}`)
    assert.equal(r.data.code, 'env_provider_readonly')
    assert.match(r.data.error, /環境變數/)
  }
  // 建立時不能搶用 env- 開頭的 id
  const created = (await call('POST', '/api/providers', { id: 'env-1', name: 'Fake', base_url: 'https://fake.example.com/v1', models: ['m'] })).data.provider
  assert.notEqual(created.id, 'env-1')
  const env1 = (await call('GET', '/api/providers')).data.providers.find((p) => p.id === 'env-1')
  assert.equal(env1.name, 'Groq')
  assert.equal(env1.base_url, 'https://api.groq.com/openai/v1')
})

test('embeddings: off by default, on with an env-N EMBED model, reset turns it off', async () => {
  const db = await makeDb()
  const { call } = await client(db, PROVIDER_ENV)
  await call('POST', '/api/documents', { id: 'd_cat', title: '寵物筆記', content: '我家的貓喜歡曬太陽。' })
  await call('POST', '/api/documents', { id: 'd_car', title: '交通', content: '這台車每公里耗油不多。' })

  let st = (await call('GET', '/api/embeddings/status')).data.status
  assert.equal(st.configured, false)
  assert.equal('builtin' in st, false)
  assert.equal('default' in st, false)
  assert.equal(st.pending, 0)
  let r = await call('GET', '/api/documents/search?q=feline')
  assert.equal(r.data.mode, 'keyword')
  assert.equal((await call('POST', '/api/embeddings/backfill', {})).status, 400)

  await withUpstream(async (calls) => {
    const cfg = await call('PUT', '/api/embeddings/config', { provider_id: 'env-3', model: '@cf/baai/bge-m3' })
    assert.equal(cfg.status, 200)
    assert.deepEqual(cfg.data.config, { provider_id: 'env-3', model: '@cf/baai/bge-m3', dims: 4 })
    assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1/embeddings')
    assert.equal(calls[0].auth, `Bearer ${ENV_KEY_EMBED}`)
    assert.equal(calls[0].body.model, '@cf/baai/bge-m3')
    const bf = await call('POST', '/api/embeddings/backfill', {})
    assert.equal(bf.data.done, 2)
    r = await call('GET', '/api/documents/search?q=feline')
    assert.equal(r.data.mode, 'hybrid')
    assert.equal(r.data.results[0].document_id, 'd_cat')
  })
  const dump = JSON.stringify(await db.query('SELECT * FROM settings'))
  assert.equal(dump.includes(ENV_KEY_EMBED), false)
  assert.ok(dump.includes('env-3'))

  // reset → 清除，回到關閉（不是回到某個預設）
  const reset = await call('PUT', '/api/embeddings/config', { reset: true })
  assert.equal(reset.status, 200)
  assert.equal(reset.data.config, null)
  st = reset.data.status
  assert.equal(st.configured, false)
  assert.equal((await db.query(`SELECT count(*)::int n FROM settings WHERE key = 'embedding'`))[0].n, 0)
  r = await call('GET', '/api/documents/search?q=' + encodeURIComponent('耗油'))
  assert.equal(r.data.mode, 'keyword')

  // 空 provider_id 也是關閉
  await withUpstream(async () => { await call('PUT', '/api/embeddings/config', { provider_id: 'env-4', model: 'bge-local' }) })
  assert.equal((await call('GET', '/api/embeddings/status')).data.status.configured, true)
  await call('PUT', '/api/embeddings/config', { provider_id: null })
  assert.equal((await call('GET', '/api/embeddings/status')).data.status.configured, false)
  // 有供應商但沒填模型 → 錯誤
  assert.equal((await call('PUT', '/api/embeddings/config', { provider_id: 'env-3' })).status, 400)
})

test('backup excludes env providers and restore never creates them', async () => {
  const src = await makeDb()
  const A = await client(src, PROVIDER_ENV)
  const prov = (await A.call('POST', '/api/providers', { name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: 'sk-db', models: ['gpt-4o-mini'], embed_models: ['text-embedding-3-small'] })).data.provider
  const providers = (await A.call('GET', '/api/backup?table=providers')).data.rows
  assert.deepEqual(providers.map((p) => p.id), [prov.id])
  const models = (await A.call('GET', '/api/backup?table=provider_models')).data.rows
  assert.deepEqual(models.map((m) => [m.kind, m.model_id]).sort(), [['chat', 'gpt-4o-mini'], ['embed', 'text-embedding-3-small']])

  const dst = await makeDb()
  const B = await client(dst) // 沒有環境變數供應商
  const forged = [...providers, { id: 'env-1', name: 'Groq', base_url: 'https://api.groq.com/openai/v1' }, { id: 'env-9', name: 'X', base_url: 'https://x.example.com/v1' }]
  const r = await B.call('POST', '/api/backup/restore', { table: 'providers', rows: forged })
  assert.equal(r.data.restored, 1)
  // 0003 之前的備份沒有 kind → 視為聊天模型
  const legacyModels = [...models, { provider_id: prov.id, model_id: 'gpt-legacy', display_name: null, enabled: true, sort_order: 5, created_at: models[0].created_at }, { provider_id: 'env-1', model_id: 'm', kind: 'chat' }]
  const rm = await B.call('POST', '/api/backup/restore', { table: 'provider_models', rows: legacyModels })
  assert.equal(rm.data.restored, 3)
  assert.equal((await dst.query(`SELECT count(*)::int n FROM providers WHERE id LIKE 'env-%'`))[0].n, 0)
  const list = (await B.call('GET', '/api/providers')).data.providers
  assert.deepEqual(list.map((p) => p.id), [prov.id])
  assert.deepEqual(list[0].models.map((m) => m.model_id).sort(), ['gpt-4o-mini', 'gpt-legacy'])
  assert.deepEqual(list[0].embed_models.map((m) => m.model_id), ['text-embedding-3-small'])
  // 重複還原 → 冪等
  await B.call('POST', '/api/backup/restore', { table: 'provider_models', rows: legacyModels })
  assert.equal((await dst.query('SELECT count(*)::int n FROM provider_models'))[0].n, 3)
})
