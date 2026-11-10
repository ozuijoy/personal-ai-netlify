// 登入節流：Serverless 實例之間不共享記憶體，所以失敗次數記在 Postgres。
// 15 分鐘內失敗 5 次 → 封鎖 5 分鐘。client_key 存 IP 的雜湊而非明文。
import { sha256Hex } from '../crypto.js'

const WINDOW_MS = 15 * 60_000
const BLOCK_MS = 5 * 60_000
const MAX_FAILURES = 5

export function clientIp(request) {
  return request.headers.get('x-nf-client-connection-ip')
    || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'local'
}

async function keyFor(request, env) {
  return sha256Hex(`${clientIp(request)}\n${env.AUTH_SECRET || ''}`)
}

const memory = new Map() // 沒有資料庫時（本機開發）退回記憶體

export async function loginAllowed(db, request, env) {
  const key = await keyFor(request, env)
  const now = Date.now()
  const row = db
    ? (await db.query(`SELECT failures, first_at, blocked_until FROM login_attempts WHERE client_key = $1`, [key]))[0]
    : memory.get(key)
  if (!row) return true
  const blocked = row.blocked_until ? new Date(row.blocked_until).getTime() : 0
  return !blocked || now >= blocked
}

export async function recordLoginFailure(db, request, env) {
  const key = await keyFor(request, env)
  if (!db) {
    const now = Date.now()
    const row = memory.get(key) || { failures: 0, first_at: now, blocked_until: null }
    if (now - new Date(row.first_at).getTime() > WINDOW_MS) { row.failures = 0; row.first_at = now; row.blocked_until = null }
    row.failures++
    if (row.failures >= MAX_FAILURES) row.blocked_until = now + BLOCK_MS
    memory.set(key, row)
    return
  }
  await db.query(
    `INSERT INTO login_attempts (client_key, failures, first_at) VALUES ($1, 1, now())
     ON CONFLICT (client_key) DO UPDATE SET
       failures = CASE WHEN login_attempts.first_at < now() - ($2 || ' milliseconds')::interval THEN 1 ELSE login_attempts.failures + 1 END,
       first_at = CASE WHEN login_attempts.first_at < now() - ($2 || ' milliseconds')::interval THEN now() ELSE login_attempts.first_at END,
       blocked_until = CASE
         WHEN login_attempts.first_at >= now() - ($2 || ' milliseconds')::interval AND login_attempts.failures + 1 >= $3
         THEN now() + ($4 || ' milliseconds')::interval
         ELSE login_attempts.blocked_until END`,
    [key, String(WINDOW_MS), MAX_FAILURES, String(BLOCK_MS)],
  )
}

export async function recordLoginSuccess(db, request, env) {
  const key = await keyFor(request, env)
  if (!db) { memory.delete(key); return }
  await db.query(`DELETE FROM login_attempts WHERE client_key = $1`, [key])
}
