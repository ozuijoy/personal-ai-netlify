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
  return !!(env.TAVILY_API_KEY || env.JINA_API_KEY)
}

// opts.provider / opts.apiKey 由面板設定（src/web_search_config.js）傳入；未傳時退回環境變數（JINA_API_KEY 優先，再 TAVILY_API_KEY）。
export async function searchWeb(query, env = {}, { maxResults = 5, provider, apiKey } = {}) {
  const q = String(query || '').trim()
  if (!q) return { results: [], error: 'empty_query' }
  let p = provider
  let key = apiKey
  if (!p || !key) {
    if (env.JINA_API_KEY) { p = 'jina'; key = env.JINA_API_KEY }
    else if (env.TAVILY_API_KEY) { p = 'tavily'; key = env.TAVILY_API_KEY }
  }
  if (!p || !key) return { results: [], error: 'no_key' }
  const n = Math.min(5, Math.max(1, Number(maxResults) || 5))

  const cacheKey = `${p}:${n}:${q.toLowerCase().slice(0, 200)}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL) return { results: hit.results, cached: true, provider: p }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), 20_000)
  try {
    let res
    if (p === 'jina') {
      // https://jina.ai/reader/ ：s.jina.ai 需 API Key；Accept: application/json 回傳 data[]（title, url, description, content）。
      // X-Respond-With: no-content 只回標題、網址與摘要，不抓全文，控制上下文長度。
      res = await fetch('https://s.jina.ai/?q=' + encodeURIComponent(q.slice(0, 400)), {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${key}`,
          'X-Respond-With': 'no-content',
        },
        signal: controller.signal,
      })
    } else if (p === 'tavily') {
      res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          query: q.slice(0, 400),
          search_depth: 'basic',
          max_results: n,
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        }),
        signal: controller.signal,
      })
    } else {
      return { results: [], error: 'unknown_provider' }
    }
    if (!res.ok) return { results: [], error: `search_http_${res.status}`, provider: p }
    const data = await res.json().catch(() => ({}))
    const list = p === 'jina' ? (Array.isArray(data.data) ? data.data : []) : (Array.isArray(data.results) ? data.results : [])
    const results = list
      .slice(0, n)
      .map((r) => ({
        title: clean(r.title, 180) || clean(r.url, 180),
        url: String(r.url || ''),
        content: clean(r.description || r.content || r.snippet || '', MAX_SNIPPET),
      }))
      .filter((r) => /^https?:\/\//i.test(r.url))
    cache.set(cacheKey, { results, at: Date.now() })
    if (cache.size > 100) {
      const now = Date.now()
      for (const [k, v] of cache) if (now - v.at > CACHE_TTL) cache.delete(k)
    }
    return { results, provider: p }
  } catch (err) {
    return { results: [], error: err && err.name === 'AbortError' ? 'timeout' : 'network_error', provider: p }
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