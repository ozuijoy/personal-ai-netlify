// 網頁搜尋供應商（面板設定）：Jina（s.jina.ai）或 Tavily。
//
// 設定：settings 的 search.web = { provider: 'jina'|'tavily'|'off', maxResults, snippetChars, contextChars }
// Key：settings 的 secret.search.<provider> = { enc, hint }，以 AES-256-GCM 加密（ENCRYPTION_KEY），
//      AAD 為 owner_id + 設定鍵；secret.* 不經 /api/settings 回傳、不進備份。
// 未在面板設定時，退回環境變數：JINA_API_KEY 或 TAVILY_API_KEY（有 Jina 先用 Jina）。
// 換 Key：面板貼上新 Key 儲存即可（覆蓋舊值，免重新部署）。
import { OWNER } from './repo/providers.js'
import { getSettings, putSettings } from './repo/entities.js'
import { decryptSecret, encryptSecret, encryptionConfigured, keyHint, keyring } from './crypto.js'
import { searchLimits } from './tools/search.js'

export const WEB_SEARCH_PROVIDERS = {
  jina: { label: 'Jina', env: 'JINA_API_KEY' },
  tavily: { label: 'Tavily', env: 'TAVILY_API_KEY' },
}
const SETTING = 'search.web'
const secretKey = (p) => `secret.search.${p}`
const aad = (ownerId, p) => `${ownerId}:${secretKey(p)}`

function clampLimits(input = {}, base = {}) {
  const env = {
    SEARCH_MAX_RESULTS: input.maxResults ?? base.maxResults,
    SEARCH_SNIPPET_CHARS: input.snippetChars ?? base.snippetChars,
    SEARCH_CONTEXT_CHARS: input.contextChars ?? base.contextChars,
  }
  return searchLimits(env)
}

async function readSecret(settings, provider, ownerId, env) {
  const s = settings[secretKey(provider)]
  if (!s || !s.enc) return null
  try { return await decryptSecret(s.enc, aad(ownerId, provider), env) } catch { return null }
}

/** 聊天用：回傳 { provider, apiKey, limits } 或 { provider: null }。 */
export async function resolveWebSearch(db, env = {}, ownerId = OWNER) {
  let settings = {}
  try { if (db) settings = await getSettings(db, ownerId) } catch {}
  const cfg = settings[SETTING] || {}
  const limits = clampLimits(cfg, searchLimits(env))
  if (cfg.provider === 'off') return { provider: null, limits }
  const order = cfg.provider && WEB_SEARCH_PROVIDERS[cfg.provider] ? [cfg.provider] : ['jina', 'tavily']
  for (const p of order) {
    const key = (await readSecret(settings, p, ownerId, env)) || env[WEB_SEARCH_PROVIDERS[p].env] || ''
    if (key) return { provider: p, apiKey: key, limits }
  }
  return { provider: null, limits }
}

export async function webSearchStatus(db, env = {}, ownerId = OWNER) {
  const settings = await getSettings(db, ownerId)
  const cfg = settings[SETTING] || {}
  const resolved = await resolveWebSearch(db, env, ownerId)
  return {
    provider: cfg.provider || null,
    active: resolved.provider,
    limits: resolved.limits,
    encryption: encryptionConfigured(env),
    providers: Object.entries(WEB_SEARCH_PROVIDERS).map(([id, p]) => ({
      id,
      label: p.label,
      has_key: !!settings[secretKey(id)]?.enc,
      hint: settings[secretKey(id)]?.hint || '',
      env_key: !!env[p.env],
    })),
  }
}

/** body: { provider?, api_key?（空字串＝刪除該供應商 Key）, key_provider?, maxResults?, snippetChars?, contextChars? } */
export async function setWebSearchConfig(db, env = {}, body = {}, ownerId = OWNER) {
  const settings = await getSettings(db, ownerId)
  const cfg = { ...(settings[SETTING] || {}) }
  const patch = {}
  if (body.provider !== undefined) {
    const p = body.provider == null || body.provider === '' ? null : String(body.provider)
    if (p && p !== 'off' && !WEB_SEARCH_PROVIDERS[p]) throw Object.assign(new Error('搜尋供應商須為 jina、tavily 或 off'), { status: 400 })
    if (p) cfg.provider = p; else delete cfg.provider
  }
  if (body.api_key !== undefined) {
    const kp = String(body.key_provider || cfg.provider || '')
    if (!WEB_SEARCH_PROVIDERS[kp]) throw Object.assign(new Error('請先選擇要設定 Key 的搜尋供應商'), { status: 400 })
    const key = String(body.api_key || '').trim()
    if (!key) patch[secretKey(kp)] = null
    else {
      if (key.length > 500 || /\s/.test(key)) throw Object.assign(new Error('API Key 格式不正確'), { status: 400 })
      if (!encryptionConfigured(env)) throw Object.assign(new Error('伺服器未設定 ENCRYPTION_KEY，無法儲存 Key'), { status: 503 })
      const enc = await encryptSecret(key, aad(ownerId, kp), env)
      patch[secretKey(kp)] = { enc: enc.value, hint: keyHint(key) }
    }
  }
  for (const k of ['maxResults', 'snippetChars', 'contextChars']) {
    if (body[k] !== undefined) {
      if (body[k] === null || body[k] === '') delete cfg[k]
      else cfg[k] = clampLimits({ [k]: body[k] })[k]
    }
  }
  patch[SETTING] = Object.keys(cfg).length ? cfg : null
  await putSettings(db, patch, ownerId)
  return webSearchStatus(db, env, ownerId)
}

/** 金鑰輪替：重新加密 secret.search.*。 */
export async function rekeyWebSearchSecrets(db, env = {}, ownerId = OWNER) {
  const { current } = keyring(env)
  const settings = await getSettings(db, ownerId)
  const patch = {}
  const failed = []
  for (const p of Object.keys(WEB_SEARCH_PROVIDERS)) {
    const s = settings[secretKey(p)]
    if (!s?.enc || String(s.enc).split('.')[0] === current) continue
    try {
      const plain = await decryptSecret(s.enc, aad(ownerId, p), env)
      patch[secretKey(p)] = { enc: (await encryptSecret(plain, aad(ownerId, p), env)).value, hint: s.hint || keyHint(plain) }
    } catch (err) { failed.push({ id: secretKey(p), error: String(err.message || err).slice(0, 200) }) }
  }
  if (Object.keys(patch).length) await putSettings(db, patch, ownerId)
  return { rekeyed: Object.keys(patch).length, failed }
}
