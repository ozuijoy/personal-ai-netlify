// 知識庫關鍵字檢索：Neon Lakebase Search 的中文斷詞 + BM25（0004），或原本的二字組（bigram）檢索。
//
// 設定：settings 的 search.keyword（面板「關鍵字檢索」），值為
//   auto   預設。資料庫有 BM25 索引就用 BM25；BM25 沒有結果或出錯時退回二字組。
//   bm25   只用 BM25（出錯或未啟用時仍退回二字組，並回報 keyword_error）。
//   bigram 只用原本的二字組檢索。
// 未設定時可用環境變數 KEYWORD_SEARCH 給預設值，否則為 auto。
//
// 官方語法（https://neon.com/docs/extensions/lakebase-text）：
//   tsvector <@> to_bm25query(查詢 tsvector, 'BM25 索引名')  → 負的 BM25 分數，升冪排序＝最相關在前。
import { OWNER } from './repo/providers.js'
import { getSettings, putSettings, searchDocuments } from './repo/entities.js'

export const KEYWORD_MODES = ['auto', 'bm25', 'bigram']
export const BM25_INDEX = 'doc_chunks_bm25'
export const BM25_CONFIG = 'public.pa_zh'
const SETTING = 'search.keyword'
const CACHE_MS = 60_000
const cache = new WeakMap()

/** 資料庫是否已套用 0004（BM25 索引與中文設定都在）。結果快取 60 秒。 */
export async function bm25Available(db, { fresh = false } = {}) {
  const hit = cache.get(db)
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.ok
  let ok = false
  try {
    const rows = await db.query(
      `SELECT to_regclass('public.${BM25_INDEX}') IS NOT NULL
              AND EXISTS (SELECT 1 FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
                           WHERE c.cfgname = 'pa_zh' AND n.nspname = 'public') AS ok`)
    ok = !!rows[0]?.ok
  } catch { ok = false }
  cache.set(db, { ok, at: Date.now() })
  return ok
}

export function normalizeMode(v) {
  const s = String(v || '').trim().toLowerCase()
  return KEYWORD_MODES.includes(s) ? s : null
}

export async function getKeywordMode(db, env = {}, ownerId = OWNER) {
  let stored = null
  try { stored = normalizeMode((await getSettings(db, ownerId))[SETTING]) } catch {}
  return stored || normalizeMode(env.KEYWORD_SEARCH) || 'auto'
}

export async function setKeywordMode(db, mode, ownerId = OWNER) {
  if (mode == null || mode === '') { await putSettings(db, { [SETTING]: null }, ownerId); return null }
  const m = normalizeMode(mode)
  if (!m) throw Object.assign(new Error('關鍵字檢索模式須為 auto、bm25 或 bigram'), { status: 400 })
  await putSettings(db, { [SETTING]: m }, ownerId)
  return m
}

/** BM25 檢索（需 0004）。回傳列與二字組檢索同形：document_id, title, chunk_index, content, score。 */
export async function bm25Search(db, query, { projectId, limit = 6 } = {}, ownerId = OWNER) {
  const q = String(query || '').slice(0, 400)
  if (!q.trim()) return []
  const n = Math.min(20, Math.max(1, Number(limit) || 6))
  const params = [ownerId, q, n]
  let projectFilter = ''
  if (projectId) { params.push(projectId); projectFilter = `AND (d.project_id = $4 OR d.project_id IS NULL)` }
  // 內層只碰 doc_chunks，讓 lakebase_bm25 索引做 top-K；分數 0 的列（沒有命中）排除。
  return db.query(
    `SELECT d.id AS document_id, d.title, c.chunk_index, c.content, -s.dist AS score
       FROM (SELECT id, tsv_zh <@> to_bm25query(to_tsvector('${BM25_CONFIG}'::regconfig, $2), '${BM25_INDEX}') AS dist
               FROM doc_chunks
              WHERE owner_id = $1
              ORDER BY dist
              LIMIT 200) s
       JOIN doc_chunks c ON c.id = s.id
       JOIN documents d ON d.id = c.document_id
      WHERE s.dist < 0 AND d.deleted_at IS NULL ${projectFilter}
      ORDER BY s.dist
      LIMIT $3`,
    params,
  )
}

/**
 * 依設定選擇引擎。回傳 {results, engine: 'bm25'|'bigram', mode, keyword_error?, keyword_fallback?}。
 * 任何 BM25 錯誤都退回二字組，不讓檢索整個失敗。
 */
export async function keywordSearch(db, env, query, opts = {}, ownerId = OWNER) {
  const mode = await getKeywordMode(db, env, ownerId)
  const bigram = async (extra = {}) => ({ results: await searchDocuments(db, query, opts, ownerId), engine: 'bigram', mode, ...extra })
  if (mode === 'bigram') return bigram()
  if (!(await bm25Available(db))) {
    return bigram(mode === 'bm25' ? { keyword_error: 'BM25 未啟用：資料庫沒有 doc_chunks_bm25（需在 Neon 套用 0004_cjk_bm25）' } : {})
  }
  try {
    const rows = await bm25Search(db, query, opts, ownerId)
    if (rows.length || mode === 'bm25') return { results: rows, engine: 'bm25', mode }
    // auto：斷詞沒命中（例如詞典沒收的繁體詞）時再用二字組找一次。
    const fb = await bigram({ keyword_fallback: 'bm25_empty' })
    return fb
  } catch (err) {
    cache.delete(db)
    return bigram({ keyword_error: String(err.message || err).slice(0, 300) })
  }
}

export async function keywordStatus(db, env = {}, ownerId = OWNER) {
  const mode = await getKeywordMode(db, env, ownerId)
  const available = await bm25Available(db, { fresh: true })
  return { mode, bm25_available: available, engine: mode !== 'bigram' && available ? 'bm25' : 'bigram' }
}
