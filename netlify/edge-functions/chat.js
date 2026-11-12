// Edge Function（Deno）：/api/chat 串流代理。
// 為什麼放 Edge：Serverless Function 的串流回應也受 60 秒執行上限，且等待上游的時間全部計入
// compute（10 credits / GB-hour）。Edge Function 不計 compute、只算 web request，
// 限制為每次請求 50 ms CPU 與 40 秒內必須送出回應標頭（docs.netlify.com/build/edge-functions/limits）。
// 這裡只做驗證、查 Key、轉送上游 SSE 位元組，不逐 token 解析，CPU 用量極低。
// 注意：官方未載明 Edge 串流的總時長上限，部署後需實測長回答（> 60 秒）。
import { handleChat } from '../../src/chat.js'
import { requireAuth } from '../../src/auth.js'
import { applySecurityHeaders, sameOriginRequest } from '../../src/security.js'
import { errorJson } from '../../src/config.js'
import { getDb } from '../../src/db.js'
import { resolveChatProvider } from '../../src/repo/providers.js'
import { chatContextLoader } from '../../src/repo/context.js'
import { resolveWebSearch } from '../../src/web_search_config.js'

export default async (request) => {
  const env = Netlify.env.toObject()
  let response
  if (request.method !== 'POST') response = errorJson('Method not allowed', 405)
  else if (!sameOriginRequest(request)) response = errorJson('跨來源請求被拒絕', 403, 'bad_origin')
  else if (!(await requireAuth(request, env))) response = errorJson('請先登入', 401, 'unauthorized')
  else {
    try {
      const db = getDb(env)
      response = await handleChat(request, env, {
        resolveProvider: (body, e) => resolveChatProvider(db, body, e),
        loadContext: db ? chatContextLoader(db) : undefined,
        resolveSearch: db ? (e) => resolveWebSearch(db, e) : undefined,
      })
    } catch (err) {
      console.error('chat failed', err && err.message)
      response = errorJson('伺服器發生錯誤', 500, 'internal_error')
    }
  }
  return applySecurityHeaders(request, response)
}

export const config = { path: '/api/chat' }
