// Netlify Function（Node）：頁面 + 所有 /api/*（/api/chat 除外，由 Edge Function 處理）。
// 限制（官方 docs.netlify.com/build/functions/configuration）：同步執行 60 秒、緩衝請求/回應 6 MB、記憶體 1024 MB。
import app from '../../src/app.js'

export default async (request) => app.fetch(request, process.env)

export const config = {
  path: ['/', '/index.html', '/login', '/sandbox/frame', '/robots.txt', '/api/*'],
  preferStatic: false,
}
