// 以 PGlite（WASM 版 PostgreSQL）跑真正的 SQL：驗證 schema、Repository 與 HTTP 路由。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { decryptSecret, encryptSecret } from '../src/crypto.js'
import {
  createProvider, groupedModels, listProviders, providerCredentials, resolveChatProvider, updateProvider, deleteProvider,
} from '../src/repo/providers.js'
import { searchTerms, chunkText, createEntity, listEntities, searchDocuments, updateEntity, putSettings, getSettings } from '../src/repo/entities.js'
import { appendMessages, getConversation, upsertConversation, listConversations } from '../src/repo/conversations.js'
import { loginAllowed, recordLoginFailure } from '../src/repo/login.js'
import { parseD1Export, planImport, runImport } from '../src/migrate/d1.js'

const KEY = Buffer.alloc(32, 7).toString('base64')
const baseEnv = {
  APP_PASSWORD: 'pw-correct-horse',
  AUTH_SECRET: 'test-secret-that-is-long-enough-123456',
  ENCRYPTION_KEY: KEY,
}

async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm } })
  await pg.exec(fs.readFileSync(new URL('../db/migrations/0001_init.sql', import.meta.url), 'utf8'))
  await pg.exec(fs.readFileSync(new URL('../db/migrations/0003_model_kinds.sql', import.meta.url), 'utf8'))
  return {
    pg,
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (statements) => pg.transaction(async (t) => {
      const out = []
      for (const [text, params] of statements) out.push((await t.query(text, params || [])).rows)
      return out
    }),
  }
}

const db = await makeDb()
const env = { ...baseEnv, __db: db }

test('AES-GCM round trip, AAD binding and tamper detection', async () => {
  const { value } = await encryptSecret('sk-live-abcdef123456', 'provider:owner:a', baseEnv)
  assert.match(value, /^v1\.[\w-]+\.[\w-]+$/)
  assert.equal(await decryptSecret(value, 'provider:owner:a', baseEnv), 'sk-live-abcdef123456')
  await assert.rejects(() => decryptSecret(value, 'provider:owner:b', baseEnv), /解密失敗/)
  const parts = value.split('.')
  parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith('AA') ? 'BB' : 'AA')
  await assert.rejects(() => decryptSecret(parts.join('.'), 'provider:owner:a', baseEnv), /解密失敗/)
  await assert.rejects(() => encryptSecret('x', 'a', {}), /ENCRYPTION_KEY/)
})

test('key rotation: previous key still decrypts', async () => {
  const oldEnv = { ENCRYPTION_KEY: KEY, KEY_VERSION: 'v1' }
  const { value } = await encryptSecret('secret', 'aad', oldEnv)
  const rotated = { ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'), KEY_VERSION: 'v2', ENCRYPTION_KEY_PREVIOUS: KEY, KEY_VERSION_PREVIOUS: 'v1' }
  assert.equal(await decryptSecret(value, 'aad', rotated), 'secret')
})

test('providers: encrypted key never returned, empty-key provider allowed, models grouped', async () => {
  const p = await createProvider(db, env, { name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: 'sk-test-0000-9999', models: ['gpt-x', 'gpt-y'] })
  assert.equal(p.has_key, true)
  assert.equal(p.api_key_hint, '••••9999')
  assert.equal(JSON.stringify(p).includes('sk-test'), false)
  const raw = (await db.query('SELECT api_key_enc FROM providers WHERE id = $1', [p.id]))[0]
  assert.ok(raw.api_key_enc && !raw.api_key_enc.includes('sk-test'))

  const local = await createProvider(db, env, { name: '自建 vLLM', base_url: 'https://llm.example.com/v1', api_key: '', models: [{ model_id: 'qwen-local', display_name: 'Qwen 本地' }] })
  assert.equal(local.has_key, false)

  const cred = await providerCredentials(db, env, p.id)
  assert.equal(cred.apiKey, 'sk-test-0000-9999')
  assert.equal((await providerCredentials(db, env, local.id)).apiKey, '')

  // 沒有內建組：舊 GROQ_API_KEY 無作用；環境變數供應商（有聊天模型才出現）在前
  assert.deepEqual((await groupedModels(db, { ...env, GROQ_API_KEY: 'gsk_x' })).map((g) => g.provider.name), ['OpenAI', '自建 vLLM'])
  const envWith = { ...env, PROVIDER_2_NAME: 'Env Chat', PROVIDER_2_BASE_URL: 'https://env.example.com/v1', PROVIDER_2_MODELS: 'env-m',
    PROVIDER_5_NAME: 'Env Embed only', PROVIDER_5_BASE_URL: 'https://emb.example.com/v1', PROVIDER_5_EMBED_MODELS: 'emb-1' }
  const groups = await groupedModels(db, envWith)
  const names = groups.map((g) => g.provider.name)
  assert.deepEqual(names, ['Env Chat', 'OpenAI', '自建 vLLM'])
  assert.equal(groups[0].provider.id, 'env-2')
  assert.equal(groups[0].provider.readonly, true)
  assert.deepEqual(groups[2].models, [{ id: 'qwen-local', name: 'Qwen 本地' }])
  assert.equal((await listProviders(db, envWith)).find((p) => p.id === 'env-5').embed_models[0].model_id, 'emb-1')

  // 未帶 api_key 的更新保留原 Key；clear_key 清除
  await updateProvider(db, env, p.id, { name: 'OpenAI 2' })
  assert.equal((await providerCredentials(db, env, p.id)).apiKey, 'sk-test-0000-9999')
  await updateProvider(db, env, p.id, { api_key: '', clear_key: true })
  assert.equal((await providerCredentials(db, env, p.id)).apiKey, '')

  const r = await resolveChatProvider(db, { provider_id: local.id, model: 'qwen-local' }, env)
  assert.equal(r.baseUrl, 'https://llm.example.com/v1')
  await assert.rejects(() => createProvider(db, env, { name: 'bad', base_url: 'http://insecure.example.com' }), /HTTPS/)

  assert.equal(await deleteProvider(db, p.id), true)
  assert.equal((await listProviders(db, env)).some((x) => x.id === p.id), false)
})

test('documents are chunked and searchable in Chinese via pg_trgm', async () => {
  assert.equal(chunkText('a'.repeat(3000)).length > 2, true)
  assert.deepEqual(searchTerms('嵐山竹林 Netlify'), ['netlify', '嵐山', '山竹', '竹林'])
  await createEntity(db, 'documents', { id: 'doc1', title: '旅遊計畫', content: '東京與京都五天行程，第三天去嵐山看竹林。' })
  await createEntity(db, 'documents', { id: 'doc2', title: '工作筆記', content: 'Quarterly planning meeting notes about the Netlify migration.' })
  let hits = await searchDocuments(db, '嵐山竹林')
  assert.equal(hits[0].document_id, 'doc1')
  hits = await searchDocuments(db, 'netlify migration')
  assert.equal(hits[0].document_id, 'doc2')
  await updateEntity(db, 'documents', 'doc1', { content: '改成大阪行程' })
  assert.equal((await searchDocuments(db, '嵐山竹林')).length, 0)
  const list = await listEntities(db, 'documents', {})
  assert.ok(list[0].preview !== undefined && list[0].content === undefined)
})

test('conversations: upsert with messages, append, list', async () => {
  await createEntity(db, 'projects', { id: 'proj1', name: '網站上線' })
  await upsertConversation(db, { id: 'c1', title: '測試', project_id: 'proj1', messages: [{ role: 'user', content: '你好', at: 1700000000000 }, { role: 'ai', content: '嗨', sources: [{ url: 'https://a' }] }] })
  const r = await appendMessages(db, 'c1', [{ role: 'user', content: '再一次' }, { role: 'assistant', content: '好' }])
  assert.equal(r.from_seq, 2)
  const c = await getConversation(db, 'c1')
  assert.deepEqual(c.messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant'])
  assert.equal(c.messages[1].sources[0].url, 'https://a')
  const list = await listConversations(db, { projectId: 'proj1' })
  assert.equal(list[0].message_count, 4)
})

test('settings, skills and memories', async () => {
  const s = await putSettings(db, { theme: 'dark', active_model: { provider_id: 'x', model_id: 'y' } })
  assert.equal(s.theme, 'dark')
  await putSettings(db, { theme: null })
  assert.equal((await getSettings(db)).theme, undefined)
  await assert.rejects(() => putSettings(db, { 'Bad Key': 1 }), /設定鍵/)
  const skill = await createEntity(db, 'skills', { name: '翻譯', instructions: '翻成英文', trigger_mode: 'keyword', keywords: ['翻譯'] })
  assert.deepEqual(skill.keywords, ['翻譯'])
  await createEntity(db, 'memories', { content: '使用者偏好繁體中文', kind: 'preference', pinned: true })
  assert.equal((await listEntities(db, 'memories', { q: '繁體' })).length, 1)
  await assert.rejects(() => createEntity(db, 'memories', { content: '' }), /缺少欄位/)
})

test('login throttling persists in the database', async () => {
  const req = new Request('https://example.com/api/login', { headers: { 'x-nf-client-connection-ip': '203.0.113.9' } })
  for (let i = 0; i < 5; i++) await recordLoginFailure(db, req, env)
  assert.equal(await loginAllowed(db, req, env), false)
  const other = new Request('https://example.com/api/login', { headers: { 'x-nf-client-connection-ip': '203.0.113.10' } })
  assert.equal(await loginAllowed(db, other, env), true)
})

test('D1 import maps legacy sync_items', async () => {
  const exportJson = [{ results: [
    { owner_id: 'owner', item_key: 'project:p_1', value: JSON.stringify({ id: 'p_1', name: '舊專案', description: 'd', instructions: 'i', role: 'dev' }), updated_at: 1, deleted: 0 },
    { owner_id: 'owner', item_key: 'doc:d_1', value: JSON.stringify({ id: 'd_1', title: '筆記', content: '舊知識庫內容', type: 'note', projectId: 'p_1' }), updated_at: 2, deleted: 0 },
    { owner_id: 'owner', item_key: 'chat:k1', value: JSON.stringify({ title: '舊對話', projectId: 'p_missing', pinned: true, messages: [{ role: 'user', content: 'hi', at: 1 }, { role: 'ai', content: 'yo', at: 2 }] }), updated_at: 3, deleted: 0 },
    { owner_id: 'owner', item_key: 'chat:gone', value: '', updated_at: 4, deleted: 1 },
    { owner_id: 'owner', item_key: 'prompt:favs', value: JSON.stringify(['寫一首詩', { text: '摘要這篇' }]), updated_at: 5, deleted: 0 },
    { owner_id: 'owner', item_key: 'setting:tone', value: 'warm', updated_at: 6, deleted: 0 },
  ] }]
  const plan = planImport(parseD1Export(exportJson))
  const result = await runImport(db, plan)
  assert.deepEqual([result.projects, result.documents, result.conversations, result.settings], [1, 1, 1, 2])
  assert.equal(JSON.parse((await getSettings(db)).prompt_favs)[0], '寫一首詩')
  const conv = await getConversation(db, 'k1')
  assert.equal(conv.project_id, null) // 指向不存在的專案 → 設為 NULL
  assert.equal(conv.pinned, true)
  assert.equal((await searchDocuments(db, '舊知識庫'))[0].document_id, 'd_1')
  assert.equal((await db.query('SELECT count(*)::int AS n FROM legacy_sync_items'))[0].n, 6)
  // 可重跑
  await runImport(db, plan)
  assert.equal((await getConversation(db, 'k1')).messages.length, 2)
})

test('HTTP: data API requires login and never leaks API keys', async () => {
  const unauth = await app.fetch(new Request('https://example.com/api/providers'), env)
  assert.equal(unauth.status, 401)
  const token = await createSession(env, 1)
  const cookie = `__Host-session=${encodeURIComponent(token)}`
  const post = await app.fetch(new Request('https://example.com/api/providers', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: 'https://example.com' },
    body: JSON.stringify({ name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', api_key: 'sk-deep-secret-42', models: ['deepseek-chat'] }),
  }), env)
  assert.equal(post.status, 201)
  const text = await (await app.fetch(new Request('https://example.com/api/providers', { headers: { cookie } }), env)).text()
  assert.equal(text.includes('sk-deep-secret'), false)
  assert.ok(text.includes('DeepSeek'))
  const grouped = await (await app.fetch(new Request('https://example.com/api/models/grouped', { headers: { cookie } }), env)).json()
  assert.ok(grouped.groups.some((g) => g.provider.name === 'DeepSeek' && g.models[0].id === 'deepseek-chat'))
  const cross = await app.fetch(new Request('https://example.com/api/settings', {
    method: 'PUT', headers: { cookie, 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}',
  }), env)
  assert.equal(cross.status, 403)
  const sync = await app.fetch(new Request('https://example.com/api/sync', { headers: { cookie } }), env)
  assert.equal(sync.status, 410)
  const me = await (await app.fetch(new Request('https://example.com/api/me', { headers: { cookie } }), env)).json()
  assert.equal(me.config.storage, true)
  assert.equal(me.config.encryption, true)
})
