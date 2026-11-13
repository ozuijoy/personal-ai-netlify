// MCP（Model Context Protocol）遠端工具，面板設定。
//
// 只支援 Streamable HTTP 傳輸（modelcontextprotocol.io/specification/2025-06-18/basic/transports）：
// 每則 JSON-RPC 都是一次 POST；Accept 同時列 application/json 與 text/event-stream；回應可能是 JSON 或 SSE；
// initialize 回應帶 Mcp-Session-Id 時之後每次都要帶上；之後的請求帶 MCP-Protocol-Version。
// Netlify Functions 不能啟動子行程，所以 stdio 類 MCP 伺服器無法使用；舊版 HTTP+SSE（2024-11-05）也未支援。
//
// 設定：settings 的 mcp.servers = [{ id, name, url, header_name, enabled, disabled_tools[], tools[], tools_at, tools_error }]
// Token：settings 的 secret.mcp.<id> = { enc, hint }（AES-256-GCM；secret.* 不經 /api/settings、不進備份）。
//
// 安全：工具一律不自動執行。聊天時伺服器只把工具清單交給模型；模型要呼叫工具時，前端顯示確認卡，
// 使用者按「允許」才呼叫 POST /api/mcp/call，結果再送回模型。
import { OWNER } from './repo/providers.js'
import { getSettings, putSettings } from './repo/entities.js'
import { decryptSecret, encryptSecret, encryptionConfigured, keyHint, keyring } from './crypto.js'
import { fetchWithTimeout, isBlockedHost } from './providers.js'

export const MCP_PROTOCOL_VERSION = '2025-06-18'
const SETTING = 'mcp.servers'
const MAX_SERVERS = 10
const MAX_TOOLS = 50
const MAX_RESULT_CHARS = 12_000
const secretKey = (id) => `secret.mcp.${id}`
const aad = (ownerId, id) => `${ownerId}:${secretKey(id)}`
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status })

export function normalizeMcpUrl(input) {
  let url
  try { url = new URL(String(input || '').trim()) } catch { throw bad('MCP 網址格式不正確') }
  if (url.protocol !== 'https:') throw bad('MCP 網址必須使用 HTTPS')
  if (url.username || url.password) throw bad('MCP 網址不可包含帳號密碼')
  if (url.hash) throw bad('MCP 網址不可包含 #片段')
  if (isBlockedHost(url.hostname)) throw bad('此主機位址不被允許')
  return url.toString()
}

function cleanHeaderName(v) {
  const h = String(v || 'Authorization').trim()
  if (!/^[A-Za-z0-9-]{1,64}$/.test(h)) throw bad('標頭名稱只能用英數字與 -')
  if (/^(host|content-type|content-length|accept|cookie|mcp-session-id|mcp-protocol-version)$/i.test(h)) throw bad('不能使用這個標頭名稱')
  return h
}

/** OpenAI function 名稱限 ^[a-zA-Z0-9_-]{1,64}$：<serverId>__<工具名> */
export function functionName(serverId, tool) {
  const t = String(tool || '').replace(/[^A-Za-z0-9_-]/g, '_')
  return `${serverId}__${t}`.slice(0, 64)
}

async function servers(db, ownerId) {
  const s = await getSettings(db, ownerId)
  return { settings: s, list: Array.isArray(s[SETTING]) ? s[SETTING] : [] }
}

async function tokenFor(settings, id, ownerId, env) {
  const s = settings[secretKey(id)]
  if (!s || !s.enc) return ''
  try { return await decryptSecret(s.enc, aad(ownerId, id), env) } catch { return '' }
}

function authHeaders(server, token) {
  if (!token) return {}
  const name = server.header_name || 'Authorization'
  const value = /^authorization$/i.test(name) && !/^(bearer|basic|token)\s/i.test(token) ? `Bearer ${token}` : token
  return { [name]: value }
}

// ---- Streamable HTTP 客戶端 ----

function parseSse(text, id) {
  let found = null
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n')
    if (!data) continue
    try {
      const msg = JSON.parse(data)
      const list = Array.isArray(msg) ? msg : [msg]
      for (const m of list) if (m && m.id === id && ('result' in m || 'error' in m)) found = m
    } catch {}
  }
  return found
}

export function mcpSession(server, token, { timeoutMs = 25_000, fetchImpl } = {}) {
  let sessionId = ''
  let version = ''
  let nextId = 1
  const doFetch = fetchImpl || fetchWithTimeout
  async function post(payload) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...authHeaders(server, token),
    }
    if (sessionId) headers['Mcp-Session-Id'] = sessionId
    if (version) headers['MCP-Protocol-Version'] = version
    let res
    try {
      res = await doFetch(server.url, { method: 'POST', headers, body: JSON.stringify(payload), redirect: 'manual' }, timeoutMs)
    } catch (err) {
      throw bad(err && err.name === 'AbortError' ? 'MCP 伺服器逾時' : '無法連線到 MCP 伺服器', 502)
    }
    return res
  }
  async function request(method, params) {
    const id = nextId++
    const res = await post({ jsonrpc: '2.0', id, method, params })
    const sid = res.headers.get('mcp-session-id')
    if (sid && /^[\x21-\x7e]{1,512}$/.test(sid)) sessionId = sid
    const text = await res.text()
    if (!res.ok) {
      let detail = ''
      try { const j = JSON.parse(text); detail = j?.error?.message || j?.message || '' } catch { detail = text.slice(0, 200) }
      throw bad(`MCP 伺服器回傳 HTTP ${res.status}${detail ? `：${String(detail).slice(0, 300)}` : ''}`, res.status === 401 || res.status === 403 ? 400 : 502)
    }
    if (text.length > 2_000_000) throw bad('MCP 回應過大', 502)
    const type = (res.headers.get('content-type') || '').toLowerCase()
    let msg = null
    if (type.includes('text/event-stream')) msg = parseSse(text, id)
    else { try { msg = JSON.parse(text) } catch {} ; if (Array.isArray(msg)) msg = msg.find((m) => m && m.id === id) || null }
    if (!msg) throw bad('MCP 回應格式不正確', 502)
    if (msg.error) throw bad(`MCP 錯誤：${String(msg.error.message || msg.error.code || '').slice(0, 300)}`, 502)
    return msg.result || {}
  }
  async function notify(method, params) {
    try { await post({ jsonrpc: '2.0', method, ...(params ? { params } : {}) }) } catch {}
  }
  return {
    async initialize() {
      const r = await request('initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'personal-ai-netlify', version: '1.0.0' },
      })
      version = String(r.protocolVersion || MCP_PROTOCOL_VERSION).slice(0, 32)
      await notify('notifications/initialized')
      return r
    },
    request,
  }
}

function sanitizeTool(t) {
  if (!t || typeof t.name !== 'string' || !t.name) return null
  let schema = t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : { type: 'object', properties: {} }
  if (JSON.stringify(schema).length > 8000) schema = { type: 'object', properties: {} }
  return {
    name: t.name.slice(0, 128),
    description: String(t.description || t.title || '').slice(0, 800),
    inputSchema: schema,
    readOnly: !!(t.annotations && t.annotations.readOnlyHint),
  }
}

async function fetchTools(server, token, opts) {
  const s = mcpSession(server, token, opts)
  await s.initialize()
  const tools = []
  let cursor
  for (let page = 0; page < 5 && tools.length < MAX_TOOLS; page++) {
    const r = await s.request('tools/list', cursor ? { cursor } : {})
    for (const t of Array.isArray(r.tools) ? r.tools : []) { const c = sanitizeTool(t); if (c) tools.push(c) }
    if (!r.nextCursor) break
    cursor = r.nextCursor
  }
  return tools.slice(0, MAX_TOOLS)
}

function toolResultText(r) {
  const parts = []
  for (const c of Array.isArray(r.content) ? r.content : []) {
    if (!c) continue
    if (c.type === 'text') parts.push(String(c.text || ''))
    else if (c.type === 'resource' && c.resource) parts.push(String(c.resource.text || c.resource.uri || ''))
    else if (c.type === 'resource_link') parts.push(`${c.name || ''} ${c.uri || ''}`.trim())
    else parts.push(`[${c.type} 內容未顯示]`)
  }
  if (!parts.length && r.structuredContent) parts.push(JSON.stringify(r.structuredContent))
  const text = parts.join('\n').trim() || '（工具沒有回傳文字內容）'
  return text.length > MAX_RESULT_CHARS ? text.slice(0, MAX_RESULT_CHARS) + '\n…（已截斷）' : text
}

// ---- 面板 API ----

function publicServer(s, settings) {
  return {
    id: s.id, name: s.name, url: s.url, header_name: s.header_name || 'Authorization',
    enabled: s.enabled !== false,
    has_token: !!settings[secretKey(s.id)]?.enc,
    token_hint: settings[secretKey(s.id)]?.hint || '',
    disabled_tools: s.disabled_tools || [],
    tools: (s.tools || []).map((t) => ({ name: t.name, description: t.description, readOnly: !!t.readOnly })),
    tools_at: s.tools_at || null,
    tools_error: s.tools_error || '',
  }
}

export async function listMcpServers(db, env = {}, ownerId = OWNER) {
  const { settings, list } = await servers(db, ownerId)
  return { servers: list.map((s) => publicServer(s, settings)), encryption: encryptionConfigured(env) }
}

async function tokenPatch(id, token, env, ownerId) {
  const t = String(token || '').trim()
  if (!t) return { [secretKey(id)]: null }
  if (t.length > 4000 || /[\r\n]/.test(t)) throw bad('Token 格式不正確')
  if (!encryptionConfigured(env)) throw bad('伺服器未設定 ENCRYPTION_KEY，無法儲存 Token', 503)
  const enc = await encryptSecret(t, aad(ownerId, id), env)
  return { [secretKey(id)]: { enc: enc.value, hint: keyHint(t) } }
}

async function refreshOne(db, env, ownerId, id, opts) {
  const { settings, list } = await servers(db, ownerId)
  const s = list.find((x) => x.id === id)
  if (!s) throw bad('找不到 MCP 伺服器', 404)
  try {
    s.tools = await fetchTools(s, await tokenFor(settings, id, ownerId, env), opts)
    s.tools_error = ''
  } catch (err) {
    s.tools_error = String(err.message || err).slice(0, 300)
  }
  s.tools_at = new Date().toISOString()
  await putSettings(db, { [SETTING]: list }, ownerId)
  return publicServer(s, await getSettings(db, ownerId))
}

export async function createMcpServer(db, env = {}, body = {}, ownerId = OWNER, opts) {
  const { list } = await servers(db, ownerId)
  if (list.length >= MAX_SERVERS) throw bad(`最多 ${MAX_SERVERS} 個 MCP 伺服器`)
  const id = 'mcp' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('')
  const server = {
    id,
    name: String(body.name || '').trim().slice(0, 60) || new URL(normalizeMcpUrl(body.url)).hostname,
    url: normalizeMcpUrl(body.url),
    header_name: cleanHeaderName(body.header_name),
    enabled: true,
    disabled_tools: [],
    tools: [],
  }
  const patch = { [SETTING]: [...list, server] }
  if (body.token) Object.assign(patch, await tokenPatch(id, body.token, env, ownerId))
  await putSettings(db, patch, ownerId)
  return refreshOne(db, env, ownerId, id, opts)
}

export async function updateMcpServer(db, env = {}, id, body = {}, ownerId = OWNER, opts) {
  const { list } = await servers(db, ownerId)
  const s = list.find((x) => x.id === id)
  if (!s) throw bad('找不到 MCP 伺服器', 404)
  let needRefresh = false
  if (body.name !== undefined) s.name = String(body.name || '').trim().slice(0, 60) || s.name
  if (body.url !== undefined) { const u = normalizeMcpUrl(body.url); if (u !== s.url) { s.url = u; needRefresh = true } }
  if (body.header_name !== undefined) { s.header_name = cleanHeaderName(body.header_name); needRefresh = true }
  if (body.enabled !== undefined) s.enabled = !!body.enabled
  if (body.disabled_tools !== undefined) {
    s.disabled_tools = (Array.isArray(body.disabled_tools) ? body.disabled_tools : []).map((x) => String(x).slice(0, 128)).slice(0, MAX_TOOLS)
  }
  const patch = { [SETTING]: list }
  if (body.token !== undefined) { Object.assign(patch, await tokenPatch(id, body.token, env, ownerId)); needRefresh = true }
  await putSettings(db, patch, ownerId)
  if (needRefresh || body.refresh) return refreshOne(db, env, ownerId, id, opts)
  return publicServer(s, await getSettings(db, ownerId))
}

export async function refreshMcpServer(db, env, id, ownerId = OWNER, opts) {
  return refreshOne(db, env, ownerId, id, opts)
}

export async function deleteMcpServer(db, id, ownerId = OWNER) {
  const { list } = await servers(db, ownerId)
  if (!list.some((x) => x.id === id)) return false
  const rest = list.filter((x) => x.id !== id)
  await putSettings(db, { [SETTING]: rest.length ? rest : null, [secretKey(id)]: null }, ownerId)
  return true
}

// ---- 聊天 ----

/** 給模型的 tools 陣列（OpenAI 格式）與 function 名稱 → 伺服器/工具 對照。 */
export async function resolveMcpTools(db, ownerId = OWNER) {
  const { list } = await servers(db, ownerId)
  const tools = []
  for (const s of list) {
    if (s.enabled === false) continue
    const off = new Set(s.disabled_tools || [])
    for (const t of s.tools || []) {
      if (off.has(t.name) || tools.length >= 64) continue
      tools.push({
        type: 'function',
        function: {
          name: functionName(s.id, t.name),
          description: `[${s.name}] ${t.description || t.name}`.slice(0, 1000),
          parameters: t.inputSchema && t.inputSchema.type === 'object' ? t.inputSchema : { type: 'object', properties: {} },
        },
      })
    }
  }
  return tools
}

/** 前端在使用者按「允許」後呼叫。 */
export async function callMcpTool(db, env = {}, body = {}, ownerId = OWNER, opts) {
  const fn = String(body.name || '')
  const { settings, list } = await servers(db, ownerId)
  const s = list.find((x) => fn.startsWith(x.id + '__'))
  if (!s || s.enabled === false) throw bad('找不到這個工具，或它所屬的 MCP 伺服器已停用', 404)
  const tool = (s.tools || []).find((t) => functionName(s.id, t.name) === fn)
  if (!tool || (s.disabled_tools || []).includes(tool.name)) throw bad('找不到這個工具，或它已停用', 404)
  let args = body.arguments
  if (typeof args === 'string') { try { args = args.trim() ? JSON.parse(args) : {} } catch { throw bad('工具參數不是有效的 JSON') } }
  if (!args || typeof args !== 'object' || Array.isArray(args)) args = {}
  if (JSON.stringify(args).length > 20_000) throw bad('工具參數過大')
  const session = mcpSession(s, await tokenFor(settings, s.id, ownerId, env), { timeoutMs: 45_000, ...(opts || {}) })
  await session.initialize()
  const r = await session.request('tools/call', { name: tool.name, arguments: args })
  return { server: s.name, tool: tool.name, is_error: !!r.isError, content: toolResultText(r) }
}

/** 金鑰輪替：重新加密 secret.mcp.*。 */
export async function rekeyMcpSecrets(db, env = {}, ownerId = OWNER) {
  const { current } = keyring(env)
  const { settings, list } = await servers(db, ownerId)
  const patch = {}
  const failed = []
  for (const s of list) {
    const sec = settings[secretKey(s.id)]
    if (!sec?.enc || String(sec.enc).split('.')[0] === current) continue
    try {
      const plain = await decryptSecret(sec.enc, aad(ownerId, s.id), env)
      patch[secretKey(s.id)] = { enc: (await encryptSecret(plain, aad(ownerId, s.id), env)).value, hint: sec.hint || keyHint(plain) }
    } catch (err) { failed.push({ id: secretKey(s.id), error: String(err.message || err).slice(0, 200) }) }
  }
  if (Object.keys(patch).length) await putSettings(db, patch, ownerId)
  return { rekeyed: Object.keys(patch).length, failed }
}
