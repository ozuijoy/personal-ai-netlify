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
import { errorJson, json } from './config.js'
import { requireAuth } from './auth.js'
import { bodyErrorMessage, readJsonBody } from './body.js'
import { getDb } from './db.js'
import { fetchWithTimeout, modelsUrl, upstreamHeaders } from './providers.js'
import {
  createProvider, deleteProvider, groupedModels, listProviders, providerCredentials, setProviderModels, updateProvider,
} from './repo/providers.js'
import {
  ENTITIES, createEntity, deleteEntity, getEntity, getProfile, getSettings, listEntities, putProfile, putSettings,
  searchDocuments, updateEntity,
} from './repo/entities.js'
import {
  appendMessages, deleteConversation, getConversation, listConversations, updateConversation, upsertConversation,
} from './repo/conversations.js'

const ID = '([A-Za-z0-9_-]{1,100})'
const KINDS = Object.keys(ENTITIES).join('|')

const ROUTES = [
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

  ['GET', /^\/api\/documents\/search$/, async ({ db, url }) => json({
    ok: true,
    results: await searchDocuments(db, url.searchParams.get('q'), { projectId: url.searchParams.get('project_id') || undefined }),
  })],
  ['GET', new RegExp(`^/api/(${KINDS})$`), async ({ db, url, m }) => json({
    ok: true,
    items: await listEntities(db, m[1], {
      q: url.searchParams.get('q') || undefined,
      projectId: url.searchParams.has('project_id') ? url.searchParams.get('project_id') : undefined,
      since: url.searchParams.get('since') || undefined,
      full: url.searchParams.get('full') === '1',
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
    // 使用者輸入錯誤（中文訊息）回 400；資料庫 / 程式錯誤不洩漏細節。
    if (/[\u4e00-\u9fff]/.test(msg)) return errorJson(msg.slice(0, 300), 400, 'invalid_input')
    console.error('data route failed', path, err && err.stack ? err.stack : err)
    return errorJson('伺服器發生錯誤', 500, 'internal_error')
  }
}
