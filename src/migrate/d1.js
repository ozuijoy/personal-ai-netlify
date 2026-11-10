// 舊版 D1 sync_items → Neon 資料表的轉換（純函式，方便測試）。
// 規則：deleted = 1 的列只寫入 legacy_sync_items，不建立實體；同 id 已存在則覆蓋（可重跑）。
import { createEntity, putSettings } from '../repo/entities.js'
import { upsertConversation } from '../repo/conversations.js'

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/
const SETTING_MAP = { custom_prompt: 'custom_prompt', tone: 'tone', len_mode: 'len_mode', auto_search: 'auto_search', use_docs: 'use_docs' }

/** 接受 wrangler d1 execute --json 的輸出（[{results:[...]}]）或單純的列陣列。 */
export function parseD1Export(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  if (Array.isArray(data) && data.length && Array.isArray(data[0].results)) return data.flatMap((d) => d.results)
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  if (data && Array.isArray(data.items)) {
    // /api/sync GET 的輸出格式
    return data.items.map((i) => ({ owner_id: 'owner', item_key: i.key, value: i.value, updated_at: i.updatedAt, deleted: i.deleted ? 1 : 0 }))
  }
  throw new Error('無法辨識的 D1 匯出格式')
}

const ms = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : Date.now() }
const safeParse = (v) => { try { return JSON.parse(v) } catch { return null } }

export function planImport(rows) {
  const plan = { conversations: [], documents: [], projects: [], prompts: [], settings: {}, skipped: [], legacy: [] }
  for (const r of rows) {
    const key = String(r.item_key || r.key || '')
    plan.legacy.push({ owner_id: r.owner_id || 'owner', item_key: key, value: r.value ?? null, updated_at: ms(r.updated_at), deleted: !!Number(r.deleted) })
    if (Number(r.deleted)) continue
    const idx = key.indexOf(':')
    const type = key.slice(0, idx)
    const id = key.slice(idx + 1)
    if (type === 'setting') {
      if (SETTING_MAP[id]) plan.settings[SETTING_MAP[id]] = String(r.value ?? '')
      else plan.skipped.push({ key, reason: 'unknown setting' })
      continue
    }
    if (type === 'prompt') {
      const list = safeParse(r.value)
      if (Array.isArray(list)) {
        list.slice(0, 500).forEach((p, i) => {
          const content = typeof p === 'string' ? p : p && (p.text || p.content || p.prompt)
          if (content) plan.prompts.push({ kind: id === 'recent' ? 'recent' : 'favorite', title: (p && p.title) || '', content: String(content), _order: i })
        })
      }
      continue
    }
    const value = safeParse(r.value)
    if (!value || typeof value !== 'object' || !ID_RE.test(id)) { plan.skipped.push({ key, reason: 'bad value or id' }); continue }
    if (type === 'chat') {
      plan.conversations.push({
        id,
        title: value.title || '',
        project_id: value.projectId || null,
        pinned: !!value.pinned,
        archived: !!value.archived,
        data: { legacy_updated_at: ms(value.updatedAt || r.updated_at) },
        messages: Array.isArray(value.messages) ? value.messages : [],
      })
    } else if (type === 'doc') {
      plan.documents.push({
        id,
        title: value.title || '',
        content: String(value.content || ''),
        doc_type: value.type === 'note' || !value.type ? 'note' : (['file', 'knowledge', 'web'].includes(value.type) ? value.type : 'note'),
        project_id: value.projectId || null,
        data: { legacy_type: value.type || null, created: value.created || null, lang: value.lang || null },
      })
    } else if (type === 'project') {
      const { id: _i, name, description, instructions, ...rest } = value
      plan.projects.push({ id, name: name || '未命名專案', description: description || '', instructions: instructions || '', data: rest })
    } else {
      plan.skipped.push({ key, reason: 'unknown type' })
    }
  }
  return plan
}

/** 依序寫入：先專案（被外鍵參照）→ 文件 → 對話 → prompts → 設定 → 原始列。 */
export async function runImport(db, plan, { log = () => {} } = {}) {
  const projectIds = new Set()
  for (const p of plan.projects) { await createEntity(db, 'projects', p); projectIds.add(p.id) }
  log(`projects: ${plan.projects.length}`)
  const fixProject = (pid) => (pid && projectIds.has(pid) ? pid : null)
  for (const d of plan.documents) await createEntity(db, 'documents', { ...d, project_id: fixProject(d.project_id) })
  log(`documents: ${plan.documents.length}`)
  for (const c of plan.conversations) await upsertConversation(db, { ...c, project_id: fixProject(c.project_id) })
  log(`conversations: ${plan.conversations.length}`)
  for (const p of plan.prompts) await createEntity(db, 'prompts', p)
  log(`prompts: ${plan.prompts.length}`)
  if (Object.keys(plan.settings).length) await putSettings(db, plan.settings)
  log(`settings: ${Object.keys(plan.settings).length}`)
  for (const l of plan.legacy) {
    await db.query(
      `INSERT INTO legacy_sync_items (owner_id, item_key, value, updated_at, deleted) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (owner_id, item_key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted, imported_at = now()`,
      [l.owner_id, l.item_key, l.value, l.updated_at, l.deleted],
    )
  }
  log(`legacy rows: ${plan.legacy.length}; skipped: ${plan.skipped.length}`)
  return { projects: plan.projects.length, documents: plan.documents.length, conversations: plan.conversations.length, prompts: plan.prompts.length, settings: Object.keys(plan.settings).length, skipped: plan.skipped }
}
