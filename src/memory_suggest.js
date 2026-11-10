// 第四階段：Memory 建議。由模型從最近對話找出值得長期記住的使用者資訊，**只回傳建議、不寫入**；
// 使用者在前端按「記住」後才 POST /api/memories。
// 部署時放在 Edge Function（等待上游不計 compute）；本機與測試走一般路由。
import { errorJson, json } from './config.js'
import { bodyErrorMessage, readJsonBody } from './body.js'
import { chatCompletionsUrl, fetchWithTimeout, upstreamHeaders } from './providers.js'
import { resolveChatProvider, OWNER } from './repo/providers.js'

const KINDS = ['fact', 'preference', 'instruction', 'note']
const SENSITIVE = [
  /\b(sk|gsk|nak|nsk|ghp|xox[abp])[-_][A-Za-z0-9_-]{8,}/i,
  /密碼|password|passcode|api[ _-]?key|token|secret|私鑰|助記詞|seed phrase/i,
  /\d{9,}/, // 證件、帳號、卡號一類的長數字
  /[A-Z]\d{9}/, // 台灣身分證字號格式
]

export const SUGGEST_SYSTEM =
  '你負責從對話中找出值得長期記住、關於使用者本人的資訊：身分背景、長期偏好、持續進行的計畫、使用者明確要你記住的事、對回答方式的固定要求。' +
  '不要記：一次性的問題內容、助理自己說的話、推測、已存在的記憶，以及敏感資料（密碼、金鑰、證件或帳戶號碼；健康、財務細節除非使用者明確要求記住）。' +
  '沒有就回傳空陣列。只輸出 JSON，不要其他文字：{"memories":[{"content":"…","kind":"fact|preference|instruction|note"}]}。' +
  'content 用繁體中文、以「使用者」為主詞，一條一件事，盡量 40 字以內，最多 3 條。'

export function normalizeMemory(text) {
  return String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '').replace(/^使用者/, '')
}

function bigrams(s) {
  const out = new Set()
  for (let i = 0; i + 2 <= s.length; i++) out.add(s.slice(i, i + 2))
  return out
}
/** 二字組 Dice 相似度（0–1），用來擋「喜歡簡短回答」與「喜歡簡短的回答」這類近似重複。 */
export function similarity(a, b) {
  const A = bigrams(a), B = bigrams(b)
  if (!A.size || !B.size) return a === b ? 1 : 0
  let common = 0
  for (const x of A) if (B.has(x)) common++
  return (2 * common) / (A.size + B.size)
}

export function parseSuggestions(raw, existing = []) {
  let data = null
  const text = String(raw || '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) { try { data = JSON.parse(text.slice(start, end + 1)) } catch {} }
  const list = data && Array.isArray(data.memories) ? data.memories : []
  const seen = existing.map(normalizeMemory).filter(Boolean)
  const out = []
  for (const item of list) {
    const content = String((item && (item.content || item.text)) || '').replace(/\s+/g, ' ').trim()
    if (content.length < 4 || content.length > 300) continue
    if (SENSITIVE.some((re) => re.test(content))) continue
    const norm = normalizeMemory(content)
    if (!norm || seen.some((s) => s === norm || (s.length >= 6 && (s.includes(norm) || norm.includes(s))) || similarity(s, norm) >= 0.7)) continue
    seen.push(norm)
    out.push({ content, kind: KINDS.includes(item.kind) ? item.kind : 'fact' })
    if (out.length >= 3) break
  }
  return out
}

function transcript(messages) {
  return messages.map((m) => `${m.role === 'user' ? '使用者' : '助理'}：${String(m.content || '').slice(0, 2000)}`).join('\n')
}

export async function handleMemorySuggest(request, env, db, { body, ownerId = OWNER } = {}) {
  if (!body) {
    try { body = await readJsonBody(request) } catch (err) {
      return errorJson(bodyErrorMessage(err), err.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, 'invalid_body')
    }
  }
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
    .slice(-6)
  if (!messages.some((m) => m.role === 'user')) return json({ ok: true, suggestions: [] })

  let provider
  try {
    provider = await resolveChatProvider(db, body, env, ownerId)
    if (!provider.model) throw new Error('請先選擇模型')
  } catch (err) {
    return errorJson(err.message || '供應商設定不正確', 400, 'provider_config')
  }
  const existing = (await db.query(
    `SELECT content FROM memories WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY pinned DESC, updated_at DESC LIMIT 150`, [ownerId],
  )).map((r) => r.content)

  let upstream
  try {
    upstream = await fetchWithTimeout(chatCompletionsUrl(provider.baseUrl), {
      method: 'POST',
      headers: upstreamHeaders(provider.apiKey),
      body: JSON.stringify({
        model: provider.model,
        stream: false,
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          { role: 'system', content: SUGGEST_SYSTEM },
          { role: 'user', content: `已存在的記憶：\n${existing.length ? existing.map((c) => '- ' + c).join('\n') : '（無）'}\n\n最近對話：\n${transcript(messages)}` },
        ],
      }),
      signal: request.signal,
    }, 25_000)
  } catch {
    return errorJson('無法連線到供應商', 502, 'provider_unreachable')
  }
  if (!upstream.ok) return errorJson(`供應商回傳 HTTP ${upstream.status}`, 502, 'provider_error')
  let content = ''
  try {
    const data = await upstream.json()
    content = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ''
  } catch {
    return errorJson('供應商回應格式不正確', 502, 'bad_provider_json')
  }
  return json({ ok: true, suggestions: parseSuggestions(content, existing) })
}
