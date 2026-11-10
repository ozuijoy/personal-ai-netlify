// 伺服器為主的資料 API（取代 localStorage + D1 同步）。所有路由都需登入。
//
//   GET    /api/settings                PUT /api/settings          {key: value | null}
//   GET    /api/profile                 PUT /api/profile           {...}
//   GET    /api/providers               POST /api/providers
//   PATCH  /api/providers/:id           DELETE /api/providers/:id
//   PUT    /api/providers/:id/models    {models:[...]}
//   POST   /api/providers/:id/discover  向上游 /models 取清單（不寫入）
//   GET    /api/models/grouped          模型選單（依供應商分組）
//   GET    /api/conversations           POST /api/conversations   （含 messages 時整份覆蓋）
//   GET    /api/conversations/:id       PATCH / PUT / DELETE /api/conversations/:id
//   POST   /api/conversations/:id/messages  {messages:[...]}       串流結束後追加
//   GET    /api/{projects|documents|skills|memories|prompts}[?q=&project_id=]
//   POST   /api/{kind}   GET|PATCH|DELETE /api/{kind}/:id
//   GET    /api/documents/search?q=&project_id=
//   GET    /api/files[?project_id=]      POST /api/files {filename, mime, size, project_id?} → presigned PUT
//   POST   /api/files/:id/complete      {text?, title?, extract, pages?} 上傳完成、寫入知識庫
//   GET    /api/files/:id/download[?inline=1]  → {url}（presigned GET，5 分鐘）
//   DELETE /api/files/:id
//   GET    /api/embeddings/status       PUT /api/embeddings/config {provider_id, model}   POST /api/embeddings/backfill
//   GET    /api/admin/keys              POST /api/admin/rekey（金鑰輪替後重新加密）
//   GET    /api/backup[?table=&cursor=] 分頁匯出   POST /api/backup/restore {table, rows}
//   POST   /api/memories/suggest       {messages, provider_id, model} → 建議（不寫入）
import { errorJson, json } from './config.js'
import { requireAuth } from './auth.js'
import { bodyErrorMessage, readJsonBody } from './body.js'
import { getDb } from './db.js'
import { fetchWithTimeout, modelsUrl, upstreamHeaders } from './providers.js'
import {
  createProvider, deleteProvider, keyStatus, rekeyProviders, groupedModels, listProviders, providerCredentials, setProviderModels, updateProvider,
} from './repo/providers.js'
import {
  ENTITIES, createEntity, deleteEntity, getEntity, getProfile, getSettings, listEntities, putProfile, putSettings,
  searchDocuments, updateEntity,
} from './repo/entities.js'
import {
  appendMessages, deleteConversation, getConversation, listConversations, updateConversation, upsertConversation,
} from './repo/conversations.js'
import { completeFile, createPendingFile, deleteFile, getFile, listFiles, maxUploadBytes } from './repo/files.js'
import { createStorage } from './storage.js'
import { handleMemorySuggest } from './memory_suggest.js'
import { backfillEmbeddings, embeddingStatus, hybridSearch, setEmbeddingConfig } from './embeddings.js'
import { BACKUP_FORMAT, BACKUP_VERSION, TABLE_ORDER, exportPage, restoreRows } from './backup.js'

const ID = '([A-Za-z0-9_-]{1,100})'
const KINDS = Object.keys(ENTITIES).join('|')

function needStorage(env) {
  const storage = createStorage(env)
  if (!storage) {
    const err = new Error('物件儲存未設定（STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY）')
    err.status = 503
    throw err
  }
  return storage
}

const ROUTES = [
  // 部署時由 Edge Function 接手同一路徑；這裡供 netlify dev / 測試使用
  ['POST', /^\/api\/memories\/suggest$/, async ({ request, env, db, body }) => handleMemorySuggest(request, env, db, { body })],
  ['GET', /^\/api\/files$/, async ({ db, url }) => json({ ok: true, files: await listFiles(db, { projectId: url.searchParams.get('project_id') || undefined }) })],
  ['POST', /^\/api\/files$/, async ({ db, env, body }) => {
    const storage = needStorage(env)
    const file = await createPendingFile(db, env, body)
    const upload = await storage.uploadUrl(file.storage_key)
    delete file.storage_key
    return json({ ok: true, file, upload: { ...upload, headers: { 'Content-Type': file.mime } }, max_bytes: maxUploadBytes(env) }, 201)
  }],
  ['POST', new RegExp(`^/api/files/${ID}/complete$`), async ({ db, env, body, m }) => {
    const out = await completeFile(db, env, needStorage(env), m[1], body)
    return out ? json({ ok: true, ...out }) : errorJson('找不到資料', 404, 'not_found')
  }],
  ['GET', new RegExp(`^/api/files/${ID}$`), async ({ db, m }) => found(await getFile(db, m[1]), 'file')],
  ['GET', new RegExp(`^/api/files/${ID}/download$`), async ({ db, env, m, url }) => {
    const storage = needStorage(env)
    const file = await getFile(db, m[1], undefined, { withKey: true })
    if (!file || file.status === 'pending') return errorJson('找不到資料', 404, 'not_found')
    const inline = url.searchParams.get('inline') === '1'
    return json({ ok: true, url: await storage.downloadUrl(file.storage_key, { filename: file.filename, mime: file.mime, inline }) })
  }],
  ['DELETE', new RegExp(`^/api/files/${ID}$`), async ({ db, env, m }) => ok(await deleteFile(db, createStorage(env), m[1]))],

  ['GET', /^\/api\/settings$/, async ({ db }) => json({ ok: true, settings: await getSettings(db) })],
  ['PUT', /^\/api\/settings$/, async ({ db, body }) => json({ ok: true, settings: await putSettings(db, body.settings || body) })],
  ['GET', /^\/api\/profile$/, async ({ db }) => json({ ok: true, profile: await getProfile(db) })],
  ['PUT', /^\/api\/profile$/, async ({ db, body }) => json({ ok: true, profile: await putProfile(db, body.profile || body) })],

  ['GET', /^\/api\/providers$/, async ({ db, env }) => json({ ok: true, providers: await listProviders(db, env) })],
  ['POST', /^\/api\/providers$/, async ({ db, env, body }) => json({ ok: true, provider: await createProvider(db, env, body) }, 201)],
  ['PATCH', new RegExp(`^/api/providers/${ID}$`), async ({ db, env, body, m }) => found(await updateProvider(db, env, m[1], body), 'provider')],
  ['DELETE', new RegExp(`^/api/providers/${ID}$`), async ({ db, m }) => ok(await deleteProvider(db, m[1]))],
  ['PUT', new RegExp(`^/api/providers/${ID}/models$`), async ({ db, env, body, m }) => found(await setProviderModels(db, env, m[1], body.models), 'provider')],
  ['POST', new RegExp(`^/api/providers/${ID}/discover$`), async ({ db, env, m, request }) => discoverModels(db, env, m[1], request)],
  ['GET', /^\/api\/models\/grouped$/, async ({ db, env }) => json({ ok: true, groups: await groupedModels(db, env) })],

  ['GET', /^\/api\/conversations$/, async ({ db, url }) => json({
    ok: true,
    conversations: await listConversations(db, {
      projectId: url.searchParams.get('project_id') || undefined,
      since: url.searchParams.get('since') || undefined,
      archived: url.searchParams.has('archived') ? url.searchParams.get('archived') === '1' : undefined,
    }),
  })],
  ['POST', /^\/api\/conversations$/, async ({ db, body }) => json({ ok: true, conversation: await upsertConversation(db, body) }, 201)],
  ['GET', new RegExp(`^/api/conversations/${ID}$`), async ({ db, m }) => found(await getConversation(db, m[1]), 'conversation')],
  ['PUT', new RegExp(`^/api/conversations/${ID}$`), async ({ db, body, m }) => json({ ok: true, conversation: await upsertConversation(db, { ...body, id: m[1] }) })],
  ['PATCH', new RegExp(`^/api/conversations/${ID}$`), async ({ db, body, m }) => found(await updateConversation(db, m[1], body), 'conversation')],
  ['DELETE', new RegExp(`^/api/conversations/${ID}$`), async ({ db, m }) => ok(await deleteConversation(db, m[1]))],
  ['POST', new RegExp(`^/api/conversations/${ID}/messages$`), async ({ db, body, m }) => {
    const r = await appendMessages(db, m[1], body.messages)
    return r ? json(r) : errorJson('找不到對話', 404, 'not_found')
  }],

  ['GET', /^\/api\/documents\/search$/, async ({ db, env, url }) => json({
    ok: true,
    ...(await hybridSearch(db, env, url.searchParams.get('q'), { projectId: url.searchParams.get('project_id') || undefined })),
  })],
  // 語意檢索（第五階段）
  ['GET', /^\/api\/embeddings\/status$/, async ({ db }) => json({ ok: true, status: await embeddingStatus(db) })],
  ['PUT', /^\/api\/embeddings\/config$/, async ({ db, env, body }) => {
    const config = await setEmbeddingConfig(db, env, body)
    return json({ ok: true, config, status: await embeddingStatus(db) })
  }],
  ['POST', /^\/api\/embeddings\/backfill$/, async ({ db, env, request }) => json({ ok: true, ...(await backfillEmbeddings(db, env, { signal: request.signal })) })],
  // 金鑰輪替
  ['GET', /^\/api\/admin\/keys$/, async ({ db, env }) => json({ ok: true, keys: await keyStatus(db, env) })],
  ['POST', /^\/api\/admin\/rekey$/, async ({ db, env }) => {
    const r = await rekeyProviders(db, env)
    return json({ ok: true, ...r, keys: await keyStatus(db, env) })
  }],
  // 備份
  ['GET', /^\/api\/backup$/, async ({ db, url }) => {
    const table = url.searchParams.get('table')
    if (!table) return json({ ok: true, format: BACKUP_FORMAT, version: BACKUP_VERSION, tables: TABLE_ORDER })
    return json({ ok: true, ...(await exportPage(db, table, url.searchParams.get('cursor'))) })
  }],
  ['POST', /^\/api\/backup\/restore$/, async ({ db, body }) => json({ ok: true, ...(await restoreRows(db, String(body.table || ''), body.rows)) })],
  ['GET', new RegExp(`^/api/(${KINDS})$`), async ({ db, url, m }) => json({
    ok: true,
    items: await listEntities(db, m[1], {
      q: url.searchParams.get('q') || undefined,
      projectId: url.searchParams.has('project_id') ? url.searchParams.get('project_id') : undefined,
      since: url.searchParams.get('since') || undefined,
      full: url.searchParams.get('full') === '1' ? true : url.searchParams.get('full') === 'compact' ? 'compact' : false,
      limit: url.searchParams.get('limit') || undefined,
    }),
  })],
  ['POST', new RegExp(`^/api/(${KINDS})$`), async ({ db, body, m }) => json({ ok: true, item: await createEntity(db, m[1], body) }, 201)],
  ['GET', new RegExp(`^/api/(${KINDS})/${ID}$`), async ({ db, m }) => found(await getEntity(db, m[1], m[2]), 'item')],
  ['PATCH', new RegExp(`^/api/(${KINDS})/${ID}$`), async ({ db, body, m }) => found(await updateEntity(db, m[1], m[2], body), 'item')],
  ['DELETE', new RegExp(`^/api/(${KINDS})/${ID}$`), async ({ db, m }) => ok(await deleteEntity(db, m[1], m[2]))],
]

function found(value, key) {
  return value ? json({ ok: true, [key]: value }) : errorJson('找不到資料', 404, 'not_found')
}
function ok(done) {
  return done ? json({ ok: true }) : errorJson('找不到資料', 404, 'not_found')
}

async function discoverModels(db, env, id, request) {
  const cred = await providerCredentials(db, env, id)
  let upstream
  try {
    upstream = await fetchWithTimeout(modelsUrl(cred.baseUrl), {
      headers: { ...upstreamHeaders(cred.apiKey), Accept: 'application/json' },
      signal: request.signal,
    }, 20_000)
  } catch {
    return errorJson('無法連線到供應商', 502, 'provider_unreachable')
  }
  if (!upstream.ok) return errorJson(`供應商回傳 HTTP ${upstream.status}`, 502, 'provider_error')
  let data
  try { data = await upstream.json() } catch { return errorJson('供應商回應格式不正確', 502, 'bad_provider_json') }
  const rows = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []
  const models = rows
    .map((r) => (typeof r === 'string' ? r : r && (r.id || r.name)))
    .filter((x) => typeof x === 'string' && x && x.length < 200)
    .slice(0, 500)
  return json({ ok: true, models })
}

/** 回傳 Response；路徑不屬於資料 API 時回 null。 */
export async function dataRoute(request, env, path, method) {
  const candidates = ROUTES.filter(([, re]) => re.test(path))
  if (!candidates.length) return null
  const route = candidates.find(([verb]) => verb === method)
  if (!route) return errorJson('Method not allowed', 405)
  if (!(await requireAuth(request, env))) return errorJson('請先登入', 401, 'unauthorized')
  const db = getDb(env)
  if (!db) return errorJson('伺服器未設定 DATABASE_URL', 503, 'storage_disabled')

  let body = {}
  if (['POST', 'PUT', 'PATCH'].includes(method) && !/\/discover$/.test(path)) {
    try { body = await readJsonBody(request) } catch (err) {
      return errorJson(bodyErrorMessage(err), err.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, 'invalid_body')
    }
  }
  try {
    return await route[2]({ request, env, db, body, url: new URL(request.url), m: path.match(route[1]) })
  } catch (err) {
    const msg = err && err.message ? String(err.message) : ''
    if (err && err.status === 503) return errorJson(msg, 503, 'storage_not_configured')
    // 使用者輸入錯誤（中文訊息）回 400；資料庫 / 程式錯誤不洩漏細節。
    if (/[\u4e00-\u9fff]/.test(msg)) return errorJson(msg.slice(0, 300), 400, 'invalid_input')
    console.error('data route failed', path, err && err.stack ? err.stack : err)
    return errorJson('伺服器發生錯誤', 500, 'internal_error')
  }
}
