import { errorJson } from './config.js'

export const DEFAULT_CHAT_PATH = '/chat/completions'
export const DEFAULT_MODELS_PATH = '/models'
export const NO_PROVIDER_MESSAGE = '請先在設定中新增供應商並選擇模型'

export function normalizeBaseUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('請填寫 Base URL')
  let url
  try { url = new URL(raw) } catch { throw new Error('Base URL 格式不正確') }
  if (url.protocol !== 'https:') throw new Error('Base URL 必須使用 HTTPS')
  if (url.username || url.password) throw new Error('Base URL 不可包含帳號密碼')
  if (url.hash || url.search) throw new Error('Base URL 不可包含查詢字串或片段')
  if (isBlockedHost(url.hostname)) throw new Error('此主機位址不被允許')
  return url.toString().replace(/\/+$/, '')
}

export function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa') || host.endsWith('.lan')) return true
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true
  if (host.startsWith('::ffff:')) return isBlockedHost(host.slice(7))
  // IPv6 link-local and unique-local ranges only. Do not reject ordinary
  // hostnames that happen to begin with "fc" or "fd".
  if (host.includes(':') && (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd'))) return true
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number)
    if ([a, b, c, d].some((n) => n > 255)) return true
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
  }
  return false
}

export function chatCompletionsUrl(baseUrl) {
  const base = normalizeBaseUrl(baseUrl)
  if (/\/chat\/completions$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

export function modelsUrl(baseUrl) {
  const base = normalizeBaseUrl(baseUrl)
  if (/\/models$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/models`
  return `${base}/v1/models`
}

// 舊前端（瀏覽器保存 Key 的過渡模式）在請求內帶 provider / baseUrl。沒有任何內建供應商可退回。
export function providerFromBody(body) {
  const p = body && typeof body.provider === 'object' ? body.provider : null
  const baseUrl = p ? p.baseUrl : (body && body.baseUrl)
  const apiKey = p ? p.apiKey : (body && body.apiKey)
  const model = p ? p.model : (body && body.model)
  if (!baseUrl) throw new Error(NO_PROVIDER_MESSAGE)
  // 允許空 Key：自建模型 / 不需驗證的相容閘道。有填才做基本檢查。
  const key = apiKey == null ? '' : String(apiKey).trim()
  if (key && (key.length > 4096 || /[\r\n]/.test(key))) throw new Error('供應商 API Key 格式不正確')
  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey: key,
    model: String(model || '').trim().slice(0, 200),
  }
}

export function upstreamHeaders(apiKey, extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream, application/json',
    'User-Agent': 'personal-ai/2.0',
    ...extra,
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

// ── 環境變數供應商 ─────────────────────────────────────────
// PROVIDER_N_NAME / _BASE_URL（必填）、_API_KEY / _MODELS / _EMBED_MODELS（選填），N = 1..20，
// 全部掃描（中間有空號也繼續）。id 為 env-N。Key 只從環境變數讀取：不進資料庫、不回傳瀏覽器。
export const ENV_PROVIDER_MAX = 20
const ENV_ID_RE = /^env-(\d{1,2})$/

export function isEnvProviderId(id) {
  return typeof id === 'string' && /^env-/i.test(id)
}

export function parseModelIds(value) {
  const seen = new Set()
  const out = []
  for (const raw of String(value || '').split(',')) {
    const id = raw.trim()
    if (!id || id.length > 200 || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= 500) break
  }
  return out
}

/**
 * 掃描 PROVIDER_1_* … PROVIDER_20_*。回傳 {providers, errors}；
 * providers 含 api_key（僅供伺服器內部使用），errors 只含編號與原因（不含 Key）。
 */
export function scanEnvProviders(env = {}) {
  const providers = []
  const errors = []
  for (let n = 1; n <= ENV_PROVIDER_MAX; n++) {
    const get = (k) => (env[`PROVIDER_${n}_${k}`] == null ? '' : String(env[`PROVIDER_${n}_${k}`]).trim())
    const name = get('NAME').slice(0, 100)
    const rawBase = get('BASE_URL')
    if (!name && !rawBase) continue
    if (!name) { errors.push({ index: n, error: `PROVIDER_${n}_NAME 未設定` }); continue }
    if (!rawBase) { errors.push({ index: n, error: `PROVIDER_${n}_BASE_URL 未設定` }); continue }
    let baseUrl
    try { baseUrl = normalizeBaseUrl(rawBase) } catch (err) {
      errors.push({ index: n, error: `PROVIDER_${n}_BASE_URL：${err.message}` })
      continue
    }
    const apiKey = get('API_KEY')
    if (apiKey && (apiKey.length > 4096 || /[\r\n]/.test(apiKey))) {
      errors.push({ index: n, error: `PROVIDER_${n}_API_KEY 格式不正確` })
      continue
    }
    providers.push({
      id: `env-${n}`,
      index: n,
      name,
      base_url: baseUrl,
      api_key: apiKey,
      models: parseModelIds(get('MODELS')),
      embed_models: parseModelIds(get('EMBED_MODELS')),
    })
  }
  return { providers, errors }
}

export function envProviders(env = {}) {
  return scanEnvProviders(env).providers
}

export function envProvider(env, id) {
  const m = ENV_ID_RE.exec(String(id || ''))
  if (!m) return null
  return envProviders(env).find((p) => p.index === Number(m[1])) || null
}

/** 給瀏覽器看的環境變數供應商：唯讀、沒有 Key 也沒有 Key 提示。 */
export function publicEnvProvider(p) {
  const list = (ids) => ids.map((id, i) => ({ model_id: id, display_name: null, enabled: true, sort_order: i }))
  return {
    id: p.id,
    name: p.name,
    base_url: p.base_url,
    has_key: !!p.api_key,
    api_key_hint: '',
    enabled: true,
    sort_order: p.index,
    source: 'env',
    readonly: true,
    note: '由環境變數管理',
    models: list(p.models),
    embed_models: list(p.embed_models),
  }
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 120_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs)
  const onAbort = () => controller.abort('client-abort')
  if (options.signal) {
    if (options.signal.aborted) controller.abort('client-abort')
    else options.signal.addEventListener('abort', onAbort, { once: true })
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    if (options.signal) options.signal.removeEventListener('abort', onAbort)
  }
}

export async function readJsonLimited(response, maxBytes = 200_000) {
  const text = await response.text()
  if (text.length > maxBytes) throw new Error('上游回應過大')
  try { return JSON.parse(text) } catch { throw new Error('上游回應不是有效 JSON') }
}

export function providerError(status, detail = '') {
  const message = detail ? `供應商回傳 HTTP ${status}：${detail}` : `供應商回傳 HTTP ${status}`
  return errorJson(message, status === 401 || status === 403 ? 400 : 502, 'provider_error')
}