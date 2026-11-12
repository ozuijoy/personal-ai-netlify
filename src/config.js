export const APP_NAME = 'Personal AI'
export const APP_VERSION = '2.0.0-alpha.1'

export const SESSION_DAYS_DEFAULT = 30
// Netlify Functions 緩衝請求上限 6 MB（官方 functions/configuration），留餘裕取 5 MB。
export const MAX_BODY_BYTES = 5 * 1024 * 1024
export const MAX_PROMPT_CHARS = 50_000
export const MAX_HISTORY_MESSAGES = 24
export const MAX_MESSAGE_CHARS = 40_000

export function appConfig(env = {}) {
  const sessionDays = Number.parseInt(env.SESSION_DAYS || '', 10)
  return {
    appName: APP_NAME,
    sessionDays: Number.isFinite(sessionDays) ? Math.min(365, Math.max(1, sessionDays)) : SESSION_DAYS_DEFAULT,
    appOrigin: String(env.APP_ORIGIN || '').replace(/\/+$/, ''),
    hasPassword: !!env.APP_PASSWORD,
    hasAuthSecret: !!env.AUTH_SECRET,
    hasTavily: !!(env.TAVILY_API_KEY || env.JINA_API_KEY),
    hasDb: !!(env.DATABASE_URL || env.NETLIFY_DATABASE_URL || env.__db),
    hasEncryption: !!env.ENCRYPTION_KEY,
  }
}

export function isHttps(request) {
  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return false
  }
}

export function requestOrigin(request) {
  try {
    return new URL(request.url).origin
  } catch {
    return ''
  }
}

export function sessionCookieName(request) {
  // __Host- cookies must be Secure and Path=/ with no Domain. Workers dev is
  // HTTPS too, but keeping the fallback makes local `wrangler dev` usable.
  return isHttps(request) ? '__Host-session' : 'ta_session'
}

export function siteOrigin(request, env) {
  return appConfig(env).appOrigin || requestOrigin(request)
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

export function errorJson(message, status = 400, code = '') {
  return json({ ok: false, error: message, code }, status)
}