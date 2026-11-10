#!/usr/bin/env node
// 套用 db/migrations/*.sql 到 DATABASE_URL（Neon）。已套用的版本記在 schema_migrations，可重跑。
// 用法：DATABASE_URL=... npm run db:migrate
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, neonConfig } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) { console.error('請設定 DATABASE_URL'); process.exit(1) }
neonConfig.webSocketConstructor = globalThis.WebSocket // Node 22 內建

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations')
const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
const pool = new Pool({ connectionString: url })
try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const done = new Set((await pool.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version))
  for (const f of files) {
    const version = f.replace(/\.sql$/, '')
    if (done.has(version)) { console.log(`skip  ${version}`); continue }
    const sql = fs.readFileSync(path.join(dir, f), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [version])
      await client.query('COMMIT')
      console.log(`apply ${version}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally { client.release() }
  }
} finally { await pool.end() }
