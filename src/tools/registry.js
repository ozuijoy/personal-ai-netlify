import { searchWeb } from './search.js'
import { fetchPage } from './fetch.js'
import { calculate } from './calc.js'
import { currentTime } from './time.js'
import { searchDocuments } from './docs.js'

// Reserved MCP-compatible shape. The v1 Worker exposes these only through its
// own /api/tool endpoint; an MCP adapter can be attached later without changing
// the tool contracts.
export const TOOLS = [
  {
    name: 'web_search',
    description: '搜尋公開網頁。適合需要最新資訊的問題。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '搜尋關鍵字' } },
      required: ['query'],
    },
  },
  {
    name: 'fetch_url',
    description: '讀取一個公開 HTTPS 網頁的文字內容。',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'HTTPS URL' } },
      required: ['url'],
    },
  },
  {
    name: 'calculate',
    description: '計算基本算術表達式。',
    parameters: {
      type: 'object',
      properties: { expression: { type: 'string', description: '例如 (12+3)*4' } },
      required: ['expression'],
    },
  },
  {
    name: 'current_time',
    description: '取得目前時間。',
    parameters: {
      type: 'object',
      properties: {
        timeZone: { type: 'string', description: 'IANA 時區，例如 Asia/Taipei' },
        locale: { type: 'string', description: '語言，例如 zh-TW' },
      },
    },
  },
  {
    name: 'document_search',
    description: '在使用者提供的文件中搜尋相關段落。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        documents: { type: 'array', items: { type: 'object' } },
      },
      required: ['query'],
    },
  },
]

export const TOOL_NAMES = new Set(TOOLS.map((tool) => tool.name))

export async function runTool(name, args, env) {
  const input = args && typeof args === 'object' ? args : {}
  switch (name) {
    case 'web_search': {
      const result = await searchWeb(input.query, env, { maxResults: input.maxResults })
      if (result.error === 'no_key') return { ok: false, error: '未設定 Tavily API Key' }
      if (result.error) return { ok: false, error: `搜尋失敗：${result.error}` }
      return { ok: true, results: result.results }
    }
    case 'fetch_url': {
      try {
        const page = await fetchPage(input.url)
        return { ok: true, ...page }
      } catch (err) {
        return { ok: false, error: err && err.message ? err.message : '讀取失敗' }
      }
    }
    case 'calculate': {
      try { return { ok: true, result: calculate(input.expression) } } catch (err) {
        return { ok: false, error: err && err.message ? err.message : '計算失敗' }
      }
    }
    case 'current_time':
      return { ok: true, ...currentTime(input.timeZone, input.locale) }
    case 'document_search':
      return { ok: true, results: searchDocuments(input.query, input.documents) }
    default:
      return { ok: false, error: '未知工具' }
  }
}