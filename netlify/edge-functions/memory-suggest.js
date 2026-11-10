// Edge Function：/api/memories/suggest（Memory 建議）。
// 放 Edge 的理由同 chat.js：等待上游模型的時間不計 compute。只回傳建議，不寫入資料庫。
import { handleMemorySuggest } from '../../src/memory_suggest.js'
import { requireAuth } from '../../src/auth.js'
import { applySecurityHeaders, sameOriginRequest } from '../../src/security.js'
import { errorJson } from '../../src/config.js'
import { getDb } from '../../src/db.js'

export default async (request) => {
  const env = Netlify.env.toObject()
  let response
  const db = getDb(env)
  if (request.method !== 'POST') response = errorJson('Method not allowed', 405)
  else if (!sameOriginRequest(request)) response = errorJson('跨來源請求被拒絕', 403, 'bad_origin')
  else if (!(await requireAuth(request, env))) response = errorJson('請先登入', 401, 'unauthorized')
  else if (!db) response = errorJson('伺服器未設定 DATABASE_URL', 503, 'storage_disabled')
  else {
    try {
      response = await handleMemorySuggest(request, env, db)
    } catch (err) {
      console.error('memory suggest failed', err && err.message)
      response = errorJson('伺服器發生錯誤', 500, 'internal_error')
    }
  }
  return applySecurityHeaders(request, response)
}

export const config = { path: '/api/memories/suggest' }
