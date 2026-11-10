#!/usr/bin/env node
// 金鑰輪替後，把 providers.api_key_enc 全部改用目前的 ENCRYPTION_KEY 重新加密。
// 用法：DATABASE_URL=... ENCRYPTION_KEY=<新> KEY_VERSION=v2 ENCRYPTION_KEY_PREVIOUS=<舊> KEY_VERSION_PREVIOUS=v1 npm run db:rekey
// 也可以在設定頁「資料控制 → 金鑰」按「重新加密」（同一段程式）。
import { createNeonDb } from '../src/db.js'
import { keyStatus, rekeyProviders } from '../src/repo/providers.js'

const env = process.env
if (!env.DATABASE_URL) { console.error('請設定 DATABASE_URL'); process.exit(1) }
const db = createNeonDb(env.DATABASE_URL)
console.log('before', await keyStatus(db, env))
const r = await rekeyProviders(db, env)
console.log(`rekeyed ${r.rekeyed}, failed ${r.failed.length}`)
for (const f of r.failed) console.log('  failed', f.id, f.error)
console.log('after', await keyStatus(db, env))
process.exit(r.failed.length ? 2 : 0)
