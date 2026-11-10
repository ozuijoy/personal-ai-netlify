// 文字類資料的通用 CRUD：projects / documents / skills / memories / prompts。
// 每種實體宣告可寫欄位與型別，路由層只做 JSON 進出。
import { OWNER } from './providers.js'

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/
const MAX_TEXT = 900_000 // 與舊 D1 單項上限一致

const str = (max) => (v) => String(v ?? '').slice(0, max)
const bool = (v) => !!v
const json = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const optId = (v) => (v == null || v === '' ? null : ID_RE.test(String(v)) ? String(v) : null)
const textArr = (v) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 100)).filter(Boolean).slice(0, 50) : [])
const oneOf = (values, fallback) => (v) => (values.includes(v) ? v : fallback)

export const ENTITIES = {
  projects: {
    table: 'projects',
    fields: { name: str(200), description: str(20_000), instructions: str(50_000), data: json },
    required: ['name'],
    order: 'updated_at DESC',
  },
  documents: {
    table: 'documents',
    fields: { title: str(500), content: str(MAX_TEXT), doc_type: oneOf(['note', 'file', 'knowledge', 'web'], 'note'), project_id: optId, file_id: optId, data: json },
    required: [],
    order: 'updated_at DESC',
    listColumns: 'id, project_id, file_id, title, doc_type, left(content, 300) AS preview, char_length(content) AS length, data, created_at, updated_at',
    afterWrite: 'chunks',
  },
  skills: {
    table: 'skills',
    fields: {
      name: str(200), description: str(2000), instructions: str(50_000),
      trigger_mode: oneOf(['always', 'manual', 'keyword'], 'manual'), keywords: textArr, enabled: bool, data: json,
    },
    required: ['name'],
    order: 'updated_at DESC',
  },
  memories: {
    table: 'memories',
    fields: {
      content: str(4000), kind: oneOf(['fact', 'preference', 'instruction', 'note'], 'fact'),
      pinned: bool, project_id: optId, source_conversation_id: optId, data: json,
    },
    required: ['content'],
    order: 'pinned DESC, updated_at DESC',
  },
  prompts: {
    table: 'prompts',
    fields: { kind: oneOf(['favorite', 'recent', 'template'], 'favorite'), title: str(300), content: str(50_000) },
    required: ['content'],
    order: 'updated_at DESC',
  },
}

function pick(def, input, { partial }) {
  const out = {}
  for (const [col, cast] of Object.entries(def.fields)) {
    if (col in input) out[col] = cast(input[col])
  }
  if (!partial) {
    for (const col of def.required) {
      if (!String(out[col] ?? '').trim()) throw new Error(`缺少欄位：${col}`)
    }
  }
  return out
}

const encode = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v)

export async function listEntities(db, kind, { projectId, q, limit = 200, since, full } = {}, ownerId = OWNER) {
  const def = ENTITIES[kind]
  const params = [ownerId]
  const where = ['owner_id = $1', 'deleted_at IS NULL']
  if (projectId !== undefined && 'project_id' in def.fields) {
    if (projectId === null || projectId === 'none') where.push('project_id IS NULL')
    else { params.push(projectId); where.push(`project_id = $${params.length}`) }
  }
  if (since) { params.push(new Date(since).toISOString()); where.push(`updated_at > $${params.length}`) }
  if (q) {
    const col = kind === 'documents' ? "title || ' ' || content" : kind === 'memories' || kind === 'prompts' ? 'content' : "name || ' ' || description"
    params.push(`%${String(q).slice(0, 200).replace(/[\\%_]/g, (c) => '\\' + c)}%`)
    where.push(`(${col}) ILIKE $${params.length}`)
  }
  params.push(Math.min(2000, Math.max(1, Number(limit) || 200)))
  return db.query(
    `SELECT ${(!full && def.listColumns) || '*'} FROM ${def.table} WHERE ${where.join(' AND ')} ORDER BY ${def.order} LIMIT $${params.length}`,
    params,
  )
}

export async function getEntity(db, kind, id, ownerId = OWNER) {
  const def = ENTITIES[kind]
  return (await db.query(`SELECT * FROM ${def.table} WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId]))[0] || null
}

/** 指向不存在（或已刪除）專案的 project_id 改為 NULL，避免外鍵錯誤（例如舊資料、跨裝置先刪專案）。 */
export async function existingProjectId(db, projectId, ownerId = OWNER) {
  if (!projectId) return null
  const row = (await db.query(`SELECT id FROM projects WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [projectId, ownerId]))[0]
  return row ? row.id : null
}

export async function createEntity(db, kind, input, ownerId = OWNER) {
  const def = ENTITIES[kind]
  const values = pick(def, input, { partial: false })
  if ('project_id' in values) values.project_id = await existingProjectId(db, values.project_id, ownerId)
  const id = input.id && ID_RE.test(String(input.id)) ? String(input.id) : crypto.randomUUID()
  const cols = ['id', 'owner_id', ...Object.keys(values)]
  const params = [id, ownerId, ...Object.values(values).map(encode)]
  const ph = params.map((_, i) => `$${i + 1}`)
  // 同 id 已存在（例如前端離線建立後重送）→ 視為更新，達成冪等。
  const updates = Object.keys(values).map((c) => `${c} = EXCLUDED.${c}`)
  updates.push('deleted_at = NULL', 'updated_at = now()')
  const statements = [[
    `INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${ph.join(', ')})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')} WHERE ${def.table}.owner_id = EXCLUDED.owner_id`,
    params,
  ]]
  if (def.afterWrite === 'chunks' && 'content' in values) statements.push(...chunkStatements(id, values.content, ownerId))
  await db.tx(statements)
  return getEntity(db, kind, id, ownerId)
}

export async function updateEntity(db, kind, id, input, ownerId = OWNER) {
  const def = ENTITIES[kind]
  const values = pick(def, input, { partial: true })
  if ('project_id' in values) values.project_id = await existingProjectId(db, values.project_id, ownerId)
  const keys = Object.keys(values)
  if (!keys.length) return getEntity(db, kind, id, ownerId)
  const params = [id, ownerId, ...Object.values(values).map(encode)]
  const sets = keys.map((c, i) => `${c} = $${i + 3}`)
  const statements = [[
    `UPDATE ${def.table} SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    params,
  ]]
  if (def.afterWrite === 'chunks' && 'content' in values) statements.push(...chunkStatements(id, values.content, ownerId))
  await db.tx(statements)
  return getEntity(db, kind, id, ownerId)
}

export async function deleteEntity(db, kind, id, ownerId = OWNER) {
  const def = ENTITIES[kind]
  const rows = await db.query(
    `UPDATE ${def.table} SET deleted_at = now(), updated_at = now() WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id`,
    [id, ownerId],
  )
  if (rows.length && def.afterWrite === 'chunks') await db.query(`DELETE FROM doc_chunks WHERE document_id = $1`, [id])
  return rows.length > 0
}

// ── 知識庫切塊與檢索 ──────────────────────────────────────────

/** 依段落切塊，每塊約 size 字元、重疊 overlap 字元。中文以字元計，不依賴空白。 */
export function chunkText(text, size = 1200, overlap = 150) {
  const clean = String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  if (clean.length <= size) return [clean]
  const chunks = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size)
    if (end < clean.length) {
      const window = clean.slice(start + Math.floor(size * 0.6), end)
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('。'), window.lastIndexOf('. '), window.lastIndexOf('\n'))
      if (cut > 0) end = start + Math.floor(size * 0.6) + cut + 1
    }
    chunks.push(clean.slice(start, end).trim())
    if (end >= clean.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks.filter(Boolean).slice(0, 2000)
}

function chunkStatements(documentId, content, ownerId) {
  const st = [[`DELETE FROM doc_chunks WHERE document_id = $1`, [documentId]]]
  chunkText(content).forEach((c, i) => st.push([
    `INSERT INTO doc_chunks (document_id, owner_id, chunk_index, content) VALUES ($1, $2, $3, $4)`,
    [documentId, ownerId, i, c],
  ]))
  return st
}

/**
 * 把查詢拆成檢索詞：英數字詞（≥2 字元）+ 中日韓文字的相鄰二字組（bigram）。
 * 原因：PostgreSQL 內建全文檢索不會斷中文詞，pg_trgm 的三字元相似度對短中文查詢分數太低
 * （實測「嵐山竹林」對「…去嵐山看竹林」word_similarity 只有 0.2）。二字組命中數是簡單可靠的替代。
 */
export function searchTerms(query, max = 16) {
  const q = String(query || '').toLowerCase().slice(0, 400)
  const terms = new Set()
  for (const w of q.match(/[a-z0-9][a-z0-9._-]+/g) || []) terms.add(w)
  for (const run of q.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]+/g) || []) {
    if (run.length === 1) terms.add(run)
    for (let i = 0; i + 2 <= run.length; i++) terms.add(run.slice(i, i + 2))
  }
  return [...terms].slice(0, max)
}

const likeEscape = (t) => t.replace(/[\\%_]/g, (c) => '\\' + c)

/**
 * 知識庫檢索（第一版）：詞命中數 + 標題加權 + 'simple' 全文檢索分數。
 * 個人知識庫規模（數千塊以內）順序掃描即可；之後加入 pgvector 時在此合併向量分數（hybrid）。
 */
export async function searchDocuments(db, query, { projectId, limit = 6 } = {}, ownerId = OWNER) {
  const terms = searchTerms(query)
  if (!terms.length) return []
  const patterns = terms.map((t) => `%${likeEscape(t)}%`)
  const params = [ownerId, patterns, String(query).slice(0, 400), Math.min(20, Math.max(1, Number(limit) || 6))]
  let projectFilter = ''
  if (projectId) { params.push(projectId); projectFilter = `AND (d.project_id = $5 OR d.project_id IS NULL)` }
  return db.query(
    `SELECT * FROM (
       SELECT d.id AS document_id, d.title, c.chunk_index, c.content,
              (SELECT count(*) FROM unnest($2::text[]) p WHERE c.content ILIKE p)::float
              + 2 * (SELECT count(*) FROM unnest($2::text[]) p WHERE d.title ILIKE p)::float / greatest(array_length($2::text[], 1), 1)
              + ts_rank(c.tsv, plainto_tsquery('simple', $3)) AS score,
              (SELECT count(*) FROM unnest($2::text[]) p WHERE c.content ILIKE p) AS hits
         FROM doc_chunks c JOIN documents d ON d.id = c.document_id
        WHERE c.owner_id = $1 AND d.deleted_at IS NULL ${projectFilter}
     ) s
     WHERE s.hits > 0
     ORDER BY s.score DESC
     LIMIT $4`,
    params,
  )
}

// ── 設定 / 個人資料 ─────────────────────────────────────────────

const SETTING_KEY = /^[a-z][a-z0-9_.-]{0,63}$/

export async function getSettings(db, ownerId = OWNER) {
  const rows = await db.query(`SELECT key, value FROM settings WHERE owner_id = $1`, [ownerId])
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function putSettings(db, patch, ownerId = OWNER) {
  const entries = Object.entries(patch || {})
  if (entries.length > 100) throw new Error('一次最多 100 項設定')
  const st = []
  for (const [key, value] of entries) {
    if (!SETTING_KEY.test(key)) throw new Error(`設定鍵不正確：${key.slice(0, 40)}`)
    if (value === null) { st.push([`DELETE FROM settings WHERE owner_id = $1 AND key = $2`, [ownerId, key]]); continue }
    const text = JSON.stringify(value)
    if (text.length > 100_000) throw new Error(`設定過大：${key}`)
    st.push([
      `INSERT INTO settings (owner_id, key, value) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (owner_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [ownerId, key, text],
    ])
  }
  if (st.length) await db.tx(st)
  return getSettings(db, ownerId)
}

export async function getProfile(db, ownerId = OWNER) {
  const row = (await db.query(`SELECT data, updated_at FROM profiles WHERE owner_id = $1`, [ownerId]))[0]
  return row ? row.data : {}
}

export async function putProfile(db, data, ownerId = OWNER) {
  const text = JSON.stringify(json(data))
  if (text.length > 200_000) throw new Error('個人資料過大')
  await db.query(
    `INSERT INTO profiles (owner_id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (owner_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [ownerId, text],
  )
  return getProfile(db, ownerId)
}
