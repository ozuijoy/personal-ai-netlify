// 第五階段：完整備份匯出與還原（JSON）。
// 依資料表分頁匯出，每頁 ≤ 約 3.5 MB（Function 緩衝回應上限 6 MB，docs.netlify.com/build/functions/api）；
// 前端把各頁組成單一 .json 檔下載。還原時前端再分批（每批 ≤ 3.5 MB）送回。
// 環境變數供應商（env-N）不在資料庫，不會匯出；還原時也會略過 env- 開頭的供應商 id。
// 不匯出：API Key 密文（只能用伺服器金鑰解，備份帶走也沒用、還增加外洩面）、doc_chunks（還原時重新切塊）、
// 檔案本體（在物件儲存；只匯出中繼資料）、登入紀錄、舊 D1 原始資料。
import { OWNER } from './repo/providers.js'
import { chunkStatements } from './repo/entities.js'

export const BACKUP_FORMAT = 'personal-ai-backup'
export const BACKUP_VERSION = 1
export const PAGE_BYTES = 3_500_000

// 還原順序即匯出順序（外鍵：projects → files → documents/conversations → messages …）
export const TABLES = {
  projects:        { cols: ['id', 'name', 'description', 'instructions', 'data', 'created_at', 'updated_at'], key: 'id' },
  providers:       { cols: ['id', 'name', 'base_url', 'api_key_hint', 'extra_headers', 'enabled', 'sort_order', 'created_at', 'updated_at'], key: 'id' },
  provider_models: { cols: ['id', 'provider_id', 'kind', 'model_id', 'display_name', 'enabled', 'sort_order', 'created_at'], key: 'id', noOwner: true, conflict: '(provider_id, kind, model_id)' },
  settings:        { cols: ['key', 'value', 'updated_at'], key: 'key', conflict: '(owner_id, key)' },
  profiles:        { cols: ['data', 'updated_at'], key: 'owner_id', conflict: '(owner_id)' },
  files:           { cols: ['id', 'project_id', 'filename', 'mime', 'size_bytes', 'sha256', 'storage_key', 'status', 'error', 'created_at', 'updated_at'], key: 'id' },
  documents:       { cols: ['id', 'project_id', 'file_id', 'title', 'doc_type', 'content', 'data', 'created_at', 'updated_at'], key: 'id' },
  conversations:   { cols: ['id', 'project_id', 'title', 'pinned', 'archived', 'provider_id', 'model_id', 'data', 'created_at', 'updated_at'], key: 'id' },
  messages:        { cols: ['id', 'conversation_id', 'seq', 'role', 'content', 'sources', 'attachments', 'meta', 'created_at'], key: 'id', noOwner: true, conflict: '(conversation_id, seq)' },
  skills:          { cols: ['id', 'name', 'description', 'instructions', 'trigger_mode', 'keywords', 'enabled', 'data', 'created_at', 'updated_at'], key: 'id' },
  memories:        { cols: ['id', 'project_id', 'content', 'kind', 'pinned', 'source_conversation_id', 'data', 'created_at', 'updated_at'], key: 'id' },
  prompts:         { cols: ['id', 'kind', 'title', 'content', 'created_at', 'updated_at'], key: 'id' },
}
export const TABLE_ORDER = Object.keys(TABLES)

const byteLen = (s) => new TextEncoder().encode(s).length

function exportWhere(table) {
  if (table === 'provider_models') return `t.provider_id IN (SELECT id FROM providers WHERE owner_id = $1 AND deleted_at IS NULL)`
  if (table === 'messages') return `t.conversation_id IN (SELECT id FROM conversations WHERE owner_id = $1 AND deleted_at IS NULL)`
  const soft = ['settings', 'profiles', 'provider_models', 'messages'].includes(table) ? '' : ' AND t.deleted_at IS NULL'
  return `t.owner_id = $1${soft}`
}

/** 匯出一頁。cursor = 上一頁最後一列的排序鍵（文字）。 */
export async function exportPage(db, table, cursor, ownerId = OWNER) {
  const def = TABLES[table]
  if (!def) throw new Error('未知的資料表')
  const keyExpr = def.key === 'id' && ['provider_models', 'messages'].includes(table) ? 't.id' : `t.${def.key}`
  const isNumeric = keyExpr === 't.id' && ['provider_models', 'messages'].includes(table)
  const params = [ownerId]
  let after = ''
  if (cursor != null && cursor !== '') {
    params.push(isNumeric ? Number(cursor) : String(cursor))
    after = ` AND ${keyExpr} > $2`
  }
  const rows = await db.query(
    `SELECT ${def.cols.map((c) => 't.' + c).join(', ')} FROM ${table} t WHERE ${exportWhere(table)}${after} ORDER BY ${keyExpr} LIMIT 500`, params)
  const out = []
  let bytes = 0
  for (const row of rows) {
    const size = byteLen(JSON.stringify(row))
    if (out.length && bytes + size > PAGE_BYTES) break
    out.push(row)
    bytes += size
  }
  const more = out.length < rows.length || rows.length === 500
  const last = out[out.length - 1]
  return { table, rows: out, next_cursor: more && last ? String(last[def.key === 'owner_id' ? 'key' : def.key] ?? '') : null }
}

function validateRows(table, rows) {
  if (!Array.isArray(rows)) throw new Error('rows 必須是陣列')
  if (rows.length > 2000) throw new Error('一次最多 2000 列')
  const def = TABLES[table]
  return rows.map((r) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('資料列格式不正確')
    const o = {}
    for (const c of def.cols) if (c in r) o[c] = r[c]
    return o
  })
}

/** 還原一批。以 jsonb_populate_recordset 轉型，id 相同則覆寫（還原為未刪除）。 */
export async function restoreRows(db, table, rawRows, ownerId = OWNER) {
  const def = TABLES[table]
  if (!def) throw new Error('未知的資料表')
  let rows = validateRows(table, rawRows)
  // 環境變數供應商只存在於部署設定，不能由備份建立
  if (table === 'providers') rows = rows.filter((r) => !/^env-/i.test(String(r.id || '')))
  // 0003 之前的備份沒有 kind：視為聊天模型
  if (table === 'provider_models') for (const r of rows) if (r.kind !== 'embed') r.kind = 'chat'
  if (!rows.length) return { table, restored: 0 }
  // 子表的外鍵只接受自己名下的父列
  if (table === 'provider_models' || table === 'messages') {
    const [parent, fk] = table === 'messages' ? ['conversations', 'conversation_id'] : ['providers', 'provider_id']
    const ids = [...new Set(rows.map((r) => String(r[fk] || '')))]
    const ok = new Set((await db.query(`SELECT id FROM ${parent} WHERE owner_id = $1 AND id = ANY($2::text[])`, [ownerId, ids])).map((r) => r.id))
    rows = rows.filter((r) => ok.has(String(r[fk])))
    if (!rows.length) return { table, restored: 0 }
  }
  // 其他外鍵（project_id、file_id、source_conversation_id）不存在就設 NULL，避免整批失敗
  const nullable = { project_id: 'projects', file_id: 'files', source_conversation_id: 'conversations' }
  for (const [col, parent] of Object.entries(nullable)) {
    if (!def.cols.includes(col)) continue
    const ids = [...new Set(rows.map((r) => r[col]).filter(Boolean).map(String))]
    if (!ids.length) continue
    const ok = new Set((await db.query(`SELECT id FROM ${parent} WHERE owner_id = $1 AND id = ANY($2::text[])`, [ownerId, ids])).map((r) => r.id))
    for (const r of rows) if (r[col] && !ok.has(String(r[col]))) r[col] = null
  }
  const insertCols = def.cols.filter((c) => !(c === 'id' && (table === 'messages' || table === 'provider_models')))
  const cols = def.noOwner ? insertCols : ['owner_id', ...insertCols]
  const select = def.noOwner ? insertCols.map((c) => 'r.' + c) : ['$2::text', ...insertCols.map((c) => 'r.' + c)]
  const conflict = def.conflict || '(id)'
  const keyCols = conflict.replace(/[()\s]/g, '').split(',')
  const updates = insertCols.filter((c) => !keyCols.includes(c)).map((c) => `${c} = EXCLUDED.${c}`)
  const hasSoft = !['settings', 'profiles', 'provider_models', 'messages'].includes(table)
  if (hasSoft) updates.push('deleted_at = NULL')
  const guard = def.noOwner ? '' : ` WHERE ${table}.owner_id = EXCLUDED.owner_id`
  const sql =
    `INSERT INTO ${table} (${cols.join(', ')})
     SELECT ${select.join(', ')} FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb) r
     ON CONFLICT ${conflict} DO ${updates.length ? `UPDATE SET ${updates.join(', ')}${guard}` : 'NOTHING'}`
  const statements = [[sql, def.noOwner ? [JSON.stringify(rows)] : [JSON.stringify(rows), ownerId]]]
  if (table === 'documents') for (const r of rows) statements.push(...chunkStatements(r.id, r.content || '', ownerId))
  await db.tx(statements)
  return { table, restored: rows.length }
}
