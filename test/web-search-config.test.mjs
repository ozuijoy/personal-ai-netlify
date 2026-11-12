// 網頁搜尋供應商（面板）：Key 加密存 settings 的 secret.search.*，不經 /api/settings 外洩、不進備份；聊天時依設定呼叫 Jina 或 Tavily。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { vector } from '@electric-sql/pglite/vector'
import { resolveWebSearch, setWebSearchConfig, webSearchStatus, rekeyWebSearchSecrets } from '../src/web_search_config.js'
import { getSettings } from '../src/repo/entities.js'
import { exportPage } from '../src/backup.js'
import { searchWeb } from '../src/tools/search.js'

const sql = (f) => fs.readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8')
const KEY = Buffer.alloc(32, 7).toString('base64')
const KEY2 = Buffer.alloc(32, 9).toString('base64')

async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm, vector } })
  for (const f of ['0001_init.sql', '0002_vectors.sql', '0003_model_kinds.sql', '0004_cjk_bm25.sql']) await pg.exec(sql(f))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
}

test('web search: panel key is encrypted, hidden from backup, resolved for chat, rekeyed', async () => {
  const db = await makeDb()
  const env = { ENCRYPTION_KEY: KEY }
  assert.equal((await resolveWebSearch(db, env)).provider, null)
  let st = await setWebSearchConfig(db, env, { provider: 'jina', api_key: 'jina_secret_123456', key_provider: 'jina', maxResults: 2, snippetChars: 300, contextChars: 900 })
  assert.equal(st.active, 'jina')
  assert.deepEqual(st.limits, { maxResults: 2, snippetChars: 300, contextChars: 900 })
  const raw = await getSettings(db)
  assert.ok(raw['secret.search.jina'].enc)
  assert.ok(!JSON.stringify(raw).includes('jina_secret_123456'))
  const r = await resolveWebSearch(db, env)
  assert.equal(r.apiKey, 'jina_secret_123456')
  const page = await exportPage(db, 'settings', null)
  assert.ok(!JSON.stringify(page).includes('secret.search'))
  // 換 Key 覆蓋
  await setWebSearchConfig(db, env, { api_key: 'jina_new_key_999999', key_provider: 'jina' })
  assert.equal((await resolveWebSearch(db, env)).apiKey, 'jina_new_key_999999')
  // 金鑰輪替
  const env2 = { ENCRYPTION_KEY: KEY2, KEY_VERSION: 'v2', ENCRYPTION_KEY_PREVIOUS: KEY, KEY_VERSION_PREVIOUS: 'v1' }
  assert.equal((await rekeyWebSearchSecrets(db, env2)).rekeyed, 1)
  assert.equal((await resolveWebSearch(db, { ENCRYPTION_KEY: KEY2, KEY_VERSION: 'v2' })).apiKey, 'jina_new_key_999999')
  // 關閉與環境變數退路
  await setWebSearchConfig(db, env2, { provider: 'off' })
  assert.equal((await resolveWebSearch(db, env2)).provider, null)
  await setWebSearchConfig(db, env2, { provider: '' , api_key: '', key_provider: 'jina' })
  const viaEnv = await resolveWebSearch(db, { ...env2, TAVILY_API_KEY: 'tvly-x' })
  assert.equal(viaEnv.provider, 'tavily')
  st = await webSearchStatus(db, { ...env2, TAVILY_API_KEY: 'tvly-x' })
  assert.equal(st.providers.find((p) => p.id === 'tavily').env_key, true)
  await assert.rejects(setWebSearchConfig(db, env2, { provider: 'exa' }))
})

test('web search: jina request shape and result mapping', async () => {
  const orig = globalThis.fetch
  let seen
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), init }
    return new Response(JSON.stringify({ data: [
      { title: 'A', url: 'https://a.example/', description: 'desc a', content: 'x'.repeat(5000) },
      { title: 'B', url: 'ftp://bad', description: 'bad' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const r = await searchWeb('台北 天氣 jina test', {}, { provider: 'jina', apiKey: 'jk', maxResults: 3 })
    assert.match(seen.url, /^https:\/\/s\.jina\.ai\/\?q=/)
    assert.equal(seen.init.headers.Authorization, 'Bearer jk')
    assert.equal(seen.init.headers['X-Respond-With'], 'no-content')
    assert.equal(r.provider, 'jina')
    assert.equal(r.results.length, 1)
    assert.equal(r.results[0].content, 'desc a')
  } finally { globalThis.fetch = orig }
})
