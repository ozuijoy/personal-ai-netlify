// 資料庫存取層。正式環境用 Neon serverless driver（HTTP，一次查詢一個 fetch，
// 適合短命的 Functions / Edge Functions，不需要連線池）。測試用 PGlite 注入同介面。
//
// 介面：
//   db.query(text, params) -> rows[]
//   db.tx([[text, params], ...]) -> rows[][]（非互動式交易，全部成功或全部回滾）
import { neon } from '@neondatabase/serverless'

let cached = null

export function createNeonDb(url) {
  const sql = neon(url)
  return {
    kind: 'neon',
    query: (text, params = []) => sql.query(text, params),
    tx: (statements) => sql.transaction(statements.map(([text, params]) => sql.query(text, params || []))),
  }
}

export function getDb(env = {}) {
  if (env.__db) return env.__db
  const url = env.DATABASE_URL || env.NETLIFY_DATABASE_URL || ''
  if (!url) return null
  if (cached && cached.url === url) return cached.db
  cached = { url, db: createNeonDb(url) }
  return cached.db
}

export async function one(db, text, params) {
  const rows = await db.query(text, params)
  return rows[0] || null
}
