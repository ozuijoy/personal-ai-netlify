// 內建「文件」工具：讓聊天模型主動列出、檢索、讀取與儲存知識庫文件（documents 表）。
//
// 工具名稱一律以 docs__ 開頭（與 MCP 的 mcp<hex>__<tool> 不會衝突）：
//   docs__list    列出文件（與專案清單）           唯讀，前端免確認
//   docs__search  全文／混合檢索，回片段與文件 id   唯讀，前端免確認
//   docs__read    依 id 讀整份，可用 offset 分段     唯讀，前端免確認
//   docs__save    新增或修改文件（可只改標題／搬資料夾）  寫入，前端必須顯示確認卡
//   docs__edit    局部取代（old_text → new_text）    寫入，前端必須顯示確認卡
//   docs__create_folder  建立專案（＝資料夾），同名不重建  前端免確認（無破壞性）
//   docs__delete  軟刪除文件                         前端必須顯示確認卡
//
// 開關：settings 的 tools.docs（未設定＝開啟；false / "false" / "0" / 0 ＝關閉）。
// 關閉時不注入給模型，伺服器端呼叫也會拒絕。
// 執行：前端呼叫 POST /api/tools/call {name, arguments}；docs__ 交給 callDocTool，web__ 交給 callWebTool（src/web_tool.js），其餘交給 MCP。
// 向量：寫入後 doc_chunks 會由 createEntity / updateEntity 重新切塊；語意向量沿用前端的
//       maybeBackfillEmbeddings（/api/embeddings/backfill）補齊，與一般文件儲存流程相同。
import { OWNER } from './repo/providers.js'
import { createEntity, deleteEntity, getEntity, getSettings, listEntities, searchDocuments, updateEntity } from './repo/entities.js'
import { hybridSearch } from './embeddings.js'
import { resolveWebTools } from './web_tool.js'

export const DOC_TOOL_PREFIX = 'docs__'
export const DOC_TOOL_SETTING = 'tools.docs'
export const READ_DEFAULT_CHARS = 20_000
const MAX_LIST = 50
const MAX_SAVE_CHARS = 200_000
const MAX_RESULT_CHARS = 24_000
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status })

export const isDocTool = (name) => String(name || '').startsWith(DOC_TOOL_PREFIX)

/** settings 的 tools.docs：未設定預設開啟。 */
export function docToolsEnabled(settings) {
  const v = settings ? settings[DOC_TOOL_SETTING] : undefined
  if (v === undefined || v === null) return true
  return !(v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false' || String(v).toLowerCase() === 'off')
}

const PROJECT_PARAM = { type: 'string', description: '專案 id 或專案名稱（可省略）。' }

export const DOC_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'docs__list',
      description: '列出使用者知識庫裡的文件（id、標題、所屬專案、類型、字數、更新日期），並附上專案（＝資料夾）清單與各專案文件數、未分類文件數。' +
        '使用者問「我有哪些文件／筆記」、要找某份文件但不知道 id、或要把內容存進某個專案前不確定專案名稱時使用。' +
        'query 只比對標題；要依內容找資料請用 docs__search。',
      parameters: {
        type: 'object',
        properties: {
          project_id: PROJECT_PARAM,
          query: { type: 'string', description: '標題關鍵字（可省略）。' },
          limit: { type: 'integer', description: `最多幾筆，預設 20，上限 ${MAX_LIST}。` },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs__search',
      description: '在使用者的知識庫文件內容中全文檢索，回傳最相關的片段與 document_id。' +
        '需要根據使用者自己的文件、筆記、上傳檔案回答問題，而對話中附上的文件片段不夠時使用；要看完整內容再用 docs__read。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '檢索字詞或問題。' },
          project_id: PROJECT_PARAM,
          limit: { type: 'integer', description: '最多幾個片段，預設 6，上限 20。' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs__read',
      description: '依 id 讀取一份文件的全文。文件很長時會分段：回傳 total_length 與 next_offset，' +
        `再以 offset=next_offset 呼叫讀下一段。每次最多 ${READ_DEFAULT_CHARS} 字。id 可從 docs__list 或 docs__search 取得。`,
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '文件 id。' },
          offset: { type: 'integer', description: '從第幾個字元開始讀，預設 0。' },
          max_chars: { type: 'integer', description: `這次最多讀幾個字元，預設與上限 ${READ_DEFAULT_CHARS}。` },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs__save',
      description: '把內容存成使用者知識庫裡的文件：不帶 id ＝新增一份筆記；帶 id ＝修改該文件（mode=replace 取代全文，mode=append 接在文末）。' +
        '只在使用者明確要求儲存、記下、建立或修改文件時使用。每次執行前使用者都會看到確認卡，可能拒絕；' +
        '只有本工具回傳成功後才能說已儲存。專案即資料夾：要放進某個資料夾就指定 project_id（資料夾不存在時先用 docs__create_folder 建立）。' +
        '只改標題或搬到別的資料夾時，帶 id 與 title／project_id 即可，不必重送 content；只改一小段請用 docs__edit。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '要修改的文件 id；新增時省略。' },
          title: { type: 'string', description: '文件標題（新增時必填；修改時省略＝不變）。' },
          content: { type: 'string', description: '文件內容（Markdown 純文字）。新增時必填；修改時省略＝內容不變。' },
          project_id: { type: 'string', description: '專案（資料夾）id 或名稱（可省略＝不屬於任何專案；修改時省略＝不變；空字串＝移出資料夾）。' },
          mode: { type: 'string', enum: ['replace', 'append'], description: '修改時的方式，預設 replace。' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs__edit',
      description: '局部修改一份文件：把 old_text 換成 new_text（old_text 必須逐字出現在文件中，含空白與標點）。' +
        '比 docs__save 整份重寫更安全，適合改錯字、改一段、刪一段（new_text 給空字串）。先用 docs__read 看原文再改。執行前使用者會看到確認卡。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '文件 id。' },
          old_text: { type: 'string', description: '要被取代的原文片段（逐字複製）。' },
          new_text: { type: 'string', description: '新的內容；空字串＝刪除該片段。' },
          replace_all: { type: 'boolean', description: 'old_text 出現多次時是否全部取代；預設 false（出現多次會回報錯誤）。' },
        },
        required: ['id', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs__create_folder',
      description: '建立一個新的專案（＝資料夾）。使用者要求新建資料夾／專案，或要把文件存進一個還不存在的資料夾時使用。' +
        '同名資料夾已存在時不會重複建立，直接回傳既有的 id。建立後可用回傳的 id 當 docs__save 的 project_id。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '資料夾（專案）名稱。' },
          description: { type: 'string', description: '簡短說明（可省略）。' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs__delete',
      description: '刪除一份文件（移到伺服器的軟刪除，不是永久抹除）。只在使用者明確要求刪除時使用；執行前使用者會看到確認卡。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '文件 id。' } },
        required: ['id'],
      },
    },
  },
]

/** 給模型的內建工具；開關關閉時回空陣列。 */
export async function resolveDocTools(db, ownerId = OWNER) {
  return docToolsEnabled(await getSettings(db, ownerId)) ? DOC_TOOLS : []
}

/**
 * 內建文件工具＋內建網路搜尋工具（web__search）＋MCP 工具（聊天注入用）。任一來源失敗不影響其他來源。
 * env：用來解析網路搜尋服務（面板 Key 或 JINA_API_KEY／TAVILY_API_KEY）；沒有搜尋服務時不含 web__search。
 */
export async function resolveAllTools(db, resolveMcp, ownerId = OWNER, env = {}) {
  let docs = []
  let web = []
  let mcp = []
  try { docs = await resolveDocTools(db, ownerId) } catch (err) { console.error('doc tools load failed', err && err.message) }
  try { web = await resolveWebTools(db, env || {}, ownerId) } catch (err) { console.error('web tools load failed', err && err.message) }
  try { mcp = resolveMcp ? (await resolveMcp(db, ownerId)) || [] : [] } catch (err) { console.error('mcp tools load failed', err && err.message) }
  return [...docs, ...web, ...mcp]
}

// ---- 共用 ----

function parseArgs(args) {
  if (typeof args === 'string') {
    try { args = args.trim() ? JSON.parse(args) : {} } catch { throw bad('工具參數不是有效的 JSON') }
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) args = {}
  if (JSON.stringify(args).length > MAX_SAVE_CHARS + 10_000) throw bad('工具參數過大')
  return args
}

const intIn = (v, def, min, max) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}

async function projectList(db, ownerId) {
  const rows = await listEntities(db, 'projects', { limit: 200 }, ownerId)
  return rows.map((p) => ({ id: p.id, name: p.name }))
}

/** 專案 id 或名稱 → {id, name}；空值回 null；找不到丟錯並列出現有專案。 */
async function resolveProject(db, input, ownerId) {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  const list = await projectList(db, ownerId)
  const byId = list.find((p) => p.id === raw)
  if (byId) return byId
  const lower = raw.toLowerCase()
  const exact = list.filter((p) => String(p.name || '').trim().toLowerCase() === lower)
  if (exact.length === 1) return exact[0]
  const partial = exact.length ? [] : list.filter((p) => String(p.name || '').toLowerCase().includes(lower))
  if (partial.length === 1) return partial[0]
  const names = list.map((p) => `${p.name}（${p.id}）`).join('、') || '（目前沒有任何專案）'
  throw bad(`${exact.length > 1 || partial.length > 1 ? '有多個專案符合' : '找不到專案'}「${raw.slice(0, 100)}」。現有專案：${names}`)
}

function out(obj) {
  const text = JSON.stringify(obj, null, 1)
  return text.length > MAX_RESULT_CHARS ? text.slice(0, MAX_RESULT_CHARS) + '\n…（已截斷）' : text
}

// ---- 各工具 ----

async function list(db, a, ownerId) {
  const projects = await projectList(db, ownerId)
  const names = Object.fromEntries(projects.map((p) => [p.id, p.name]))
  const project = a.project_id ? await resolveProject(db, a.project_id, ownerId) : null
  const limit = intIn(a.limit, 20, 1, MAX_LIST)
  const params = [ownerId]
  const where = ['owner_id = $1', 'deleted_at IS NULL']
  if (project) { params.push(project.id); where.push(`project_id = $${params.length}`) }
  const q = String(a.query || '').trim().slice(0, 200)
  if (q) { params.push(`%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`); where.push(`title ILIKE $${params.length}`) }
  const total = Number((await db.query(`SELECT count(*)::int AS n FROM documents WHERE ${where.join(' AND ')}`, params))[0]?.n) || 0
  params.push(limit)
  const rows = await db.query(
    `SELECT id, title, project_id, doc_type, char_length(content) AS length, updated_at
       FROM documents WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT $${params.length}`, params)
  // 每個專案（＝資料夾）的文件數，讓模型一次掌握整體結構
  const counts = await db.query(
    `SELECT project_id, count(*)::int AS n FROM documents WHERE owner_id = $1 AND deleted_at IS NULL GROUP BY project_id`, [ownerId])
  const countOf = Object.fromEntries(counts.map((r) => [r.project_id || '', Number(r.n) || 0]))
  const day = (v) => (v instanceof Date ? v.toISOString() : String(v || '')).slice(0, 10)
  const documents = rows.map((r) => ({
    id: r.id, title: r.title || '（無標題）', project: r.project_id ? names[r.project_id] || r.project_id : null,
    project_id: r.project_id || null, type: r.doc_type, chars: Number(r.length) || 0, updated: day(r.updated_at),
  }))
  return {
    content: out({
      count: documents.length, total, ...(total > documents.length ? { hint: `只列出最近更新的 ${documents.length} 份；可用 project_id、query 或 limit 縮小範圍。` } : {}),
      documents,
      projects: projects.slice(0, MAX_LIST).map((p) => ({ id: p.id, name: p.name, documents: countOf[p.id] || 0 })),
      unassigned: countOf[''] || 0,
    }),
    summary: project ? `已列出「${project.name}」的 ${documents.length} 份文件` : `已列出 ${documents.length} 份文件（共 ${total} 份）`,
  }
}

async function search(db, env, a, ownerId) {
  const query = String(a.query || '').trim().slice(0, 400)
  if (!query) throw bad('請提供 query')
  const project = a.project_id ? await resolveProject(db, a.project_id, ownerId) : null
  const limit = intIn(a.limit, 6, 1, 20)
  let rows
  try {
    rows = (await hybridSearch(db, env, query, { projectId: project ? project.id : undefined, limit }, ownerId)).results
  } catch {
    rows = await searchDocuments(db, query, { projectId: project ? project.id : undefined, limit }, ownerId)
  }
  const results = (rows || []).map((r) => ({
    document_id: r.document_id, title: r.title || '（無標題）', chunk_index: r.chunk_index,
    snippet: String(r.content || '').slice(0, 1500),
  }))
  return {
    content: out({ query, count: results.length, results, hint: results.length ? '要看全文請用 docs__read 並帶 document_id。' : '沒有找到相關片段。' }),
    summary: `已搜尋文件：「${query.slice(0, 40)}」，${results.length} 個片段`,
  }
}

async function read(db, a, ownerId) {
  const id = String(a.id || '').trim()
  if (!ID_RE.test(id)) throw bad('文件 id 格式不正確')
  const doc = await getEntity(db, 'documents', id, ownerId)
  if (!doc) throw bad('找不到這份文件', 404)
  const content = String(doc.content || '')
  const offset = intIn(a.offset, 0, 0, content.length)
  const max = intIn(a.max_chars, READ_DEFAULT_CHARS, 100, READ_DEFAULT_CHARS)
  const part = content.slice(offset, offset + max)
  const end = offset + part.length
  let project = null
  if (doc.project_id) project = (await projectList(db, ownerId)).find((p) => p.id === doc.project_id) || null
  return {
    content: out({
      id: doc.id, title: doc.title || '（無標題）', project: project ? project.name : null, type: doc.doc_type,
      total_length: content.length, offset, returned: part.length,
      next_offset: end < content.length ? end : null, content: part,
    }),
    summary: `已讀取文件：${doc.title || '（無標題）'}${offset || end < content.length ? `（${offset}–${end} / ${content.length} 字）` : ''}`,
  }
}

async function save(db, a, ownerId) {
  const id = a.id == null ? '' : String(a.id).trim()
  if (a.content != null && typeof a.content !== 'string') throw bad('content 必須是文字')
  const hasContent = typeof a.content === 'string'
  const content = hasContent ? a.content : ''
  if (content.length > MAX_SAVE_CHARS) throw bad(`內容過長（上限 ${MAX_SAVE_CHARS} 字）`)
  const title = a.title == null ? '' : String(a.title).trim().slice(0, 500)
  const hasProject = a.project_id !== undefined && a.project_id !== null
  const project = hasProject ? await resolveProject(db, a.project_id, ownerId) : null
  if (!id && !hasContent) throw bad('新增文件需要 content')
  let item
  let action
  if (!id) {
    if (!title) throw bad('新增文件需要 title')
    if (!content.trim()) throw bad('新增文件需要 content')
    item = await createEntity(db, 'documents', {
      title, content, doc_type: 'note', project_id: project ? project.id : null,
      data: { legacy_type: 'note', created: Date.now(), source: 'docs_tool' },
    }, ownerId)
    action = 'created'
  } else {
    if (!ID_RE.test(id)) throw bad('文件 id 格式不正確')
    const doc = await getEntity(db, 'documents', id, ownerId)
    if (!doc) throw bad('找不到這份文件', 404)
    if (doc.file_id && hasContent) throw bad('這份文件由上傳檔案抽出，不能用工具修改內容；請另存一份新文件（改標題或搬資料夾可以）')
    const mode = a.mode === 'append' ? 'append' : 'replace'
    const patch = {}
    if (hasContent) {
      if (mode === 'append') {
        const base = String(doc.content || '')
        patch.content = base ? base.replace(/\s+$/, '') + '\n\n' + content : content
      } else patch.content = content
      if (patch.content.length > MAX_SAVE_CHARS * 4) throw bad('文件合併後過長')
    }
    if (title) patch.title = title
    if (hasProject) patch.project_id = project ? project.id : null
    if (!Object.keys(patch).length) throw bad('沒有要修改的內容：請提供 content、title 或 project_id')
    item = await updateEntity(db, 'documents', id, patch, ownerId)
    action = !hasContent ? (hasProject && !title ? 'moved' : 'updated') : mode === 'append' ? 'appended' : 'updated'
  }
  let projectName = null
  if (item.project_id) projectName = project && project.id === item.project_id ? project.name
    : ((await projectList(db, ownerId)).find((p) => p.id === item.project_id) || {}).name || null
  const chars = String(item.content || '').length
  const verb = action === 'created' ? '新增' : action === 'appended' ? '附加' : action === 'moved' ? '搬移' : '修改'
  return {
    content: out({ ok: true, action, id: item.id, title: item.title, project: projectName, project_id: item.project_id || null, chars }),
    summary: `已${verb}文件：${item.title || '（無標題）'}`,
    action,
    // 前端用：刷新文件快取（檔案類文件不會走到這裡，故給全文）
    item: {
      id: item.id, project_id: item.project_id, file_id: item.file_id, title: item.title, doc_type: item.doc_type,
      content: item.content, length: chars, data: item.data, created_at: item.created_at, updated_at: item.updated_at,
    },
  }
}

function docItem(item) {
  return {
    id: item.id, project_id: item.project_id, file_id: item.file_id, title: item.title, doc_type: item.doc_type,
    content: item.content, length: String(item.content || '').length, data: item.data, created_at: item.created_at, updated_at: item.updated_at,
  }
}

async function edit(db, a, ownerId) {
  const id = String(a.id || '').trim()
  if (!ID_RE.test(id)) throw bad('文件 id 格式不正確')
  if (typeof a.old_text !== 'string' || !a.old_text) throw bad('請提供 old_text（要取代的原文片段）')
  if (typeof a.new_text !== 'string') throw bad('請提供 new_text（可為空字串）')
  const doc = await getEntity(db, 'documents', id, ownerId)
  if (!doc) throw bad('找不到這份文件', 404)
  if (doc.file_id) throw bad('這份文件由上傳檔案抽出，不能用工具修改；請另存一份新文件')
  const base = String(doc.content || '')
  const n = base.split(a.old_text).length - 1
  if (!n) throw bad('文件中找不到 old_text。請先用 docs__read 讀取原文，逐字複製要改的片段（含空白與標點）再試。')
  if (n > 1 && a.replace_all !== true) throw bad(`old_text 在文件中出現 ${n} 次；請多帶一些前後文讓它唯一，或設 replace_all=true。`)
  const next = a.replace_all === true ? base.split(a.old_text).join(a.new_text) : base.replace(a.old_text, () => a.new_text)
  if (next.length > MAX_SAVE_CHARS * 4) throw bad('修改後文件過長')
  const item = await updateEntity(db, 'documents', id, { content: next }, ownerId)
  return {
    content: out({ ok: true, action: 'edited', id: item.id, title: item.title, replaced: a.replace_all === true ? n : 1, chars: next.length }),
    summary: `已修改文件：${item.title || '（無標題）'}（取代 ${a.replace_all === true ? n : 1} 處）`,
    action: 'edited',
    item: docItem(item),
  }
}

async function createFolder(db, a, ownerId) {
  const name = String(a.name || '').trim().slice(0, 200)
  if (!name) throw bad('請提供資料夾名稱 name')
  const existing = (await projectList(db, ownerId)).find((p) => String(p.name || '').trim().toLowerCase() === name.toLowerCase())
  if (existing) {
    return {
      content: out({ ok: true, action: 'exists', id: existing.id, name: existing.name, hint: '同名資料夾已存在，直接使用這個 id。' }),
      summary: `資料夾已存在：${existing.name}`,
    }
  }
  const p = await createEntity(db, 'projects', { name, description: String(a.description || '').slice(0, 2000), instructions: '', data: { source: 'docs_tool' } }, ownerId)
  return {
    content: out({ ok: true, action: 'created', id: p.id, name: p.name, hint: '之後用這個 id 當 docs__save 的 project_id。' }),
    summary: `已建立資料夾：${p.name}`,
    action: 'folder_created',
    project: { id: p.id, name: p.name, description: p.description || '', instructions: p.instructions || '', data: p.data || {}, updated_at: p.updated_at },
  }
}

async function remove(db, a, ownerId) {
  const id = String(a.id || '').trim()
  if (!ID_RE.test(id)) throw bad('文件 id 格式不正確')
  const doc = await getEntity(db, 'documents', id, ownerId)
  if (!doc) throw bad('找不到這份文件', 404)
  await deleteEntity(db, 'documents', id, ownerId)
  return {
    content: out({ ok: true, action: 'deleted', id, title: doc.title }),
    summary: `已刪除文件：${doc.title || '（無標題）'}`,
    action: 'deleted',
    deleted_id: id,
  }
}

/** 執行 docs__ 工具。回傳 {server, tool, is_error, content, summary, action?, item?}；參數錯誤以 is_error 回給模型。 */
export async function callDocTool(db, env = {}, body = {}, ownerId = OWNER) {
  const fn = String(body.name || '')
  const tool = DOC_TOOLS.find((t) => t.function.name === fn)
  if (!tool) throw bad('找不到這個文件工具', 404)
  if (!docToolsEnabled(await getSettings(db, ownerId))) throw bad('文件工具已在設定中關閉', 403)
  const a = parseArgs(body.arguments)
  const base = { server: '文件', tool: fn.slice(DOC_TOOL_PREFIX.length) }
  try {
    let r
    if (fn === 'docs__list') r = await list(db, a, ownerId)
    else if (fn === 'docs__search') r = await search(db, env, a, ownerId)
    else if (fn === 'docs__read') r = await read(db, a, ownerId)
    else if (fn === 'docs__edit') r = await edit(db, a, ownerId)
    else if (fn === 'docs__create_folder') r = await createFolder(db, a, ownerId)
    else if (fn === 'docs__delete') r = await remove(db, a, ownerId)
    else r = await save(db, a, ownerId)
    return { ...base, is_error: false, ...r }
  } catch (err) {
    if (!err || !err.status || err.status >= 500) throw err
    // 使用者／模型輸入錯誤：當成工具錯誤回給模型，讓它修正後再試
    return { ...base, is_error: true, content: String(err.message || err), summary: `文件工具錯誤：${String(err.message || '').slice(0, 80)}` }
  }
}
