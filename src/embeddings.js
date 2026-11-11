// 第五階段：語意檢索（pgvector）與混合檢索。
// - 嵌入模型：沒有內建，也沒有自動預設。設定存 settings.embedding：
//   未設定 → 關閉（只用關鍵字檢索）；{provider_id, model, dims} → 開啟；PUT {reset:true} 或空 provider_id → 清除（關閉）。
//   provider_id 可以是環境變數供應商 env-N 或設定面板（資料庫）的供應商；嵌入模型選項來自各供應商的嵌入模型清單
//   （PROVIDER_N_EMBED_MODELS 或面板的「嵌入模型」欄位），也可自由輸入。
// - 向量在背景分批補齊（/api/embeddings/backfill，每次 ≤ 40 秒，避開 Function 60 秒上限），前端迴圈呼叫。
// - 檢索：關鍵字結果與向量結果用 RRF（Reciprocal Rank Fusion）合併；向量不可用時自動退回關鍵字。
import { fetchWithTimeout, normalizeBaseUrl, upstreamHeaders } from './providers.js'
import { embeddingModelOptions, providerCredentials, OWNER } from './repo/providers.js'
import { getSettings, putSettings, searchDocuments } from './repo/entities.js'

export const EMBED_BATCH = 32
export const EMBED_INPUT_CHARS = 6000
export const BACKFILL_BUDGET_MS = 40_000
const RRF_K = 60

export function embeddingsUrl(baseUrl) {
  return normalizeBaseUrl(baseUrl).replace(/\/+$/, '') + '/embeddings'
}

export function toVectorLiteral(vec) {
  if (!Array.isArray(vec) || !vec.length || vec.length > 16000) throw new Error('嵌入向量維度不正確')
  for (const x of vec) if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error('嵌入向量含無效數值')
  return '[' + vec.join(',') + ']'
}

export async function getEmbeddingConfig(db, env = {}, ownerId = OWNER) {
  const s = await getSettings(db, ownerId)
  const c = s && s.embedding
  if (c && typeof c === 'object' && !c.disabled && c.provider_id && c.model) {
    return { provider_id: String(c.provider_id), model: String(c.model), dims: Number(c.dims) || null }
  }
  return null
}

export async function vectorAvailable(db) {
  try {
    const rows = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'doc_chunks' AND column_name = 'embedding'`)
    return rows.length > 0
  } catch { return false }
}

export async function embedTexts(db, env, config, texts, ownerId = OWNER, signal) {
  const cred = await providerCredentials(db, env, config.provider_id, ownerId)
  const res = await fetchWithTimeout(embeddingsUrl(cred.baseUrl), {
    method: 'POST',
    headers: upstreamHeaders(cred.apiKey),
    body: JSON.stringify({ model: config.model, input: texts.map((t) => String(t).slice(0, EMBED_INPUT_CHARS)) }),
    signal,
  }, 30_000)
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j?.error?.message || j?.message || '' } catch {}
    throw new Error(`嵌入 API 回傳 HTTP ${res.status}${detail ? '：' + String(detail).slice(0, 200) : ''}`)
  }
  const data = await res.json()
  const list = Array.isArray(data?.data) ? data.data.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) : []
  if (list.length !== texts.length) throw new Error('嵌入 API 回傳數量不符')
  return list.map((d) => d.embedding)
}

/** 設定嵌入模型：先實際呼叫一次確認可用、記下維度。{reset:true} 或 provider_id 為空 → 清除設定（關閉）。 */
export async function setEmbeddingConfig(db, env, input, ownerId = OWNER) {
  const providerId = input && input.provider_id ? String(input.provider_id).slice(0, 100) : ''
  const model = input && input.model ? String(input.model).trim().slice(0, 200) : ''
  if ((input && input.reset) || !providerId) {
    await putSettings(db, { embedding: null }, ownerId)
    return null
  }
  if (!model) throw new Error('請輸入嵌入模型名稱')
  if (!(await vectorAvailable(db))) throw new Error('資料庫尚未套用 0002_vectors（pgvector）')
  const config = { provider_id: providerId, model }
  const [vec] = await embedTexts(db, env, config, ['測試 test'], ownerId)
  toVectorLiteral(vec)
  config.dims = vec.length
  await putSettings(db, { embedding: config }, ownerId)
  return config
}

export async function embeddingStatus(db, env = {}, ownerId = OWNER) {
  const available = await vectorAvailable(db)
  const config = await getEmbeddingConfig(db, env, ownerId)
  const out = {
    vector_available: available, configured: !!config, ...(config || {}),
    options: await embeddingModelOptions(db, env, ownerId),
    total: 0, embedded: 0, pending: 0,
  }
  if (!available) return out
  const row = (await db.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE c.embedding IS NOT NULL AND c.embedding_model = $2)::int AS embedded
       FROM doc_chunks c JOIN documents d ON d.id = c.document_id
      WHERE c.owner_id = $1 AND d.deleted_at IS NULL`, [ownerId, config ? config.model : '']))[0]
  out.total = row.total
  out.embedded = config ? row.embedded : 0
  out.pending = config ? row.total - row.embedded : 0
  return out
}

/** 補齊尚未以目前模型嵌入的段落。回傳 {done, remaining}。 */
export async function backfillEmbeddings(db, env, { maxChunks = 256, budgetMs = BACKFILL_BUDGET_MS, signal } = {}, ownerId = OWNER) {
  const config = await getEmbeddingConfig(db, env, ownerId)
  if (!config) throw new Error('尚未設定嵌入模型')
  const started = Date.now()
  let done = 0
  while (done < maxChunks && Date.now() - started < budgetMs) {
    const rows = await db.query(
      `SELECT c.id, c.content FROM doc_chunks c JOIN documents d ON d.id = c.document_id
        WHERE c.owner_id = $1 AND d.deleted_at IS NULL AND (c.embedding IS NULL OR c.embedding_model IS DISTINCT FROM $2)
        ORDER BY c.id LIMIT $3`, [ownerId, config.model, Math.min(EMBED_BATCH, maxChunks - done)])
    if (!rows.length) break
    const vecs = await embedTexts(db, env, config, rows.map((r) => r.content), ownerId, signal)
    await db.tx(rows.map((r, i) => [
      `UPDATE doc_chunks SET embedding = $1::vector, embedding_model = $2 WHERE id = $3`,
      [toVectorLiteral(vecs[i]), config.model, r.id],
    ]))
    done += rows.length
  }
  const status = await embeddingStatus(db, env, ownerId)
  return { done, remaining: status.pending, total: status.total, model: config.model }
}

export async function vectorSearch(db, vecLiteral, config, { projectId, limit = 20 } = {}, ownerId = OWNER) {
  const params = [ownerId, vecLiteral, config.model, Math.min(50, Math.max(1, limit))]
  let projectFilter = ''
  if (projectId) { params.push(projectId); projectFilter = 'AND (d.project_id = $5 OR d.project_id IS NULL)' }
  return db.query(
    `SELECT d.id AS document_id, d.title, c.chunk_index, c.content, 1 - (c.embedding <=> $2::vector) AS similarity
       FROM doc_chunks c JOIN documents d ON d.id = c.document_id
      WHERE c.owner_id = $1 AND d.deleted_at IS NULL AND c.embedding IS NOT NULL AND c.embedding_model = $3
        AND vector_dims(c.embedding) = vector_dims($2::vector) ${projectFilter}
      ORDER BY c.embedding <=> $2::vector
      LIMIT $4`, params)
}

export function rrfMerge(lists, limit) {
  const map = new Map()
  for (const list of lists) {
    list.forEach((row, rank) => {
      const key = `${row.document_id}#${row.chunk_index}`
      const cur = map.get(key) || { ...row, score: 0 }
      cur.score += 1 / (RRF_K + rank + 1)
      if (row.similarity != null) cur.similarity = Number(row.similarity)
      map.set(key, cur)
    })
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}

/** 混合檢索：關鍵字 + 向量（若已設定），回傳 {results, mode, vector_error?}。 */
export async function hybridSearch(db, env, query, { projectId, limit = 6, minSimilarity = 0.2 } = {}, ownerId = OWNER) {
  const n = Math.min(20, Math.max(1, Number(limit) || 6))
  const keyword = await searchDocuments(db, query, { projectId, limit: 20 }, ownerId)
  let config = null
  try { config = await getEmbeddingConfig(db, env, ownerId) } catch {}
  if (!config || !String(query || '').trim()) return { results: keyword.slice(0, n), mode: 'keyword' }
  try {
    const [vec] = await embedTexts(db, env, config, [String(query).slice(0, 2000)], ownerId)
    const vector = (await vectorSearch(db, toVectorLiteral(vec), config, { projectId, limit: 20 }, ownerId))
      .filter((r) => Number(r.similarity) >= minSimilarity)
    return { results: rrfMerge([keyword, vector], n), mode: 'hybrid' }
  } catch (err) {
    return { results: keyword.slice(0, n), mode: 'keyword', vector_error: String(err.message || err).slice(0, 300) }
  }
}
