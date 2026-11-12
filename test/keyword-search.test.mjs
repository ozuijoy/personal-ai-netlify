// 關鍵字檢索引擎（0004）：中文斷詞 + BM25 與二字組退路。
// PGlite 沒有 Neon 的 lakebase_tokenizer / lakebase_text，所以：
//   1. 確認 0004 在沒有擴充套件的資料庫上會安全略過，系統退回二字組。
//   2. 用 PGlite 建一組「替身」物件（pa_zh 設定、tsv_zh 欄、doc_chunks_bm25 索引、to_bm25query()、<@> 運算子），
//      讓 bm25Search 的真實 SQL 在本機跑通。替身的分數只是命中詞數，不是真的 BM25，也不會斷中文詞。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { vector } from '@electric-sql/pglite/vector'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { createEntity } from '../src/repo/entities.js'
import { hybridSearch } from '../src/embeddings.js'
import { bm25Available, bm25Search, keywordSearch, keywordStatus, setKeywordMode } from '../src/keyword_search.js'

const sql = (f) => fs.readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8')

async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm, vector } })
  for (const f of ['0001_init.sql', '0002_vectors.sql', '0003_model_kinds.sql', '0004_cjk_bm25.sql']) await pg.exec(sql(f))
  const db = {
    pg,
    log: [],
    query: async (text, params = []) => { db.log.push(text); return (await pg.query(text, params)).rows },
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
  return db
}

// 替身：模擬 0004 在 Neon 上建立的物件與 lakebase_text 的查詢介面。
async function installStandIn(pg) {
  await pg.exec(`
    CREATE TEXT SEARCH CONFIGURATION public.pa_zh (COPY = pg_catalog.simple);
    ALTER TABLE doc_chunks ADD COLUMN tsv_zh tsvector GENERATED ALWAYS AS (to_tsvector('public.pa_zh'::regconfig, content)) STORED;
    CREATE INDEX doc_chunks_bm25 ON doc_chunks (id);
    CREATE FUNCTION to_bm25query(q tsvector, idx regclass) RETURNS tsvector LANGUAGE sql IMMUTABLE AS 'SELECT q';
    CREATE FUNCTION fake_bm25(d tsvector, q tsvector) RETURNS float8 LANGUAGE sql IMMUTABLE AS
      'SELECT -count(*)::float8 FROM unnest(tsvector_to_array(d)) x WHERE x = ANY (tsvector_to_array(q))';
    CREATE OPERATOR <@> (LEFTARG = tsvector, RIGHTARG = tsvector, FUNCTION = fake_bm25);
  `)
}

async function seed(db) {
  await createEntity(db, 'documents', { id: 'zh', title: '旅遊計畫', content: '東京與京都五天行程，第三天去嵐山看竹林。' })
  await createEntity(db, 'documents', { id: 'en', title: 'Work', content: 'Quarterly planning notes about the netlify migration.' })
}

test('0004 skips safely without Lakebase extensions; auto falls back to bigram', async () => {
  const db = await makeDb()
  await seed(db)
  assert.equal(await bm25Available(db, { fresh: true }), false)
  const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'doc_chunks' AND column_name = 'tsv_zh'`)
  assert.equal(cols.length, 0)
  const r = await keywordSearch(db, {}, '嵐山竹林')
  assert.equal(r.engine, 'bigram')
  assert.equal(r.mode, 'auto')
  assert.equal(r.keyword_error, undefined)
  assert.equal(r.results[0].document_id, 'zh')
  // 0004 可重跑
  await db.pg.exec(sql('0004_cjk_bm25.sql'))
})

test('bm25 mode without the index reports keyword_error but still returns bigram results', async () => {
  const db = await makeDb()
  await seed(db)
  await setKeywordMode(db, 'bm25')
  const r = await keywordSearch(db, {}, '嵐山竹林')
  assert.equal(r.engine, 'bigram')
  assert.match(r.keyword_error, /0004_cjk_bm25/)
  assert.equal(r.results[0].document_id, 'zh')
  const st = await keywordStatus(db, {})
  assert.deepEqual(st, { mode: 'bm25', bm25_available: false, engine: 'bigram' })
})

test('mode setting: validation, env default, reset', async () => {
  const db = await makeDb()
  await assert.rejects(() => setKeywordMode(db, 'fuzzy'), /auto、bm25 或 bigram/)
  assert.equal((await keywordStatus(db, { KEYWORD_SEARCH: 'bigram' })).mode, 'bigram')
  await setKeywordMode(db, 'auto')
  assert.equal((await keywordStatus(db, { KEYWORD_SEARCH: 'bigram' })).mode, 'auto')
  await setKeywordMode(db, null)
  assert.equal((await keywordStatus(db, {})).mode, 'auto')
})

test('bm25 SQL runs end to end against stand-in objects; auto uses bm25, falls back when empty', async () => {
  const db = await makeDb()
  await installStandIn(db.pg)
  await seed(db)
  assert.equal(await bm25Available(db, { fresh: true }), true)

  const rows = await bm25Search(db, 'netlify migration')
  assert.equal(rows[0].document_id, 'en')
  assert.ok(rows[0].score > 0)
  const q = db.log.find((t) => t.includes('to_bm25query'))
  assert.match(q, /tsv_zh <@> to_bm25query\(to_tsvector\('public\.pa_zh'::regconfig, \$2\), 'doc_chunks_bm25'\)/)

  let r = await keywordSearch(db, {}, 'netlify')
  assert.equal(r.engine, 'bm25')
  assert.equal(r.results[0].document_id, 'en')

  // 替身不會斷中文詞 → BM25 沒結果 → auto 退回二字組
  r = await keywordSearch(db, {}, '嵐山竹林')
  assert.equal(r.engine, 'bigram')
  assert.equal(r.keyword_fallback, 'bm25_empty')
  assert.equal(r.results[0].document_id, 'zh')

  // bm25 模式不退回：空就是空
  await setKeywordMode(db, 'bm25')
  r = await keywordSearch(db, {}, '嵐山竹林')
  assert.equal(r.engine, 'bm25')
  assert.equal(r.results.length, 0)

  // bigram 模式完全不碰 BM25
  await setKeywordMode(db, 'bigram')
  db.log.length = 0
  r = await keywordSearch(db, {}, 'netlify')
  assert.equal(r.engine, 'bigram')
  assert.ok(!db.log.some((t) => t.includes('to_bm25query')))

  // 已刪除文件不出現
  await setKeywordMode(db, 'auto')
  await db.query(`UPDATE documents SET deleted_at = now() WHERE id = 'en'`)
  r = await keywordSearch(db, {}, 'netlify')
  assert.equal(r.results.length, 0)
})

test('bm25 errors fall back to bigram with keyword_error', async () => {
  const db = await makeDb()
  await installStandIn(db.pg)
  await seed(db)
  await db.pg.exec(`DROP OPERATOR <@> (tsvector, tsvector)`)
  const r = await keywordSearch(db, {}, 'netlify')
  assert.equal(r.engine, 'bigram')
  assert.ok(r.keyword_error)
  assert.equal(r.results[0].document_id, 'en')
})

test('hybridSearch and the HTTP API expose the keyword engine', async () => {
  const db = await makeDb()
  await installStandIn(db.pg)
  await seed(db)
  const h = await hybridSearch(db, {}, 'netlify')
  assert.equal(h.mode, 'keyword')
  assert.equal(h.keyword_engine, 'bm25')

  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 5).toString('base64'), __db: db }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const call = (path, method = 'GET', body) => app.fetch(new Request('https://example.com' + path, {
    method, headers: { cookie, origin: 'https://example.com', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), env).then(async (res) => ({ status: res.status, data: await res.json() }))

  let res = await call('/api/search/status')
  assert.deepEqual(res.data.status, { mode: 'auto', bm25_available: true, engine: 'bm25' })
  res = await call('/api/search/config', 'PUT', { keyword: 'bigram' })
  assert.equal(res.data.status.engine, 'bigram')
  res = await call('/api/search/config', 'PUT', { keyword: 'nope' })
  assert.equal(res.status, 400)
  res = await call('/api/documents/search?q=netlify')
  assert.equal(res.data.keyword_engine, 'bigram')
  assert.equal(res.data.results[0].document_id, 'en')

  const js = fs.readFileSync(new URL('../public/assets/app.js', import.meta.url), 'utf8')
  assert.ok(js.includes('/api/search/config') && js.includes('kw-save-btn'))
})
