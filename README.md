# Personal AI — Netlify 版

個人 AI 聊天工作台：接任何 OpenAI 相容模型，搭配知識庫、技能、長期記憶、網頁搜尋與 MCP 工具，資料存在自己的 Neon Postgres。

主要功能：

- **多供應商聊天**：任何 OpenAI 相容服務（含無 API Key 的自架模型），模型選單依供應商分組；Edge 串流，回答由伺服器保存，關頁不遺失。
- **知識庫**：上傳 PDF／DOCX／文字檔自動抽文字切塊；中文斷詞 BM25＋語意向量混合檢索。
- **網頁搜尋**：Jina 或 Tavily，只在需要時搜尋，回答只附有引用的來源。
- **MCP 工具**：接遠端 MCP 伺服器，每次呼叫都要使用者按「允許」。
- **技能與記憶**：自訂技能注入系統提示；長期記憶由使用者確認後才寫入。
- **專案與檔案**：專案記錄、對話、檔案存伺服器，跨裝置同步。
- **安全**：單一密碼登入；API Key 在伺服器端以 AES-256-GCM 加密，可輪替。

技術：Netlify Functions／Edge Functions＋Neon Postgres（pgvector）＋S3 相容物件儲存。由 [`scupro/personal-ai`](https://github.com/scupro/personal-ai)（Cloudflare Workers＋D1）移植而來。

> **狀態**：已正式部署，含 MCP 工具與伺服器端保存回答；70 項測試通過。
> 尚未實測：真實 MCP 伺服器、Neon Object Storage、中文 BM25（lakebase）、Jina／Tavily 網頁搜尋、用戶端斷線後 Edge 背景保存回答。

- 完整架構與設計理由：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 資料表：[`db/migrations/0001_init.sql`](db/migrations/0001_init.sql)、[`db/migrations/0002_vectors.sql`](db/migrations/0002_vectors.sql)、[`db/migrations/0003_model_kinds.sql`](db/migrations/0003_model_kinds.sql)、[`db/migrations/0004_cjk_bm25.sql`](db/migrations/0004_cjk_bm25.sql)

---

## 功能

| 類別 | 內容 |
|---|---|
| 登入 | 單一密碼登入；HMAC 簽章 session cookie（驗證不查資料庫）；登入失敗節流；改 `SESSION_VERSION` 即登出所有裝置 |
| 聊天 | `/api/chat` 由 Edge Function 串流代理（不受 Functions 60 秒同步上限）。**回答由伺服器收齊後寫入對話**（串流分兩路：一路給瀏覽器、一路在 `context.waitUntil` 背景收集），關掉或重新整理頁面也不會遺失；訊息以 `mid` 去重。按「停止」時以前端保存的部分回答為準，但上游仍會生成到結束（消耗 token） |
| 供應商與模型 | **沒有內建供應商**。來源只有兩種：設定面板新增（Key 加密存資料庫）與 `PROVIDER_N_*` 環境變數（唯讀，Key 不進資料庫也不到瀏覽器）。任何 OpenAI 相容服務皆可，**允許空 API Key**（自架模型）；聊天模型與嵌入模型分開設定；模型選單**依供應商分組**；預設模型在面板選；可從供應商自動探索模型 |
| 資料 | 個人資料、設定、介面偏好、對話、專案、Prompt、知識庫文件全部存 Neon |
| 檔案 | 瀏覽器以 presigned URL 直傳物件儲存（不經 Function）；PDF（pdf.js）與 DOCX（mammoth）在瀏覽器端抽文字，伺服器切塊（約 1200 字、重疊 150）寫入知識庫 |
| 檢索 | 關鍵字＋語意向量，以 RRF（k=60）合併；嵌入失敗自動退回關鍵字。關鍵字預設用 Neon 中文斷詞＋BM25（0004），未啟用、沒結果或出錯時退回二字組（英數詞＋中文二字組＋全文分數），可在面板切換 |
| 語意嵌入 | **預設關閉**（只用關鍵字）；在面板選任一供應商的嵌入模型即開啟（例如 Cloudflare Workers AI `@cf/baai/bge-m3`、Cohere `embed-v5.0-pro`、OpenAI `text-embedding-3-small`） |
| 技能 | 自訂技能由伺服器注入系統提示（always／keyword／手動）；輸入框可選技能，前端無法偽造 |
| 記憶 | 長期記憶由伺服器注入；對話後可產生「記憶建議」，**使用者確認後才寫入** |
| MCP 工具 | 面板新增遠端 MCP 伺服器（Streamable HTTP）；Token 加密存 Neon；模型要呼叫工具時**先在對話中顯示確認卡，按「允許」才執行** |
| 維運 | 金鑰輪替與重新加密、JSON 分頁備份與還原、舊 D1 資料匯入 |

## 架構

```
瀏覽器（public/ 單頁）
  ├─ /api/chat, /api/memories/suggest ──► Netlify Edge Functions（Deno，串流）
  ├─ 其他 /api/*  ─────────────────────► Netlify Function app.mjs（Node，60 秒上限）
  │                                          └─► Neon Postgres（HTTP 驅動）
  └─ 檔案上傳／下載（presigned URL）──────► Neon Object Storage（S3 相容）
```

沒有內建供應商：聊天與嵌入都用你在設定面板新增、或用 `PROVIDER_N_*` 環境變數設定的 OpenAI 相容供應商，見[用環境變數設定供應商](#用環境變數設定供應商)。

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
src/providers.js                       URL 檢查、環境變數供應商（PROVIDER_N_*）解析
src/embeddings.js                      嵌入、混合檢索、補建向量
src/memory_suggest.js                  記憶建議
src/backup.js                          匯出與還原
src/repo/                              providers / entities / conversations / files / context / login
src/migrate/d1.js                      舊 D1 sync_items → Neon
src/web_decoded.html                   前端原始檔（npm run build 產生 public/assets）
db/migrations/                         0001 基礎資料表、0002 向量、0003 模型分聊天／嵌入、0004 中文斷詞＋BM25（僅 Neon）
scripts/                               migrate、D1 匯入、rekey、bucket CORS、前端建置
test/                                  node:test；資料庫測試以 PGlite 實跑 SQL，前端以 jsdom
```

## API 一覽

- `GET/PUT /api/search/web`：網頁搜尋服務、Key（只寫入，回傳末四碼）與長度上限

| 路徑 | 用途 |
|---|---|
| `/api/health`、`/api/config`、`/api/me` | 狀態、公開設定、目前使用者與設定 |
| `/api/login`、`/api/logout` | 登入、登出 |
| `/api/chat` | 聊天串流（Edge） |
| `/api/providers` | 列出全部供應商（`env-N` 環境變數供應商唯讀、在前；`env_errors` 列出被略過的設定）、新增面板供應商 |
| `/api/providers/:id`、`/:id/models`、`/:id/discover` | 修改／刪除面板供應商、設定聊天模型 `models` 與嵌入模型 `embed_models`、自動探索；`env-N` 修改或刪除回 `403 env_provider_readonly` |
| `/api/models`、`/api/models/grouped` | 用 Base URL 探索模型（舊前端）；聊天模型選單（依供應商分組，只含聊天模型） |
| `/api/profile`、`/api/settings` | 個人資料、設定 |
| `/api/conversations`、`/:id`、`/:id/messages` | 對話與訊息 |
| `/api/documents/search` | 知識庫檢索（混合）；回應含 `keyword_engine`（`bm25`／`bigram`），必要時附 `keyword_error`、`keyword_fallback` |
| `/api/search/status`、`/api/search/config` | 關鍵字引擎狀態 `{mode, bm25_available, engine}`；設定 `{keyword: 'auto'|'bm25'|'bigram'}`，`null` 回到預設 |
| `/api/files`、`/:id/complete`、`/:id/download` | 上傳（presign）、完成、下載 |
| `/api/memories`、`/api/memories/suggest` | 記憶、記憶建議 |
| `/api/embeddings/status`、`/config`、`/backfill` | 嵌入狀態（含各供應商嵌入模型 `options`）、設定 `{provider_id, model}` 或 `{reset:true}` 關閉、補建向量 |
| `/api/mcp/servers`、`/:id`、`/:id/refresh`、`/api/mcp/call` | MCP 伺服器清單／新增／修改（啟用、停用個別工具、換 Token）／刪除／重新取得工具；執行工具（前端在使用者允許後才呼叫） |
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
| `JINA_API_KEY` | | 網頁搜尋（Jina）；面板未設定 Key 時的退路 |
| `TAVILY_API_KEY` | | 網頁搜尋（Tavily）；面板未設定 Key 時的退路 |
| `SEARCH_MAX_RESULTS` / `SEARCH_SNIPPET_CHARS` / `SEARCH_CONTEXT_CHARS` | | 網頁搜尋注入上限預設值（3／400／1500），面板可覆蓋 |
| `KEYWORD_SEARCH` | | 關鍵字引擎預設值 `auto`／`bm25`／`bigram`，預設 `auto`；面板設定優先，見[中文斷詞與 BM25 檢索](#中文斷詞與-bm25-檢索) |
| `PROVIDER_N_NAME` | 該組必填 | 環境變數供應商名稱，`N` = 1–20，見[用環境變數設定供應商](#用環境變數設定供應商) |
| `PROVIDER_N_BASE_URL` | 該組必填 | OpenAI 相容基底網址（HTTPS） |
| `PROVIDER_N_API_KEY` | | 該組的 API Key，可留空 |
| `PROVIDER_N_MODELS` | | 聊天模型，逗號分隔 |
| `PROVIDER_N_EMBED_MODELS` | | 嵌入模型，逗號分隔 |
| `STORAGE_ENDPOINT` | 檔案功能 | 物件儲存端點，見[設定物件儲存](#設定物件儲存) |
| `STORAGE_REGION` | | 區域，預設 `us-east-2` |
| `STORAGE_BUCKET` | 檔案功能 | bucket 名稱 |
| `STORAGE_ACCESS_KEY_ID` | 檔案功能 | 存取金鑰 ID（`nak_live_…`） |
| `STORAGE_SECRET_ACCESS_KEY` | 檔案功能 | 存取祕密金鑰（`nsk_live_…`） |
| `MAX_UPLOAD_MB` | | 預設 25 |
| `KEY_VERSION` | | 目前 `ENCRYPTION_KEY` 的版本名，預設 `v1`；見[金鑰輪替](#api-key-加密金鑰輪替) |
| `ENCRYPTION_KEY_PREVIOUS` | | 輪替期間保留的舊金鑰 |
| `KEY_VERSION_PREVIOUS` | | 舊金鑰的版本名，預設 `v0` |

## 本機開發

```bash
npm install
npm test                 # 70 項；不需要真的資料庫（PGlite）
npm run gen:key          # 產生 ENCRYPTION_KEY
npm run build            # 由 src/web_decoded.html 產生 public/
DATABASE_URL=... npm run db:migrate
npm run dev              # netlify dev
```

## 部署步驟

1. **Neon**：建立專案（區域建議 AWS `us-east-2`，與 Netlify Functions 預設區域相同），取得 pooled `DATABASE_URL`，執行 `npm run db:migrate`（套用 0001–0004；已部署過的資料庫要先跑一次以套用 `0003_model_kinds.sql`，再部署新版程式）。`0004_cjk_bm25.sql` 需要 Postgres 16 以上，見[中文斷詞與 BM25 檢索](#中文斷詞與-bm25-檢索)。`0002_vectors.sql` 需要 pgvector 擴充。
2. **物件儲存**（選用）：依[設定物件儲存](#設定物件儲存)建立 bucket 與憑證、填環境變數並設定 CORS。
3. **Netlify**：連接本倉庫，build 指令 `npm run build`、publish 目錄 `public`（已寫在 `netlify.toml`），填入環境變數（要用環境變數供應商就加上 `PROVIDER_N_*`）。
4. **先用 Deploy Preview 實測**（不耗 credits），確認登入、聊天串流、檔案上傳、檢索都正常，再做正式部署。
5. **供應商與預設值**：登入後到設定 → 供應商新增供應商（或確認 `PROVIDER_N_*` 已出現），再到設定 → 一般選「預設模型」。
6. **語意檢索**（選用）：在設定 → 供應商 →「語意檢索」選一個有嵌入模型的供應商（例如[Cloudflare Workers AI](#範例cloudflare-workers-ai嵌入)），按「儲存並測試」，再按「補建索引」或呼叫 `/api/embeddings/backfill` 補建既有文件的向量。

## 用環境變數設定供應商

本專案**沒有內建供應商**，也沒有自動預設模型。聊天與語意嵌入的供應商只有兩個來源：

1. **設定面板**：設定 → 供應商 →「新增」。Key 以 AES-256-GCM 加密存資料庫，可編輯、刪除，會進備份（不含 Key）。
2. **環境變數**：部署者用 `PROVIDER_N_*` 設定，`N` 為 `1` 到 `20`。適合想在部署時就把 Key 放好、不經過瀏覽器的情況。

環境變數供應商的規則：

- 伺服器會掃描 `1` 到 `20` 的**全部**編號，中間跳號沒關係（例如只設 1、4、9）。
- 供應商 id 為 `env-N`（例如 `env-1`），在模型選單與嵌入設定裡和面板供應商並列，各自一組。
- Key 只從環境變數讀取：**不寫進資料庫、不回傳瀏覽器、不進備份**。面板會唯讀顯示這些供應商並註明「由環境變數管理」，只顯示是否有 Key（`has_key`），不顯示 Key 或 Key 末碼。
- 不能從面板或 API 修改、刪除（`PATCH`／`DELETE`／`PUT …/models` 回 `403 env_provider_readonly`）；要改請改環境變數後重新部署。
- 「抓取模型」（`/api/providers/env-N/discover`）仍可用，伺服器會用環境變數的 Key 代為查詢。
- 設定有誤（缺 `BASE_URL`、網址不是 HTTPS、指向私有網段等）的那一組會被略過，原因會顯示在設定 → 供應商頁（`GET /api/providers` 的 `env_errors`，不含 Key）。
- 聊天模型（`MODELS`）與嵌入模型（`EMBED_MODELS`）分開：聊天選單只列 `MODELS`，語意檢索的嵌入模型建議只列 `EMBED_MODELS`（仍可自由輸入其他模型名稱）。一組供應商可以只有聊天、只有嵌入，或兩者都有。

**預設值在面板選。** 加好供應商後：

- **預設聊天模型**：設定 → 一般 →「預設模型」，或聊天輸入框上方的模型選單。沒選之前送出訊息會提示「請先在設定中新增供應商並選擇模型」。
- **語意檢索**：設定 → 供應商 →「語意檢索（嵌入模型）」選供應商與嵌入模型，按「儲存並測試」。沒設定時為**關閉**，知識庫只用關鍵字檢索；選「不使用」即可再關閉。

### `PROVIDER_N_NAME`

- 內容：供應商的顯示名稱，出現在模型選單分組與設定面板。
- 格式：任意文字，最多 100 字。**必填**；沒有這個變數，第 N 組就不存在。
- 範例：

```
PROVIDER_1_NAME=Groq
```

### `PROVIDER_N_BASE_URL`

- 內容：OpenAI 相容 API 的基底網址。伺服器會在後面接 `/chat/completions`、`/embeddings`、`/models`。
- 格式：**必填**。必須是 `https://`；不可含帳號密碼、查詢字串或 `#`；`localhost`、私有／內網 IP、`.local`、`.internal` 等會被拒絕（與面板供應商相同的檢查）。結尾的 `/` 會自動去掉。
- 範例：

```
PROVIDER_1_BASE_URL=https://api.groq.com/openai/v1
```

### `PROVIDER_N_API_KEY`

- 內容：該供應商的 API Key，以 `Authorization: Bearer …` 送出。
- 格式：選填。自架、不需驗證的閘道可以留空或不設，此時不送 `Authorization`。不可含換行。建議在 Netlify 勾選為 secret。
- 範例：

```
PROVIDER_1_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

### `PROVIDER_N_MODELS`

- 內容：要出現在**聊天**模型選單的模型 id。
- 格式：選填，逗號分隔；前後空白會去掉，重複的只留一個，每個最長 200 字。不設定時這組供應商不會出現在聊天選單。
- 範例：

```
PROVIDER_1_MODELS=openai/gpt-oss-120b,openai/gpt-oss-20b
```

### `PROVIDER_N_EMBED_MODELS`

- 內容：要出現在**語意檢索**嵌入模型選單的模型 id（供應商需支援 `/embeddings`）。
- 格式：選填，逗號分隔，規則同 `PROVIDER_N_MODELS`。第一個模型是在嵌入設定選這組供應商時自動帶入的建議值。
- 範例：

```
PROVIDER_2_EMBED_MODELS=@cf/baai/bge-m3
```

### 範例：Groq（聊天）

```
PROVIDER_1_NAME=Groq
PROVIDER_1_BASE_URL=https://api.groq.com/openai/v1
PROVIDER_1_API_KEY=gsk_...
PROVIDER_1_MODELS=openai/gpt-oss-120b,openai/gpt-oss-20b
```

Groq 沒有嵌入 API，所以不設 `EMBED_MODELS`。Key 在 Groq Console 的 API Keys 頁建立。

### 範例：Cloudflare Workers AI（嵌入）

```
PROVIDER_2_NAME=Cloudflare Workers AI
PROVIDER_2_BASE_URL=https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1
PROVIDER_2_API_KEY=<Workers AI API Token>
PROVIDER_2_EMBED_MODELS=@cf/baai/bge-m3
```

- `<ACCOUNT_ID>` 換成你的 32 位十六進位 Account ID。
- 取得 Token（[官方步驟](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)）：Cloudflare 儀表板 → **Workers AI** → **Use REST API** → **Create a Workers AI API Token** → 檢查預填內容 → **Create API Token** → **Copy API Token**（只顯示一次）。同一頁 **Get Account ID** 可複製 Account ID。
- 若改在 My Profile → API Tokens 自訂 Token，權限需同時有 **Workers AI - Read** 與 **Workers AI - Edit**。
- `@cf/baai/bge-m3` 輸出 1024 維，多語、支援中文。免費額度為每帳號每天 10,000 Neurons，UTC 0 點重置（[Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)）。

先用 curl 確認 Token 可用：

```bash
curl https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai/v1/embeddings \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"@cf/baai/bge-m3","input":["測試"]}'
```

### 範例：Cohere（嵌入）

```
PROVIDER_3_NAME=Cohere
PROVIDER_3_BASE_URL=https://api.cohere.ai/compatibility/v1
PROVIDER_3_API_KEY=<Cohere API Key>
PROVIDER_3_EMBED_MODELS=embed-v5.0-pro,embed-multilingual-v3.0
```

- 用的是 Cohere 的 OpenAI 相容端點（[Compatibility API](https://docs.cohere.com/docs/compatibility-api)）。`embed-v5.0-pro` 排第一，在嵌入設定選 Cohere 時會自動帶入。
- 相容端點的 embeddings 只支援 `input`、`model`、`encoding_format`，**不支援** `input_type` 與 `dimensions`。因此 `embed-v5.0-pro` 固定輸出預設的 **2048 維**（無法改小）；`embed-multilingual-v3.0` 為 1024 維。換模型後需按「補建索引」重建向量。
- 試用（trial）Key 每月上限 1,000 次 API 呼叫（[Rate limits](https://docs.cohere.com/docs/rate-limits)）；知識庫大時補建索引很快就會用完，正式使用請換 production Key。

### 填進 Netlify

Netlify 專案 → **Project configuration** → **Environment variables** → **Add a variable**，逐一加入上面的變數（Key 建議勾選 secret），存好後**重新部署**才會生效。

## 設定物件儲存

檔案上傳（PDF、DOCX、專案檔案）需要 S3 相容物件儲存，預設用 Neon Object Storage。五個變數都填在 Netlify 環境變數；`STORAGE_ENDPOINT`、`STORAGE_BUCKET`、`STORAGE_ACCESS_KEY_ID`、`STORAGE_SECRET_ACCESS_KEY` 缺任何一個，檔案功能就不啟用，其他功能照常。

**取得方式**（[Neon 官方說明](https://neon.com/docs/storage/authentication)）：Neon Console 側欄 **Connect** → **Storage** 分頁 → 選 **Parameters only**，可看到端點、區域與金鑰；或到 **Settings → Credentials → Create credential**，勾選 `storage:read` 與 `storage:write` 另建一組。祕密金鑰只顯示一次，請立刻存好。也可用 CLI：

```bash
neon credentials create --scope storage:read --scope storage:write --name personal-ai-netlify
```

### `STORAGE_ENDPOINT`

- 內容：Neon 分支的 S3 端點（Neon 介面裡叫 `AWS_ENDPOINT_URL_S3`）。
- 格式：`https://` 開頭，結尾不要加 `/`，也不要帶 bucket 名稱。不是 `https://` 時檔案功能不啟用。
- 範例：

```
https://br-cool-darkness-a1b2c3d4.storage.c-1.us-east-2.aws.neon.tech
```

### `STORAGE_REGION`

- 內容：簽章用的區域（Neon 介面裡叫 `AWS_REGION`），要和端點裡的區域一致。
- 格式：AWS 區域代碼，不含 `aws-` 前綴。選填，預設 `us-east-2`。
- 範例：

```
us-east-2
```

### `STORAGE_BUCKET`

- 內容：存放檔案的 bucket 名稱，需先在 Neon Console 建立。
- 格式：只填名稱本身，不是網址。
- 範例：

```
personal-ai-files
```

### `STORAGE_ACCESS_KEY_ID`

- 內容：Neon credential 的 `token_id`（Neon 介面裡叫 `AWS_ACCESS_KEY_ID`）。
- 格式：`nak_live_` 開頭。
- 範例：

```
nak_live_xxxxxxxxxxxxxxxx
```

### `STORAGE_SECRET_ACCESS_KEY`

- 內容：Neon credential 的 `s3_secret_access_key`（Neon 介面裡叫 `AWS_SECRET_ACCESS_KEY`）。
- 格式：`nsk_live_` 開頭。建議在 Netlify 勾選為 secret。
- 範例：

```
nsk_live_xxxxxxxxxxxxxxxx
```

注意：Neon credential 的 `api_token`（`nt_live_` 開頭）**不是**這裡要的值。

### `MAX_UPLOAD_MB`

- 單檔上限（MB），選填，預設 `25`。

### 設定 CORS

瀏覽器直接把檔案傳到 bucket，所以 bucket 要允許站點來源。在本機設好上面的變數後執行一次：

```bash
node scripts/storage-cors.mjs https://你的站.netlify.app
```

來源要寫成 `https://網域`（不含路徑）；本機測試可另加 `http://localhost:8888`。

## 中文斷詞與 BM25 檢索

知識庫的關鍵字檢索預設改用 Neon Lakebase Search 的兩個擴充套件（[Lakebase Search](https://neon.com/docs/ai/lakebase-search)）：

- `lakebase_tokenizer`：內建 `tokenizer_chinese` 設定，用 Lindera 分析器與 Jieba 詞典斷中文詞（`mixed` 模式，會另外加入詞典裡的二、三字子詞），產生標準 `tsvector`（[lakebase_tokenizer](https://neon.com/docs/extensions/lakebase-tokenizer)）。
- `lakebase_text`：`lakebase_bm25` 索引，用整個知識庫的詞頻與段落長度做 BM25 排序（[lakebase_text](https://neon.com/docs/extensions/lakebase-text)）。

原本的二字組檢索保留為退路，並可在面板固定使用。

### 啟用

1. Neon 專案要用 **Postgres 16 以上**（兩個擴充套件都不支援 14、15）。官方文件沒有標示需要付費方案。
2. 執行 `npm run db:migrate`。`0004_cjk_bm25.sql` 會：
   - 建立 `tokenizer_ext` schema，安裝 `lakebase_tokenizer`（裝在 `tokenizer_ext`）與 `lakebase_text`；
   - 建立文字檢索設定 `public.pa_zh`（複製 `tokenizer_chinese`）；
   - 在 `doc_chunks` 新增產生欄位 `tsv_zh`（既有段落當下算好，之後自動產生）；
   - 建立 `doc_chunks_bm25`（`lakebase_bm25`）索引，並把 `doc_chunks` 的 `autovacuum_vacuum_insert_scale_factor` 設為 0（官方建議，讓 VACUUM 及時更新 BM25 統計）。
3. 資料庫沒有這兩個擴充套件時，0004 會印出 NOTICE 後略過，不會失敗；程式自動用二字組。
4. 確認：設定 → 供應商 → 「關鍵字檢索」卡片顯示「目前使用：中文斷詞＋BM25」，或在 Neon SQL Editor 執行：

```sql
SELECT to_tsvector('public.pa_zh', '東京與京都五天行程，第三天去嵐山看竹林');
```

大量匯入文件後，可手動執行一次 `VACUUM doc_chunks;` 讓 BM25 分數準確。

### 切換引擎

| 模式 | 行為 |
|---|---|
| `auto`（預設） | 有 `doc_chunks_bm25` 就用 BM25；BM25 沒有結果或出錯時，同一次查詢再用二字組找 |
| `bm25` | 只用 BM25；未啟用或出錯時仍退回二字組，並在回應附 `keyword_error` |
| `bigram` | 只用原本的二字組檢索，完全不碰 BM25 |

設定方式（優先順序由高到低）：

1. 設定面板「供應商」分頁的「關鍵字檢索」卡片。
2. API：`PUT /api/search/config`，body `{"keyword": "bigram"}`；`{"keyword": null}` 清除面板設定。
3. 環境變數 `KEYWORD_SEARCH`。

### `KEYWORD_SEARCH`

- 內容：面板沒有設定時的關鍵字引擎。
- 格式：`auto`、`bm25` 或 `bigram`（不分大小寫）；其他值視為未設定。
- 預設：`auto`。

```
KEYWORD_SEARCH=bigram
```

### 限制

- **繁體中文未實測**：`tokenizer_chinese` 用 Jieba 詞典，官方範例都是簡體；繁體詞可能斷得較碎或沒收錄。查詢與段落用同一套設定斷詞，所以多半仍能命中；`auto` 模式在 BM25 沒結果時會退回二字組。建議部署後用自己的資料測試，不理想就切回 `bigram`。
- BM25 不再加權標題（二字組模式有）。語意檢索開啟時，兩者照舊以 RRF 合併。
- 官方說明：BM25 統計在建索引時計算、之後由 VACUUM 更新，不是 MVCC 版本化；剛寫入的段落分數可能暫時不準。
- 連續超過 682 個中日韓字元、中間沒有空白或標點的片段，會被略過不進 `tsvector`（官方：每個 parser token 上限 2046 bytes）。
- `mixed` 模式下應使用 `plainto_tsquery` 類查詢；本程式以 `to_tsvector` 產生查詢詞並交給 `to_bm25query`，不使用片語查詢。
- 本機測試（PGlite）沒有這兩個擴充套件，只能用替身物件驗證 SQL 與退路；**尚未在真實 Neon 上執行過**。
- 要完全移除：切到 `bigram` 即可；若要刪除資料庫物件，執行 `DROP INDEX doc_chunks_bm25; ALTER TABLE doc_chunks DROP COLUMN tsv_zh; DROP TEXT SEARCH CONFIGURATION public.pa_zh;`。

## 網頁搜尋

輸入框的「搜尋」開啟時，伺服器先搜尋網路，把摘要放進系統提示再交給聊天模型。搜尋不是模型，也不在「供應商」裡加。

設定位置：設定 → 供應商 → 「網頁搜尋」卡片。

- 服務：Jina（`s.jina.ai`）或 Tavily；「自動」會用有 Key 的那個，Jina 優先；也可「關閉」。
- Key：加密（AES-256-GCM，`ENCRYPTION_KEY`）存在 Neon `settings` 的 `secret.search.<服務>`，不經 `/api/settings` 回傳、不進備份；金鑰輪替時一併重新加密。額度用完時貼上新 Key 按「儲存」即可，不用重新部署。
- 長度：結果數（1–5，預設 3）、每則字數（100–1200，預設 400）、總字數（300–6000，預設 1500）。Jina 以 `X-Respond-With: no-content` 只取摘要，不抓全文。
- 查詢：取最後一則使用者訊息；寒暄或過短不搜尋，短追問會帶上前一則使用者訊息。回答下方只列出回答裡實際引用到網址或網域的來源。
- 退路：面板沒有 Key 時用環境變數 `JINA_API_KEY`、`TAVILY_API_KEY`（需重新部署）。

### `JINA_API_KEY`

格式：Jina 的 API Key（`jina_` 開頭）。

範例：

```
JINA_API_KEY=jina_xxxxxxxxxxxxxxxx
```

依 https://jina.ai/reader/ ：新 Key 附 1,000 萬 token，每次搜尋至少扣 10,000 token（約 1,000 次）。

### `TAVILY_API_KEY`

格式：Tavily 的 API Key（`tvly-` 開頭）。

範例：

```
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxx
```

依 https://docs.tavily.com/documentation/api-credits ：免費每月 1,000 credits，basic 搜尋每次 1 credit。

## MCP 工具

設定位置：設定 → 供應商 → 「MCP 工具」卡片。填名稱與網址；伺服器需要認證時勾選「需要認證」再填 Token（預設送 `Authorization: Bearer <Token>`，少數伺服器要其他標頭名稱如 `X-API-Key`，在「進階」改）。不勾選就不送任何認證標頭。按「新增並連線」會立刻取得工具清單。

- 傳輸：只支援 **Streamable HTTP**（MCP 規格 2025-06-18，https://modelcontextprotocol.io/specification/2025-06-18/basic/transports ），網址須 HTTPS、不可指向內網。Netlify Functions 不能啟動子行程，所以 stdio（本機指令）類 MCP 伺服器無法使用；舊版 HTTP+SSE（2024-11-05）傳輸也未支援。
- Token：加密（AES-256-GCM）存在 `settings` 的 `secret.mcp.<id>`，不經 `/api/settings` 回傳、不進備份，金鑰輪替時一併重新加密。標頭為 `Authorization` 且 Token 沒寫 `Bearer` 時自動補上。
- 工具：每台伺服器最多 50 個、全部最多 64 個交給模型；可取消勾選個別工具或停用整台伺服器。工具清單在新增、換 Token、按「重新連線」時更新。
- **確認**：伺服器只把工具清單交給模型，不會自己執行。模型要呼叫工具時，對話中出現確認卡（工具名稱、所屬伺服器、參數），按「允許」才呼叫 `/api/mcp/call`，按「拒絕」則告訴模型使用者拒絕；結果送回模型繼續回答，最多 5 回合。
- 需求：聊天模型要支援 OpenAI 格式的 tool calling（`tools`／`tool_calls`）。不支援的模型可能報錯，可在面板停用 MCP 伺服器。
- 限制：工具結果最多 12,000 字；單次呼叫逾時 45 秒；對話記錄只保存文字回答，不保存工具參數與結果。

### 讓模型呼叫 MCP 工具

1. 新增伺服器並連線成功，確認卡片上的工具有勾選、伺服器為啟用。
2. 聊天時選支援 tool calling 的模型（例如 Groq `llama-3.3-70b-versatile`）。小模型或本機模型常忽略工具。
3. 直接提出需要該工具的問題；啟用的工具會自動附在每次聊天請求中（`tool_choice: auto`），不需另外開關。
4. 模型決定呼叫時出現確認卡，按「允許」執行。想提高呼叫機率，可在問題裡點名工具，例如「用 XX 工具查……」。
5. 沒出現確認卡：多半是模型不支援工具或判斷不需要；換模型或改問法。確認卡需要頁面開著，關頁後不會執行工具。

## API Key 加密金鑰輪替

供應商的 API Key 在資料庫裡以 AES-256-GCM 加密，金鑰只在 Netlify 環境變數。每個密文開頭都帶著加密時用的**版本名**，格式是 `版本.iv.密文`，例如 `v1.Xk3…`。解密時依版本名挑金鑰，所以新舊金鑰可以同時存在，輪替時不會有 Key 突然讀不到。

### 三個變數

**`KEY_VERSION`**

- 內容：目前 `ENCRYPTION_KEY` 的版本名。新加密的 Key 都會標上這個名稱。
- 格式：自訂短字串，建議 `v1`、`v2`、`v3` 依序遞增；不能含 `.`。選填，未設定時為 `v1`。
- 範例：

```
v2
```

**`ENCRYPTION_KEY_PREVIOUS`**

- 內容：上一把金鑰，只在輪替期間用來解開舊密文。
- 格式：與 `ENCRYPTION_KEY` 相同，base64 編碼的 32 bytes（約 44 字元）。
- 範例：

```
（輪替前 ENCRYPTION_KEY 的值，44 字元左右的 base64）
```

**`KEY_VERSION_PREVIOUS`**

- 內容：`ENCRYPTION_KEY_PREVIOUS` 的版本名，必須等於舊密文開頭的版本名，也就是輪替前的 `KEY_VERSION`。
- 格式：同 `KEY_VERSION`。選填，未設定時為 `v0`；若第一次部署沒設 `KEY_VERSION`，舊版本是 `v1`，這裡就要填 `v1`。
- 範例：

```
v1
```

### 輪替步驟

1. 產生新金鑰：`npm run gen:key`。
2. 在 Netlify 環境變數：
   - 把**目前的** `ENCRYPTION_KEY` 值複製到 `ENCRYPTION_KEY_PREVIOUS`，目前的 `KEY_VERSION`（沒設就是 `v1`）填到 `KEY_VERSION_PREVIOUS`。
   - `ENCRYPTION_KEY` 改成新金鑰，`KEY_VERSION` 改成新版本名（例如 `v2`）。
3. 重新部署。此時舊 Key 用舊金鑰解、新存的 Key 用新金鑰加密，一切照常。
4. 重新加密舊 Key（擇一）：
   - 設定 → 資料控制 →「API Key 加密金鑰」→ **重新加密**（有舊版本 Key 時才出現）。
   - 或呼叫 `POST /api/admin/rekey`。
   - 或本機執行 `DATABASE_URL=… ENCRYPTION_KEY=<新> KEY_VERSION=v2 ENCRYPTION_KEY_PREVIOUS=<舊> KEY_VERSION_PREVIOUS=v1 npm run db:rekey`。
5. 確認 `GET /api/admin/keys` 的 `outdated` 為 `0`（全部都是新版本），再從 Netlify 刪掉 `ENCRYPTION_KEY_PREVIOUS` 與 `KEY_VERSION_PREVIOUS`，重新部署。

注意：

- 步驟 5 之前不要刪舊金鑰，否則還沒重新加密的 Key 會無法解密，只能重新輸入。
- 版本名不能重複使用；同一個版本名對應兩把不同金鑰會解密失敗。
- 輪替只影響資料庫裡的供應商 API Key，不影響登入 session（要登出所有裝置請改 `SESSION_VERSION`）。

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

- **金鑰輪替**：見[API Key 加密金鑰輪替](#api-key-加密金鑰輪替)。
- **備份**：`/api/backup` 匯出 JSON，`/api/backup/restore` 還原。備份**不含** API Key、檔案本體與環境變數供應商（`env-N` 不會被還原建立）；還原後面板供應商需重新輸入 Key，環境變數供應商只要新環境有同樣的 `PROVIDER_N_*` 即可直接使用與重建向量。

## 免費額度提醒

- **Netlify Free**：每月 300 credits、硬上限，正式部署每次 15 credits，Deploy Preview 免費（[How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)）。Functions 同步回應上限 60 秒（[Functions](https://docs.netlify.com/build/functions/configuration/)）。
- **Neon Free**：每專案 100 CU-hours／月、儲存 1 GB、閒置 5 分鐘自動暫停；Object Storage 5 GB（[Plans](https://neon.com/docs/introduction/plans)）。
- **Cloudflare Workers AI**（若用它當嵌入供應商）：每帳號每天 10,000 Neurons 免費，UTC 0 點重置；超額時當天語意檢索退回關鍵字（[Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)）。
- **Cohere trial Key**（若用它當嵌入供應商）：每月 1,000 次 API 呼叫（[Rate limits](https://docs.cohere.com/docs/rate-limits)）。

## 授權

MIT，見 [`LICENSE`](LICENSE) 與 [`NOTICE`](NOTICE)。本專案衍生自 Trujillo AI Studio。
