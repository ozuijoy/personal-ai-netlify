import { isBlockedHost } from '../providers.js'

const MAX_BYTES = 220_000

export function validateFetchUrl(input) {
  let url
  try { url = new URL(String(input || '')) } catch { throw new Error('URL 格式不正確') }
  if (url.protocol !== 'https:') throw new Error('只允許 HTTPS')
  if (url.username || url.password) throw new Error('URL 不可包含帳號密碼')
  if (!url.hostname || isBlockedHost(url.hostname)) throw new Error('此主機位址不被允許')
  return url
}

function textFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function titleFromHtml(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200) : ''
}

export async function fetchPage(input, { maxChars = 12_000 } = {}) {
  let url = validateFetchUrl(input)
  let response = null
  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort('timeout'), 20_000)
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'personal-ai/1.0 (+private assistant)',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) break
      url = validateFetchUrl(new URL(location, url).toString())
      continue
    }
    break
  }
  if (!response) throw new Error('無法取得頁面')
  if (!response.ok) throw new Error(`頁面回傳 HTTP ${response.status}`)
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (!/text\/html|text\/plain|application\/xhtml|application\/json/.test(type)) {
    throw new Error('此內容類型不支援')
  }
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      try { await reader.cancel() } catch {}
      break
    }
    chunks.push(value)
  }
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(
    chunks.reduce((out, chunk) => {
      const merged = new Uint8Array(out.length + chunk.length)
      merged.set(out)
      merged.set(chunk, out.length)
      return merged
    }, new Uint8Array()),
  )
  const isHtml = /html|xhtml/.test(type)
  return {
    url: url.toString(),
    title: isHtml ? titleFromHtml(raw) : '',
    text: (isHtml ? textFromHtml(raw) : raw.trim()).slice(0, maxChars),
  }
}