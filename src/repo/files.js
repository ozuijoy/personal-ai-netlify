// 檔案中繼資料（本體在物件儲存）。流程：
//   1) createPendingFile → 回 presigned PUT，瀏覽器直傳物件儲存（不經 Netlify Function，繞過約 4.5 MB 請求上限）
//   2) 瀏覽器抽文字（pdf.js / mammoth / 純文字）
//   3) completeFile → 伺服器 HEAD 確認物件存在與大小，寫入抽出的文字為 documents（doc_type=file）並切塊
import { OWNER } from './providers.js'
import { createEntity, existingProjectId } from './entities.js'

export const MAX_EXTRACT_CHARS = 900_000
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/
const COLS = 'id, project_id, filename, mime, size_bytes, sha256, status, error, created_at, updated_at'

export function maxUploadBytes(env = {}) {
  const mb = Number(env.MAX_UPLOAD_MB || 25)
  return Math.round((Number.isFinite(mb) && mb > 0 ? Math.min(mb, 5 * 1024) : 25) * 1024 * 1024)
}

export function safeFilename(name) {
  const clean = String(name || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f/\\?#%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return (clean || 'file').slice(0, 150)
}

function cleanMime(m) {
  const s = String(m || '').toLowerCase().trim()
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(s) && s.length <= 120 ? s : 'application/octet-stream'
}

export async function createPendingFile(db, env, input, ownerId = OWNER) {
  const filename = safeFilename(input.filename)
  const size = Number(input.size)
  if (!Number.isFinite(size) || size <= 0) throw new Error('檔案大小不正確')
  const limit = maxUploadBytes(env)
  if (size > limit) throw new Error(`檔案超過上限 ${Math.round(limit / 1048576)} MB`)
  const id = crypto.randomUUID()
  const now = new Date()
  const key = `${ownerId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}/${filename}`
  const projectId = await existingProjectId(db, input.project_id ? String(input.project_id) : null, ownerId)
  const sha = /^[a-f0-9]{64}$/.test(String(input.sha256 || '')) ? String(input.sha256) : null
  const rows = await db.query(
    `INSERT INTO files (id, owner_id, project_id, filename, mime, size_bytes, sha256, storage_key, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING ${COLS}, storage_key`,
    [id, ownerId, projectId, filename, cleanMime(input.mime), Math.round(size), sha, key],
  )
  return rows[0]
}

export async function getFile(db, id, ownerId = OWNER, { withKey = false } = {}) {
  if (!ID_RE.test(String(id))) return null
  const rows = await db.query(
    `SELECT ${COLS}${withKey ? ', storage_key' : ''},
       (SELECT d.id FROM documents d WHERE d.file_id = files.id AND d.deleted_at IS NULL ORDER BY d.created_at LIMIT 1) AS document_id
     FROM files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [id, ownerId],
  )
  return rows[0] || null
}

export async function listFiles(db, { projectId, includePending = false } = {}, ownerId = OWNER) {
  const params = [ownerId]
  const where = ['owner_id = $1', 'deleted_at IS NULL']
  if (!includePending) where.push(`status <> 'pending'`)
  if (projectId) { params.push(projectId); where.push(`project_id = $${params.length}`) }
  return db.query(
    `SELECT ${COLS},
       (SELECT d.id FROM documents d WHERE d.file_id = files.id AND d.deleted_at IS NULL ORDER BY d.created_at LIMIT 1) AS document_id
     FROM files WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 500`,
    params,
  )
}

/**
 * 上傳完成。storage.head 確認物件真的存在；大小超過上限（presigned PUT 無法限制大小）就刪掉。
 * input: { text?, title?, extract: 'ok' | 'none' | 'failed', error? }
 */
export async function completeFile(db, env, storage, id, input, ownerId = OWNER) {
  const file = await getFile(db, id, ownerId, { withKey: true })
  if (!file) return null
  const head = await storage.head(file.storage_key)
  if (!head) throw new Error('物件儲存中找不到這個檔案，請重新上傳')
  if (head.size > maxUploadBytes(env)) {
    await storage.remove(file.storage_key).catch(() => {})
    await db.query(`UPDATE files SET status = 'failed', error = 'too_large', deleted_at = now(), updated_at = now() WHERE id = $1`, [id])
    throw new Error('檔案超過上限，已刪除')
  }
  const text = typeof input.text === 'string' ? input.text.replace(/\u0000/g, '') : ''
  const truncated = text.length > MAX_EXTRACT_CHARS
  let documentId = null
  if (text.trim()) {
    const doc = await createEntity(db, 'documents', {
      title: String(input.title || file.filename.replace(/\.[^.]+$/, '')).slice(0, 500),
      content: truncated ? text.slice(0, MAX_EXTRACT_CHARS) : text,
      doc_type: 'file',
      file_id: file.id,
      project_id: file.project_id,
      data: { legacy_type: 'file', file: { name: file.filename, mime: file.mime, size: head.size }, truncated, pages: Number(input.pages) || undefined },
    }, ownerId)
    documentId = doc.id
  }
  const status = documentId ? 'extracted' : input.extract === 'failed' ? 'failed' : 'uploaded'
  const error = documentId ? null : input.extract === 'failed' ? String(input.error || 'extract_failed').slice(0, 300)
    : input.extract === 'none' ? 'no_text_layer' : null
  await db.query(
    `UPDATE files SET status = $2, error = $3, size_bytes = $4, updated_at = now() WHERE id = $1`,
    [id, status, error, head.size],
  )
  return { file: await getFile(db, id, ownerId), document_id: documentId, truncated }
}

export async function deleteFile(db, storage, id, ownerId = OWNER) {
  const file = await getFile(db, id, ownerId, { withKey: true })
  if (!file) return false
  if (storage) await storage.remove(file.storage_key).catch((e) => console.error('storage remove failed', e && e.message))
  await db.tx([
    [`UPDATE files SET deleted_at = now(), updated_at = now() WHERE id = $1 AND owner_id = $2`, [id, ownerId]],
    [`UPDATE documents SET deleted_at = now(), updated_at = now() WHERE file_id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId]],
    [`DELETE FROM doc_chunks WHERE document_id IN (SELECT id FROM documents WHERE file_id = $1 AND owner_id = $2)`, [id, ownerId]],
  ])
  return true
}
