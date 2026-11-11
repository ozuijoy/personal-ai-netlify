# Personal AI — Netlify 版

[`scupro/personal-ai`](https://github.com/scupro/personal-ai)（Cloudflare Workers + D1）的移植版，改用 **Netlify Functions / Edge Functions + Neon Postgres**。
資料以伺服器為主（不再依賴瀏覽器 localStorage），API Key 在伺服器端以 AES-256-GCM 加密。

> **狀態：五個階段已在本機完成，46 項測試通過，尚未部署。**
> 部署前仍需實測：真實 Neon（含 pgvector）、Neon Object Storage、Edge 串流超過 60 秒、Cloudflare Workers AI 嵌入端點。

- 完整架構與設計理由：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 資料表：[`db/migrations/0001_init.sql`](db/migrations/0001_init.sql)、[`db/migrations/0002_vectors.sql`](db/migrations/0002_vectors.sql)

---

## 功能

| 類別 | 內容 |
|---|---|
| 登入 | 單一密碼登入；HMAC 簽章 session cookie（驗證不查資料庫）；登入失敗節流；改 `SESSION_VERSION` 即登出所有裝置 |
| 聊天 | `/api/chat` 由 Edge Function 串流代理（不受 Functions 60 秒同步上限）；串流結束後前端再寫入訊息 |
| 供應商與模型 | 自訂 OpenAI 相容供應商，**允許空 API Key**（自架模型）；Key 加密存伺服器，前端只看得到是否已設定；模型選單**依供應商分組**；可從供應商自動探索模型 |
| 資料 | 個人資料、設定、介面偏好、對話、專案、Prompt、知識庫文件全部存 Neon |
| 檔案 | 瀏覽器以 presigned URL 直傳物件儲存（不經 Function）；PDF（pdf.js）與 DOCX（mammoth）在瀏覽器端抽文字，伺服器切塊（約 1200 字、重疊 150）寫入知識庫 |
| 檢索 | 關鍵字（英數詞＋中文二字組＋全文分數）＋語意向量，以 RRF（k=60）合併；嵌入失敗自動退回關鍵字 |
| 語意嵌入 | 預設 **Cloudflare Workers AI `@cf/baai/bge-m3`**（1024 維，多語、支援中文）；可改用任何 OpenAI 相容 `/embeddings` 供應商或關閉 |
| 技能 | 自訂技能由伺服器注入系統提示（always／keyword／手動）；輸入框可選技能，前端無法偽造 |
| 記憶 | 長期記憶由伺服器注入；對話後可產生「記憶建議」，**使用者確認後才寫入** |
| 維運 | 金鑰輪替與重新加密、JSON 分頁備份與還原、舊 D1 資料匯入 |

## 架構

```
瀏覽器（public/ 單頁）
  ├─ /api/chat, /api/memories/suggest ──► Netlify Edge Functions（Deno，串流）
  ├─ 其他 /api/*  ─────────────────────► Netlify Function app.mjs（Node，60 秒上限）
  │                                          └─► Neon Postgres（HTTP 驅動）
  └─ 檔案上傳／下載（presigned URL）──────► Neon Object Storage（S3 相容）
```

聊天預設供應商為 **Groq**（Groq 沒有嵌入 API，因此嵌入另用 Cloudflare Workers AI）。

## 目錄

```
netlify/functions/app.mjs              頁面 + /api/*（Node）
netlify/edge-functions/chat.js         /api/chat 串流代理
netlify/edge-functions/memory-suggest.js  /api/memories/suggest
src/app.js                             router
src/api_data.js                        伺服器為主的資料 API
src/auth.js, login_page.js             登入與 session
src/crypto.js                          AES-GCM 加解密、金鑰版本
src/db.js                              Neon 驅動封裝
src/storage.js                         S3 相容物件儲存（自寫 SigV4、presign）
src/embeddings.js                      嵌入、混合檢索、補建向量
src/memory_suggest.js                  記憶建議
src/backup.js                          匯出與還原
src/repo/                              providers / entities / conversations / files / context / login
src/migrate/d1.js                      舊 D1 sync_items → Neon
src/web_decoded.html                   前端原始檔（npm run build 產生 public/assets）
db/migrations/                         0001 基礎資料表、0002 向量
scripts/                               migrate、D1 匯入、rekey、bucket CORS、前端建置
test/                                  node:test；資料庫測試以 PGlite 實跑 SQL，前端以 jsdom
```

## API 一覽

| 路徑 | 用途 |
|---|---|
| `/api/health`、`/api/config`、`/api/me` | 狀態、公開設定、目前使用者與設定 |
| `/api/login`、`/api/logout` | 登入、登出 |
| `/api/chat` | 聊天串流（Edge） |
| `/api/providers`、`/api/providers/:id`、`/:id/models`、`/:id/discover` | 供應商 CRUD、模型、自動探索 |
| `/api/models`、`/api/models/grouped` | 模型清單（分組） |
| `/api/profile`、`/api/settings` | 個人資料、設定 |
| `/api/conversations`、`/:id`、`/:id/messages` | 對話與訊息 |
| `/api/documents/search` | 知識庫檢索（混合） |
| `/api/files`、`/:id/complete`、`/:id/download` | 上傳（presign）、完成、下載 |
| `/api/memories`、`/api/memories/suggest` | 記憶、記憶建議 |
| `/api/embeddings/status`、`/config`、`/backfill` | 嵌入狀態、設定、補建向量 |
| `/api/backup`、`/api/backup/restore` | 匯出、還原 |
| `/api/admin/keys`、`/api/admin/rekey` | 金鑰狀態、重新加密 |
| `/api/image`、`/api/tool`、`/api/sync*` | 圖片代理、工具（search/fetch/calc/time/docs）、舊同步相容 |

## 環境變數

在 Netlify UI → Project configuration → Environment variables 設定，不要寫進 `netlify.toml`。範本見 [`.env.example`](.env.example)。

| 變數 | 必要 | 說明 |
|---|---|---|
| `APP_PASSWORD` | ✓ | 登入密碼 |
| `AUTH_SECRET` | ✓ | session 簽章，至少 32 字元 |
| `ENCRYPTION_KEY` | ✓ | API Key 加密金鑰，base64 32 bytes（`npm run gen:key`） |
| `DATABASE_URL` | ✓ | Neon pooled 連線字串（`sslmode=require`） |
| `SESSION_DAYS` | | 預設 30 |
| `SESSION_VERSION` | | 改值即登出所有裝置 |
| `GROQ_API_KEY`、`GROQ_MODEL` | | 內建 Groq 聊天 |
| `TAVILY_API_KEY` | | 網路搜尋工具 |
| `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_AI_TOKEN` | | 內建語意檢索（兩者都有才啟用；取得方式見[設定 Workers AI Token](#設定-workers-ai-token)） |
| `EMBEDDING_MODEL` | | 預設 `@cf/baai/bge-m3` |
| `STORAGE_ENDPOINT`、`STORAGE_REGION`、`STORAGE_BUCKET`、`STORAGE_ACCESS_KEY_ID`、`STORAGE_SECRET_ACCESS_KEY` | | 物件儲存（檔案功能需要） |
| `MAX_UPLOAD_MB` | | 預設 25 |
| `KEY_VERSION`、`ENCRYPTION_KEY_PREVIOUS`、`KEY_VERSION_PREVIOUS` | | 金鑰輪替時使用 |

## 本機開發

```bash
npm install
npm test                 # 46 項；不需要真的資料庫（PGlite）
npm run gen:key          # 產生 ENCRYPTION_KEY
npm run build            # 由 src/web_decoded.html 產生 public/
DATABASE_URL=... npm run db:migrate
npm run dev              # netlify dev
```

## 部署步驟

1. **Neon**：建立專案（區域建議 AWS `us-east-2`，與 Netlify Functions 預設區域相同），取得 pooled `DATABASE_URL`，執行 `npm run db:migrate`。`0002_vectors.sql` 需要 pgvector 擴充。
2. **物件儲存**（選用）：建立 Neon Object Storage bucket 與憑證，執行 `node scripts/storage-cors.mjs https://你的站.netlify.app` 設定 CORS。
3. **Netlify**：連接本倉庫，build 指令 `npm run build`、publish 目錄 `public`（已寫在 `netlify.toml`），填入環境變數。
4. **先用 Deploy Preview 實測**（不耗 credits），確認登入、聊天串流、檔案上傳、檢索都正常，再做正式部署。
5. **語意檢索**（選用）：依下方「[設定 Workers AI Token](#設定-workers-ai-token)」取得帳號 ID 與 Token，填進 Netlify 環境變數後重新部署，再於設定頁或 `/api/embeddings/backfill` 補建既有文件的向量。

## 設定 Workers AI Token

內建語意檢索需要兩個值，**只放在 Netlify 環境變數**，不寫進程式、`netlify.toml` 或資料庫，也不會傳到瀏覽器。

**1. 在 Cloudflare 取得**（[官方步驟](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)）

1. 登入 Cloudflare 儀表板，進入 **Workers AI** 頁面。
2. 選 **Use REST API**。
3. 選 **Create a Workers AI API Token** → 檢查預填內容 → **Create API Token** → **Copy API Token**。Token 只顯示這一次，請先存好。
4. 在同一頁 **Get Account ID** 複製 **Account ID**（32 位十六進位）。

若改在 My Profile → API Tokens 自訂 Token，權限需同時有 **Workers AI - Read** 與 **Workers AI - Edit**。

**2. 填進 Netlify**

Netlify 專案 → **Project configuration** → **Environment variables** → **Add a variable**：

| Key | Value |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | 上面的 Account ID |
| `CLOUDFLARE_AI_TOKEN` | 上面的 API Token（建議勾選 secret） |
| `EMBEDDING_MODEL` | 選填，預設 `@cf/baai/bge-m3` |

存好後**重新部署**，環境變數才會生效。

**3. 確認**

- 登入後到設定 → 供應商頁的「語意檢索」，應顯示內建 Cloudflare bge-m3 已啟用；`/api/embeddings/status` 的 `builtin` 欄位也會有值。
- 本機可先用 curl 驗證 Token：

```bash
curl https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/v1/embeddings \
  -H "Authorization: Bearer $CLOUDFLARE_AI_TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"@cf/baai/bge-m3","input":["測試"]}'
```

兩個變數缺一個或 Account ID 格式不對時，內建檢索不會啟用，知識庫只用關鍵字檢索，其他功能不受影響。

## 從舊版（Cloudflare D1）遷移

```bash
# 1) 在舊專案目錄匯出（唯讀查詢，不改動 D1）
npx wrangler d1 execute personal-ai --remote --json \
  --command "SELECT owner_id, item_key, value, updated_at, deleted FROM sync_items" > d1-export.json
# 2) 預演（不寫入）
node scripts/import-d1.mjs d1-export.json --dry-run
# 3) 正式匯入
DATABASE_URL=... npm run db:import-d1 -- d1-export.json
```

瀏覽器裡的舊資料（含供應商 API Key）在第一次登入新版時會自動上傳到伺服器。

## 維運

- **金鑰輪替**：設定新 `ENCRYPTION_KEY` 與 `KEY_VERSION`，舊金鑰放 `ENCRYPTION_KEY_PREVIOUS`／`KEY_VERSION_PREVIOUS`，再執行 `npm run db:rekey` 或呼叫 `/api/admin/rekey`。
- **備份**：`/api/backup` 匯出 JSON，`/api/backup/restore` 還原。備份**不含** API Key 與檔案本體；還原後自訂供應商需重新輸入 Key，內建 Cloudflare 嵌入則可直接重建向量。

## 免費額度提醒

- **Netlify Free**：每月 300 credits、硬上限，正式部署每次 15 credits，Deploy Preview 免費（[How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)）。Functions 同步回應上限 60 秒（[Functions](https://docs.netlify.com/build/functions/configuration/)）。
- **Neon Free**：每專案 100 CU-hours／月、儲存 1 GB、閒置 5 分鐘自動暫停；Object Storage 5 GB（[Plans](https://neon.com/docs/introduction/plans)）。
- **Cloudflare Workers AI**：每帳號每天 10,000 Neurons 免費，UTC 0 點重置；超額時當天語意檢索退回關鍵字（[Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)）。

## 授權

MIT，見 [`LICENSE`](LICENSE) 與 [`NOTICE`](NOTICE)。本專案衍生自 Trujillo AI Studio。
