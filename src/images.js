import { errorJson } from './config.js'

const ALLOWED_MODELS = new Set(['flux', 'turbo'])
const MAX_PROMPT = 500

export function parseDataImage(dataUrl) {
  const text = String(dataUrl || '')
  const m = text.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/)
  if (!m) throw new Error('圖片格式不支援')
  const bytes = Uint8Array.from(atob(m[2].replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('圖片不可超過 4 MB')
  return { mime: m[1], bytes }
}

export function normalizeImageOptions(input = {}) {
  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw new Error('請輸入圖片提示詞')
  if (prompt.length > MAX_PROMPT) throw new Error(`提示詞不可超過 ${MAX_PROMPT} 字`)
  const width = clampInt(input.width, 1024, 256, 1536)
  const height = clampInt(input.height, 1024, 256, 1536)
  const model = ALLOWED_MODELS.has(String(input.model || 'flux')) ? String(input.model || 'flux') : 'flux'
  let seed = Number.parseInt(input.seed, 10)
  if (!Number.isFinite(seed)) seed = crypto.getRandomValues(new Uint32Array(1))[0] % 2_147_483_647
  return { prompt, width, height, model, seed: Math.abs(seed) }
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function buildPollinationsUrl(options) {
  const { prompt, width, height, model, seed } = normalizeImageOptions(options)
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    nologo: 'true',
    seed: String(seed),
  })
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`
}

export async function handleImageRequest(request, env) {
  if (request.method === 'GET') return proxyImage(request)
  if (request.method !== 'POST') return errorJson('Method not allowed', 405)

  let body
  try { body = await request.json() } catch { return errorJson('JSON 格式不正確', 400) }
  let options
  try {
    options = normalizeImageOptions(body)
  } catch (err) {
    return errorJson(err.message || '圖片參數不正確', 400, 'image_options')
  }
  const direct = buildPollinationsUrl(options)
  return new Response(JSON.stringify({
    ok: true,
    imageUrl: direct,
    proxyUrl: `/api/image?prompt=${encodeURIComponent(options.prompt)}&width=${options.width}&height=${options.height}&model=${options.model}&seed=${options.seed}`,
    prompt: options.prompt,
    width: options.width,
    height: options.height,
    model: options.model,
  }), {
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
  })
}

async function proxyImage(request) {
  const url = new URL(request.url)
  let options
  try {
    options = normalizeImageOptions({
      prompt: url.searchParams.get('prompt') || '',
      width: url.searchParams.get('width'),
      height: url.searchParams.get('height'),
      model: url.searchParams.get('model'),
      seed: url.searchParams.get('seed'),
    })
  } catch (err) {
    return new Response(err.message || '圖片參數不正確', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
    })
  }
  const target = buildPollinationsUrl(options)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), 75_000)
  try {
    const res = await fetch(target, {
      headers: { 'Accept': 'image/*', 'User-Agent': 'personal-ai/1.0' },
      signal: controller.signal,
    })
    if (res.status === 429) {
      return new Response('圖片服務忙碌，請稍後再試。', {
        status: 429,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store', 'Retry-After': '30' },
      })
    }
    if (!res.ok || !res.body) {
      return new Response(`圖片服務回傳 HTTP ${res.status}`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
      })
    }
    const type = res.headers.get('content-type') || 'image/jpeg'
    return new Response(res.body, {
      headers: {
        'Content-Type': type.startsWith('image/') ? type : 'image/jpeg',
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    const timedOut = err && (err.name === 'AbortError' || String(err.message || '').includes('timeout'))
    return new Response(timedOut ? '圖片生成逾時，請再試一次。' : '無法連線到圖片服務。', {
      status: timedOut ? 504 : 502,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
    })
  } finally {
    clearTimeout(timer)
  }
}