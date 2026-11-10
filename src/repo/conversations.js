import { OWNER } from './providers.js'
import { existingProjectId } from './entities.js'

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/
const MAX_MESSAGE = 200_000
const MAX_MESSAGES_PER_WRITE = 500

export function normalizeRole(role) {
  if (role === 'ai' || role === 'assistant') return 'assistant'
  if (role === 'system' || role === 'tool') return role
  return 'user'
}

function cleanMessage(m) {
  if (!m || typeof m !== 'object') return null
  const arr = (v) => (Array.isArray(v) ? v.slice(0, 50) : [])
  const meta = {}
  if (m.meta && typeof m.meta === 'object') Object.assign(meta, m.meta)
  if (m.image) meta.image = String(m.image).slice(0, 2000) // 舊前端的 image 欄位（URL 或 data URI 摘要）
  const at = Number(m.at || m.created_at)
  return {
    role: normalizeRole(m.role),
    content: String(m.content ?? '').slice(0, MAX_MESSAGE),
    sources: JSON.stringify(arr(m.sources)),
    attachments: JSON.stringify(arr(m.attachments)),
    meta: JSON.stringify(meta),
    created_at: Number.isFinite(at) && at > 0 ? new Date(at).toISOString() : new Date().toISOString(),
  }
}

function toClient(row, messages) {
  const out = {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    pinned: row.pinned,
    archived: row.archived,
    provider_id: row.provider_id,
    model_id: row.model_id,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
  if (row.message_count !== undefined) out.message_count = Number(row.message_count)
  if (messages) out.messages = messages
  return out
}

export async function listConversations(db, { projectId, since, archived, limit = 300 } = {}, ownerId = OWNER) {
  const params = [ownerId]
  const where = ['c.owner_id = $1', 'c.deleted_at IS NULL']
  if (projectId) { params.push(projectId); where.push(`c.project_id = $${params.length}`) }
  if (archived !== undefined) { params.push(!!archived); where.push(`c.archived = $${params.length}`) }
  if (since) { params.push(new Date(since).toISOString()); where.push(`c.updated_at > $${params.length}`) }
  params.push(Math.min(1000, Math.max(1, Number(limit) || 300)))
  const rows = await db.query(
    `SELECT c.*, (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c WHERE ${where.join(' AND ')}
      ORDER BY c.pinned DESC, c.updated_at DESC LIMIT $${params.length}`,
    params,
  )
  return rows.map((r) => toClient(r))
}

export async function getConversation(db, id, ownerId = OWNER) {
  const row = (await db.query(`SELECT * FROM conversations WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId]))[0]
  if (!row) return null
  const messages = await db.query(
    `SELECT seq, role, content, sources, attachments, meta, created_at FROM messages WHERE conversation_id = $1 ORDER BY seq`,
    [id],
  )
  return toClient(row, messages)
}

function headerValues(input) {
  const out = {}
  if ('title' in input) out.title = String(input.title ?? '').slice(0, 300)
  if ('pinned' in input) out.pinned = !!input.pinned
  if ('archived' in input) out.archived = !!input.archived
  if ('project_id' in input || 'projectId' in input) {
    const p = input.project_id ?? input.projectId
    out.project_id = p && ID_RE.test(String(p)) ? String(p) : null
  }
  if ('provider_id' in input) out.provider_id = input.provider_id ? String(input.provider_id).slice(0, 100) : null
  if ('model_id' in input || 'model' in input) {
    const m = input.model_id ?? input.model
    out.model_id = m ? String(m).slice(0, 200) : null
  }
  if ('data' in input && input.data && typeof input.data === 'object') out.data = JSON.stringify(input.data)
  return out
}

function insertMessages(id, messages, startSeq) {
  const list = (messages || []).slice(0, MAX_MESSAGES_PER_WRITE).map(cleanMessage).filter(Boolean)
  return list.map((m, i) => [
    `INSERT INTO messages (conversation_id, seq, role, content, sources, attachments, meta, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)`,
    [id, startSeq + i, m.role, m.content, m.sources, m.attachments, m.meta, m.created_at],
  ])
}

/** 建立或整份覆蓋（含訊息）。前端「重新產生 / 編輯訊息」時用 PUT 整份覆蓋最簡單可靠。 */
export async function upsertConversation(db, input, ownerId = OWNER) {
  const id = input.id && ID_RE.test(String(input.id)) ? String(input.id) : crypto.randomUUID()
  const h = headerValues(input)
  if ('project_id' in h) h.project_id = await existingProjectId(db, h.project_id, ownerId)
  const cols = Object.keys(h)
  const params = [id, ownerId, ...Object.values(h)]
  const ph = cols.map((c, i) => (c === 'data' ? `$${i + 3}::jsonb` : `$${i + 3}`))
  const updates = cols.map((c) => `${c} = EXCLUDED.${c}`).concat(['deleted_at = NULL', 'updated_at = now()'])
  const st = [[
    `INSERT INTO conversations (id, owner_id${cols.map((c) => ', ' + c).join('')}) VALUES ($1, $2${ph.map((p) => ', ' + p).join('')})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')} WHERE conversations.owner_id = EXCLUDED.owner_id`,
    params,
  ]]
  if (Array.isArray(input.messages)) {
    st.push([`DELETE FROM messages WHERE conversation_id = $1`, [id]])
    st.push(...insertMessages(id, input.messages, 0))
  }
  await db.tx(st)
  return getConversation(db, id, ownerId)
}

export async function updateConversation(db, id, input, ownerId = OWNER) {
  const h = headerValues(input)
  if ('project_id' in h) h.project_id = await existingProjectId(db, h.project_id, ownerId)
  const cols = Object.keys(h)
  if (!cols.length) return getConversation(db, id, ownerId)
  const sets = cols.map((c, i) => `${c} = $${i + 3}${c === 'data' ? '::jsonb' : ''}`)
  const rows = await db.query(
    `UPDATE conversations SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id`,
    [id, ownerId, ...Object.values(h)],
  )
  return rows.length ? getConversation(db, id, ownerId) : null
}

/** 串流結束後由前端呼叫：追加一批訊息（通常是 user + assistant 兩則）。 */
export async function appendMessages(db, id, messages, ownerId = OWNER) {
  const conv = (await db.query(`SELECT id FROM conversations WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId]))[0]
  if (!conv) return null
  const max = (await db.query(`SELECT COALESCE(max(seq), -1) AS s FROM messages WHERE conversation_id = $1`, [id]))[0]
  const start = Number(max.s) + 1
  const st = insertMessages(id, messages, start)
  st.push([`UPDATE conversations SET updated_at = now() WHERE id = $1`, [id]])
  await db.tx(st)
  return { ok: true, from_seq: start, count: st.length - 1 }
}

export async function deleteConversation(db, id, ownerId = OWNER) {
  const rows = await db.query(
    `UPDATE conversations SET deleted_at = now(), updated_at = now() WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id`,
    [id, ownerId],
  )
  return rows.length > 0
}
