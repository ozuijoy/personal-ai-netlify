#!/usr/bin/env node
// 把舊 Cloudflare D1 的 sync_items 匯入 Neon。只讀舊資料，不會改動 D1。
//
// 1) 在舊專案目錄匯出（唯讀查詢）：
//    npx wrangler d1 execute personal-ai --remote --json \
//      --command "SELECT owner_id, item_key, value, updated_at, deleted FROM sync_items" > d1-export.json
// 2) 先預演（不寫入）：node scripts/import-d1.mjs d1-export.json --dry-run
// 3) 正式匯入：DATABASE_URL=... node scripts/import-d1.mjs d1-export.json
import fs from 'node:fs'
import { createNeonDb } from '../src/db.js'
import { parseD1Export, planImport, runImport } from '../src/migrate/d1.js'

const file = process.argv[2]
const dry = process.argv.includes('--dry-run')
if (!file) { console.error('用法：node scripts/import-d1.mjs <d1-export.json> [--dry-run]'); process.exit(1) }

const rows = parseD1Export(fs.readFileSync(file, 'utf8'))
const plan = planImport(rows)
console.log(`讀到 ${rows.length} 列：對話 ${plan.conversations.length}、文件 ${plan.documents.length}、專案 ${plan.projects.length}、prompt ${plan.prompts.length}、設定 ${Object.keys(plan.settings).length}、略過 ${plan.skipped.length}`)
if (plan.skipped.length) console.log('略過：', plan.skipped.slice(0, 20))
if (dry) process.exit(0)
if (!process.env.DATABASE_URL) { console.error('請設定 DATABASE_URL'); process.exit(1) }
const result = await runImport(createNeonDb(process.env.DATABASE_URL), plan, { log: (m) => console.log('  ' + m) })
console.log('完成', result)
