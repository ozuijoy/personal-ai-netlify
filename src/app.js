import {
  APP_NAME,
  APP_VERSION,
  appConfig,
  errorJson,
  json,
} from './config.js'
import {
  clearSessionCookie,
  createSession,
  passwordMatches,
  requireAuth,
  sessionCookie,
} from './auth.js'
import { getDb } from './db.js'
import { createStorage } from './storage.js'
import { maxUploadBytes } from './repo/files.js'
import { encryptionConfigured } from './crypto.js'
import { loginAllowed, recordLoginFailure, recordLoginSuccess } from './repo/login.js'
import { dataRoute } from './api_data.js'
import { loginResponse } from './login_page.js'
import { htmlResponse } from './html_shell.js'
import { applySecurityHeaders, previewFrameResponse, sameOriginRequest } from './security.js'
import { bodyErrorMessage, readFormBody, readJsonBody } from './body.js'
import { handleChat } from './chat.js'
import { chatContextLoader } from './repo/context.js'
import { handleImageRequest } from './images.js'
import { TOOLS, runTool } from './tools/registry.js'
import { DEFAULT_GROQ_MODEL, builtinEmbeddingProvider, fetchWithTimeout, modelsUrl, providerFromBody, upstreamHeaders } from './providers.js'
import { providerCredentials, resolveChatProvider } from './repo/providers.js'

// Netlify 版：靜態檔由 CDN 直接提供（public/），這個 router 只處理頁面與 /api/*。
// /api/chat 由 Edge Function 先攔截（見 netlify/edge-functions/chat.js），不會進到這裡；
// 這裡仍保留 /api/chat 作為本機測試與備援路徑（受 60 秒同步上限）。
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method.toUpperCase()

    let response
    try {
      if (path === '/api/health' && method === 'GET') {
        response = json({ ok: true, app: APP_NAME, version: APP_VERSION, time: new Date().toISOString() })
      } else if (path === '/api/config' && method === 'GET') {
        response = json({
          ok: true,
          app: APP_NAME,
          version: APP_VERSION,
          sync: false,
          storage: !!getDb(env),
          search: !!env.TAVILY_API_KEY,
          image: true,
          providers: true,
        })
      } else if (path === '/api/login') {
        response = await loginRoute(request, env)
      } else if (path === '/api/logout' && method === 'POST') {
        response = await logoutRoute(request, env)
      } else if (path === '/api/me' && method === 'GET') {
        response = await meRoute(request, env)
      } else if (path === '/login' && method === 'GET') {
        response = await loginPageRoute(request, env)
      } else if (path === '/sandbox/frame' && method === 'GET') {
        response = previewFrameResponse()
      } else if (path === '/robots.txt' && method === 'GET') {
        response = new Response('User-agent: *\nDisallow: /\n', {
          headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'public, max-age=3600' },
        })
      } else if (path.startsWith('/api/')) {
        response = await apiRoute(request, env, path, method)
      } else if (path === '/' || path === '/index.html') {
        const session = await requireAuth(request, env)
        if (!session) return redirect('/login')
        response = htmlResponse(request, env, { lang: preferredLang(request) })
      } else {
        response = new Response('Not found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
        })
      }
    } catch (err) {
      console.error('request failed', err && err.stack ? err.stack : err)
      response = errorJson('伺服器發生錯誤', 500, 'internal_error')
    }

    return applySecurityHeaders(request, response)
  },
}

async function apiRoute(request, env, path, method) {
  if (!['GET', 'HEAD'].includes(method) && !sameOriginRequest(request)) {
    return errorJson('跨來源請求被拒絕', 403, 'bad_origin')
  }
  if (path === '/api/chat') {
    if (method !== 'POST') return errorJson('Method not allowed', 405)
    if (!(await requireAuth(request, env))) return errorJson('請先登入', 401, 'unauthorized')
    return handleChat(request, env, {
      resolveProvider: (body, e) => resolveChatProvider(getDb(e), body, e),
      loadContext: getDb(env) ? chatContextLoader(getDb(env)) : undefined,
    })
  }
  if (path === '/api/image') {
    if (!['GET', 'POST'].includes(method)) return errorJson('Method not allowed', 405)
    if (!(await requireAuth(request, env))) return errorJson('請先登入', 401, 'unauthorized')
    return handleImageRequest(request, env)
  }
  if (path === '/api/models') {
    if (method !== 'POST') return errorJson('Method not allowed', 405)
    if (!(await requireAuth(request, env))) return errorJson('請先登入', 401, 'unauthorized')
    return modelsRoute(request, env)
  }
  if (path === '/api/tool') {
    if (method === 'GET') {
      if (!(await requireAuth(request, env))) return errorJson('請先登入', 401, 'unauthorized')
      return json({ ok: true, tools: TOOLS })
    }
    if (method !== 'POST') return errorJson('Method not allowed', 405)
    if (!(await requireAuth(request, env))) return errorJson('請先登入', 401, 'unauthorized')
    return toolRoute(request, env)
  }
  if (path === '/api/sync' || path === '/api/sync/status') {
    // 舊版 D1 同步已由伺服器為主的資料 API 取代。回 410 讓舊前端自動關閉同步。
    return errorJson('同步已改為伺服器儲存', 410, 'sync_replaced')
  }
  const data = await dataRoute(request, env, path, method)
  if (data) return data
  return errorJson('Not found', 404, 'not_found')
}

async function loginPageRoute(request, env) {
  const session = await requireAuth(request, env)
  if (session) return redirect('/')
  const url = new URL(request.url)
  return loginResponse({
    error: url.searchParams.get('error') || '',
    next: url.searchParams.get('next') || '/',
  })
}

async function loginRoute(request, env) {
  if (request.method !== 'POST') return errorJson('Method not allowed', 405)
  if (!sameOriginRequest(request)) return errorJson('跨來源請求被拒絕', 403, 'bad_origin')
  const cfg = appConfig(env)
  if (!cfg.hasPassword || !cfg.hasAuthSecret) {
    return errorJson('尚未設定 APP_PASSWORD 與 AUTH_SECRET', 503, 'auth_not_configured')
  }
  const db = getDb(env)
  if (!(await loginAllowed(db, request, env))) {
    return requestIsForm(request)
      ? redirect('/login?error=rate')
      : errorJson('嘗試次數過多，請稍後再試', 429, 'rate_limited')
  }

  let password = ''
  let next = '/'
  const isForm = requestIsForm(request)
  try {
    if (isForm) {
      const form = await readFormBody(request)
      password = form.get('password') || ''
      next = safeNext(form.get('next') || '/')
    } else {
      const body = await readJsonBody(request)
      password = String(body.password || '')
      next = safeNext(body.next || '/')
    }
  } catch (err) {
    return isForm ? redirect('/login?error=1') : errorJson(bodyErrorMessage(err), 400, 'invalid_body')
  }

  if (!password || !(await passwordMatches(password, env))) {
    await recordLoginFailure(db, request, env)
    return isForm ? redirect('/login?error=1') : errorJson('密碼不正確', 401, 'bad_password')
  }

  await recordLoginSuccess(db, request, env)
  const token = await createSession(env, cfg.sessionDays)
  const headers = new Headers({
    'Set-Cookie': sessionCookie(request, token, cfg.sessionDays * 86400),
    'Cache-Control': 'no-store',
  })
  if (isForm) {
    headers.set('Location', next)
    return new Response(null, { status: 303, headers })
  }
  return json({ ok: true, user: { name: 'Owner' } }, 200, { 'Set-Cookie': headers.get('Set-Cookie') })
}

async function logoutRoute(request, env) {
  if (!sameOriginRequest(request)) return errorJson('跨來源請求被拒絕', 403, 'bad_origin')
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) })
}

async function meRoute(request, env) {
  const session = await requireAuth(request, env)
  if (!session) return errorJson('請先登入', 401, 'unauthorized')
  return json({
    ok: true,
    user: { name: 'Owner' },
    config: {
      sync: false,
      storage: !!getDb(env),
      files: !!(getDb(env) && createStorage(env)),
      max_upload_mb: Math.round(maxUploadBytes(env) / 1048576),
      encryption: encryptionConfigured(env),
      search: !!env.TAVILY_API_KEY,
      image: true,
      defaultProvider: !!env.GROQ_API_KEY,
      embeddingBuiltin: !!builtinEmbeddingProvider(env),
      defaultModel: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
      version: APP_VERSION,
    },
  })
}

async function modelsRoute(request, env) {
  let body
  try { body = await readJsonBody(request) } catch (err) {
    return errorJson(bodyErrorMessage(err), 400, 'invalid_body')
  }
  let baseUrl
  let apiKey
  try {
    // 新前端傳 provider_id（Key 在伺服器端解密）；舊前端傳 baseUrl + apiKey。
    const provider = body.provider_id
      ? await providerCredentials(getDb(env), env, String(body.provider_id))
      : providerFromBody({ ...body, model: body.model || 'models' }, env)
    baseUrl = provider.baseUrl
    apiKey = provider.apiKey
  } catch (err) {
    return errorJson(err.message || '供應商設定不正確', 400, 'provider_config')
  }
  let upstream
  try {
    upstream = await fetchWithTimeout(modelsUrl(baseUrl), {
      headers: { ...upstreamHeaders(apiKey), Accept: 'application/json' },
      signal: request.signal,
    }, 30_000)
  } catch {
    return errorJson('無法連線到供應商', 502, 'provider_unreachable')
  }
  if (!upstream.ok) {
    return errorJson(`供應商回傳 HTTP ${upstream.status}`, upstream.status === 401 || upstream.status === 403 ? 400 : 502, 'provider_error')
  }
  let data
  try { data = await upstream.json() } catch { return errorJson('供應商回應格式不正確', 502, 'bad_provider_json') }
  const rows = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []
  const models = rows
    .map((row) => typeof row === 'string' ? row : row && (row.id || row.name))
    .filter((id) => typeof id === 'string' && id.length > 0 && id.length < 200)
    .slice(0, 500)
  return json({ ok: true, models })
}

async function toolRoute(request, env) {
  let body
  try { body = await readJsonBody(request) } catch (err) {
    return errorJson(bodyErrorMessage(err), 400, 'invalid_body')
  }
  const name = String(body.name || body.tool || '')
  if (!name) return errorJson('缺少工具名稱', 400, 'missing_tool')
  const result = await runTool(name, body.arguments || body.args || {}, env)
  return json(result, result.ok ? 200 : 400)
}

function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  })
}

function safeNext(value) {
  const text = String(value || '/')
  return text.startsWith('/') && !text.startsWith('//') ? text : '/'
}

function requestIsForm(request) {
  return /application\/x-www-form-urlencoded|multipart\/form-data/i.test(request.headers.get('content-type') || '')
}

function preferredLang(request) {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)ta_lang=([^;]+)/)
  if (match && /^zh-TW$/.test(decodeURIComponent(match[1]))) return 'zh-TW'
  const accept = request.headers.get('accept-language') || ''
  if (/^zh-TW|zh-Hant/i.test(accept)) return 'zh-TW'
  return 'zh-TW'
}