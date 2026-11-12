const cache = new Map()
const CACHE_TTL = 10 * 60_000
const MAX_SNIPPET = 1200

function clean(text, max = MAX_SNIPPET) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function tavilyConfigured(env) {
  return !!env.TAVILY_API_KEY
}

export async function searchWeb(query, env, { maxResults = 5 } = {}) {
  const q = String(query || '').trim()
  if (!q) return { results: [], error: 'empty_query' }
  if (!env.TAVILY_API_KEY) return { results: [], error: 'no_key' }

  const key = q.toLowerCase().slice(0, 200)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return { results: hit.results, cached: true }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), 15_000)
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: q.slice(0, 400),
        search_depth: 'basic',
        max_results: Math.min(5, Math.max(1, Number(maxResults) || 5)),
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { results: [], error: `search_http_${res.status}` }
    }
    const data = await res.json().catch(() => ({}))
    const results = (Array.isArray(data.results) ? data.results : [])
      .slice(0, 5)
      .map((r) => ({
        title: clean(r.title, 180) || clean(r.url, 180),
        url: String(r.url || ''),
        content: clean(r.content || r.snippet || '', MAX_SNIPPET),
      }))
      .filter((r) => /^https?:\/\//i.test(r.url))
    cache.set(key, { results, at: Date.now() })
    if (cache.size > 100) {
      const now = Date.now()
      for (const [k, v] of cache) if (now - v.at > CACHE_TTL) cache.delete(k)
    }
    return { results }
  } catch (err) {
    return { results: [], error: err && err.name === 'AbortError' ? 'timeout' : 'network_error' }
  } finally {
    clearTimeout(timer)
  }
}

function intEnv(v, def, min, max) {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}

// 聊天注入用的搜尋上下文上限（可用環境變數調整）：
// SEARCH_MAX_RESULTS 1–5（預設 3）、SEARCH_SNIPPET_CHARS 100–1200（預設 400）、SEARCH_CONTEXT_CHARS 300–6000（預設 1500，所有摘要合計）。
export function searchLimits(env = {}) {
  return {
    maxResults: intEnv(env.SEARCH_MAX_RESULTS, 3, 1, 5),
    snippetChars: intEnv(env.SEARCH_SNIPPET_CHARS, 400, 100, MAX_SNIPPET),
    contextChars: intEnv(env.SEARCH_CONTEXT_CHARS, 1500, 300, 6000),
  }
}

export function limitSearchResults(results, env = {}) {
  const { maxResults, snippetChars, contextChars } = searchLimits(env)
  const out = []
  let used = 0
  for (const r of (Array.isArray(results) ? results : []).slice(0, maxResults)) {
    const left = contextChars - used
    if (left < 80) break
    const content = String(r.content || '').slice(0, Math.min(snippetChars, left))
    used += content.length
    out.push({ ...r, content: content.length < String(r.content || '').length ? content + '…' : content })
  }
  return out
}

export function formatSearchContext(results) {
  if (!Array.isArray(results) || !results.length) return ''
  return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n')
}