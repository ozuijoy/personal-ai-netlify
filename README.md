# Personal AI — Netlify 版（開發中）

`scupro/personal-ai`（Cloudflare Workers + D1）的移植版：Netlify Functions / Edge Functions + Neon Postgres，
資料以伺服器為主，API Key 在伺服器端以 AES-256-GCM 加密。**目前尚未部署。**

- 架構與資料表設計：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 資料表 SQL：[`db/migrations/0001_init.sql`](db/migrations/0001_init.sql)

## 目錄

```
netlify/functions/app.mjs        頁面 + /api/*（Node，60 秒上限）
netlify/edge-functions/chat.js   /api/chat 串流代理（Deno）
src/app.js                       router（沿用原 Worker 程式）
src/api_data.js                  伺服器為主的資料 API
src/crypto.js                    AES-GCM 加解密、金鑰輪替
src/db.js                        Neon HTTP 驅動封裝
src/repo/                        providers / entities / conversations / login
src/migrate/d1.js                舊 D1 sync_items → Neon
scripts/db-migrate.mjs           套用 db/migrations
scripts/import-d1.mjs            匯入 D1 匯出檔
test/                            node:test；db.test.mjs 用 PGlite 實跑 SQL
```

## 本機

```bash
npm install
npm test                 # 不需要真的資料庫（PGlite）
npm run gen:key          # 產生 ENCRYPTION_KEY
DATABASE_URL=... npm run db:migrate
```

環境變數見 `.env.example` 與 `netlify.toml` 註解。
