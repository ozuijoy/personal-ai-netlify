# Personal AI — Netlify + Neon 移植架構

> 狀態：第一、二階段（後端基礎、前端改為伺服器為主）已在本機完成，未部署、未推送。平台限制皆引自官方文件（2026-11-10 查閱），連結附於各節。

## 0. 總覽

```
瀏覽器（單檔前端，localStorage 降為快取）
   │  HTTPS，同源 Cookie（__Host-session）
   ▼
Netlify CDN ── public/（app.js / app.css / i18n，immutable 快取）
   │
   ├─ Edge Function  /api/chat          （Deno，串流代理，不計 compute）
   └─ Function app   /、/login、/api/*   （Node 22，同步 60 秒）
          │                         │
          ▼                         ▼
   Neon Postgres（文字資料）     Neon Object Storage（S3 相容，檔案本體，第三階段）
```

| 元件 | 選擇 | 理由 |
|---|---|---|
| 資料庫 | Neon Postgres（`@neondatabase/serverless` HTTP 驅動） | 一次查詢一個 fetch，適合短命函式，不需連線池 |
| 物件儲存 | **推薦 Neon Object Storage**（備選 Netlify Blobs） | 見 §3 比較 |
| 串流聊天 | Netlify Edge Function | 避開 Function 60 秒上限與 compute 計費 |
| 其他 API | 單一 Netlify Function（沿用原 router） | 冷啟動只有一個函式、程式碼與 Cloudflare 版共用 |

## 1. 整體架構

### 1.1 路由對照

| 原 Cloudflare Worker | Netlify 版 | 備註 |
|---|---|---|
| `/api/health` `/api/config` `/api/me` | Function `app` | `me.config` 新增 `storage`、`encryption`；`sync` 固定 false |
| `/api/login` `/api/logout` `/login` `/` | Function `app` | 登入節流改存 Postgres（`login_attempts`） |
| `/sandbox/frame` `/robots.txt` | Function `app` | PREVIEW_CSP 不變 |
| `/api/chat` | **Edge Function `chat`** | Function 內仍保留同路徑作為本機/備援 |
| `/api/image` `/api/tool` | Function `app` | 不變 |
| `/api/models`（POST，帶 baseUrl+key） | Function `app` | 保留相容；另支援 `provider_id`（伺服器解密 Key） |
| `/api/sync` `/api/sync/status` | 回 **410** | 由下列資料 API 取代 |
| — | `/api/settings` `/api/profile` | 新 |
| — | `/api/providers[/:id[/models|/discover]]` | 新，Key 只進不出 |
| — | `/api/models/grouped` | 新，依供應商分組的模型選單 |
| — | `/api/conversations[/:id[/messages]]` | 新 |
| — | `/api/{projects,documents,skills,memories,prompts}[/:id]` | 新，通用 CRUD |
| — | `/api/documents/search?q=` | 新，知識庫檢索 |
| 靜態檔 `/assets/*` | Netlify CDN（`public/_headers` 沿用） | |

### 1.2 平台限制與影響

Netlify Functions（[configuration](https://docs.netlify.com/build/functions/configuration/)、[API](https://docs.netlify.com/build/functions/api/)）：

- 同步執行上限 **60 秒**，不可調；串流回應同樣 60 秒、回應上限 20 MB。
- 緩衝請求／回應 **6 MB**；二進位請求經 Base64，實際約 **4.5 MB**。
- 記憶體 1024 MB（Free 不能調）。計費 = 執行時間 × 記憶體（GB-hour）。

Edge Functions（[limits](https://docs.netlify.com/build/edge-functions/limits/)）：每請求 **50 ms CPU**（等待 I/O 不算）、**40 秒內須送出回應標頭**、不計 compute，只計 web request。

**60 秒上限的影響與對策**

1. 推理模型或長回答常超過 60 秒 → `/api/chat` 放 Edge Function：只做驗證、查 Key、把上游 SSE 位元組原樣轉送，不逐 token 解析，CPU 極低。
2. 上游 40 秒內必須回應標頭：OpenAI 相容 API 開串流後通常 1–5 秒就回標頭，風險低；若某供應商不支援串流（回整包 JSON）且生成超過 40 秒會失敗 → 前端提示改用支援串流的模型。
3. 官方未載明 Edge 串流的總時長上限 → 部署後第一件事就是實測 > 60 秒的回答（列入第二階段驗收）。
4. 訊息存檔不在串流中做：串流結束後由前端 `POST /api/conversations/:id/messages` 追加（避免 Edge CPU 上限與中斷時遺失）。

### 1.3 登入與 Session

- 沿用單一密碼（`APP_PASSWORD`）+ HMAC 簽章 Cookie（`__Host-session`，HttpOnly、Secure、SameSite=Lax），**驗證不查資料庫** → 一般請求不會喚醒 Neon。
- 新增 `SESSION_VERSION`：改環境變數即讓所有裝置登出。
- 登入失敗節流：Serverless 實例不共享記憶體，改寫入 `login_attempts`（IP 先 SHA-256 雜湊，15 分鐘 5 次 → 封鎖 5 分鐘）。客戶端 IP 取 `x-nf-client-connection-ip`。
- 寫入類 API 一律檢查 `Origin` 同源（沿用 `sameOriginRequest`）。

### 1.4 API Key 伺服器端加密（AES-256-GCM）

- 金鑰：`ENCRYPTION_KEY` = 32 bytes base64（`npm run gen:key`），只存 Netlify 環境變數；資料庫外洩也解不開。
- 每筆隨機 12-byte IV；AAD = `provider:<owner>:<id>`，密文被搬到別列會解密失敗。
- 儲存格式 `v1.<iv>.<ciphertext+tag>`（base64url），另存 `api_key_hint`（`••••末4碼`）供 UI 顯示。
- **Key 只進不出**：API 回傳只有 `has_key`、`api_key_hint`；解密只在 Edge/Function 呼叫上游當下發生。
- 輪替：新金鑰放 `ENCRYPTION_KEY`＋`KEY_VERSION=v2`，舊金鑰改放 `ENCRYPTION_KEY_PREVIOUS`＋`KEY_VERSION_PREVIOUS=v1`，舊密文仍可解；之後可跑重加密腳本。
- 使用 WebCrypto，Node 與 Deno（Edge）共用同一份程式。

## 2. Neon 資料表

完整 SQL：`db/migrations/0001_init.sql`（已用 PGlite 實際執行並通過測試）。

| 表 | 用途 | 重點欄位 |
|---|---|---|
| `providers` | 自訂供應商 | `base_url`（CHECK https）、`api_key_enc` 可為 NULL（無 Key）、`api_key_hint`、`key_version` |
| `provider_models` | 各供應商模型清單 | `(provider_id, model_id)` 唯一、`enabled`、`sort_order` |
| `settings` | 介面偏好、目前模型等 | `(owner_id, key)` → `jsonb` |
| `profiles` | 個人資料 | `data jsonb` |
| `projects` | 專案 | `name`、`description`、`instructions`、`data` |
| `conversations` | 對話 | `project_id`、`pinned`、`archived`、`provider_id`、`model_id` |
| `messages` | 訊息 | `(conversation_id, seq)` 唯一、`role`、`content`、`sources`、`attachments`、`meta` |
| `files` | 上傳檔案中繼資料 | `storage_key`、`status`（pending/uploaded/extracted/failed）、`sha256` |
| `documents` | 知識庫文件（筆記、檔案抽出全文） | `doc_type`、`file_id`、`project_id` |
| `doc_chunks` | 檢索單位 | `content`、`tsv`（generated）、pg_trgm GIN；向量欄位待 0002 |
| `skills` | 技能（新） | `instructions`、`trigger_mode`（always/manual/keyword）、`keywords[]` |
| `memories` | Memory（新） | `content`、`kind`、`pinned`、`project_id`、`source_conversation_id` |
| `prompts` | Prompt 庫 | `kind`（favorite/recent/template） |
| `login_attempts` | 登入節流 | 雜湊後的 IP |
| `legacy_sync_items` | 舊 D1 原始列 | 遷移核對與重跑 |

設計原則：每表都有 `owner_id`（目前固定 `owner`，日後可多使用者）；軟刪除 `deleted_at`；`id` 為 text，可沿用前端既有 id（如 `p_1700…`），POST 同 id 視為更新（冪等，離線重送安全）。

## 3. 檔案上傳流程（第三階段實作）

### 3.1 Netlify Blobs vs S3 相容（Neon Object Storage）

| | Netlify Blobs | Neon Object Storage |
|---|---|---|
| 設定 | 零設定 | 需在 Neon 專案建 bucket、設 CORS |
| 瀏覽器直傳 | **不支援**（無 presigned URL），只能經 Function → 受 6 MB／實際 4.5 MB 限制 | **支援 presigned PUT／GET 與表單 POST** |
| 單檔上限 | 5 GB（但經 Function 上傳實際 ≈4.5 MB） | 單次 5 GiB，multipart 10 GiB |
| 下載 | 必須經 Function → 消耗 compute＋bandwidth credits | presigned GET 直連，不經 Netlify |
| 免費額度 | 仍標示 Beta，官方未公布儲存定價 | Free 5 GB／專案；egress 計入 Neon 每月 5 GB 公網流量 |
| 狀態 | 正式可用 | 較新（S3 子集合，path-style、SigV4） |

來源：[Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)、[Neon Object Storage](https://neon.com/docs/storage/overview)、[S3 相容性](https://neon.com/docs/storage/s3-compatibility)、[Neon 方案](https://neon.com/docs/introduction/plans)。

**推薦 Neon Object Storage**：直傳可繞過 4.5 MB 限制，下載不吃 Netlify 的 bandwidth credits（Free 只有 300 credits），且與資料庫同一個 Neon 專案管理。程式會包一層 `storage` 介面（put/get/presign/delete），日後要換 Cloudflare R2 或 Netlify Blobs 只改一個檔。若不想多一個服務，Netlify Blobs 也可行，但上傳上限要改為 4 MB。

### 3.2 流程

1. 前端 `POST /api/files`（檔名、大小、MIME、sha256）→ 伺服器檢查大小／類型，建 `files` 列（pending），回傳 presigned PUT URL（5 分鐘）。
2. 瀏覽器直接 PUT 到物件儲存。
3. 前端 `POST /api/files/:id/complete` → 伺服器 HEAD 確認大小，狀態改 uploaded。
4. **抽文字在瀏覽器做**：PDF 用 pdf.js、DOCX 用 mammoth.js（動態載入），抽出的文字 `POST /api/documents`（`file_id` 關聯）→ 伺服器切塊（約 1200 字、重疊 150）寫入 `doc_chunks`。理由：不佔 Function 的 60 秒與 compute，大檔也不受 6 MB 請求限制（文字通常遠小於原檔）。掃描型 PDF（無文字層）先標示「無可抽取文字」。
5. 大小限制建議：單檔 25 MB、純文字抽取結果 ≤ 900,000 字元（與舊 D1 上限一致）。

### 3.3 檢索

- 第一版（已實作）：查詢拆成英數字詞＋中文二字組（bigram），以命中數＋標題加權＋`simple` 全文分數排序。PostgreSQL 內建全文檢索不會斷中文；實測 pg_trgm 對短中文查詢相似度只有 0.2，不適合當主要依據。個人知識庫規模（數千塊）順序掃描即可。
- 第二版（第五階段，選用）：`CREATE EXTENSION vector`（Neon 支援 pgvector 0.8），`doc_chunks` 加 `embedding vector(N)`＋HNSW 索引，用使用者自己的供應商產生嵌入，和關鍵字分數混合排序。維度依所選嵌入模型決定，所以延後。

## 4. 前端改動範圍（第二階段）

前端是單檔 `src/web_decoded.html`（約 31 萬字元），localStorage 鍵約 30 個。策略：**伺服器為主、localStorage 只當快取與離線暫存**，新增一個 `api` 小模組集中所有請求。

| 現有 localStorage | 改成 |
|---|---|
| `ta_providers_v1`、`ta_provider_active`、`ta_custom_key` | `/api/providers`（Key 不再存瀏覽器）；目前供應商存 `settings.active_model` |
| `ta_model` | `settings.active_model = {provider_id, model_id}` |
| `ta_profile` | `/api/profile` |
| `ta_ai_chats` | `/api/conversations`（列表只拿標題，打開才載訊息）＋串流後追加 |
| `ta_projects`、`ta_project_active` | `/api/projects`；active 留在本機（裝置狀態） |
| `ta_documents`、`ta_knowledge` | `/api/documents`；`searchDocuments` 改呼叫 `/api/documents/search` |
| `ta_prompt_favs`、`ta_prompt_recent` | `/api/prompts` |
| `ta_custom_prompt`、`ta_tone`、`ta_len_mode`、`ta_auto_search`、`ta_use_docs`、`ta_timezone` 等 | `/api/settings` |
| `ta_theme`、`ta_font`、`ta_accent`、`ta_compact_sb`、`ta_reduce_motion` 等介面偏好 | `/api/settings`（啟動時先用本機快取避免閃爍） |
| `ta_sync_meta_v1` 與整段同步程式 | 刪除 |
| `ta_ephemeral`（暫時對話） | 不上傳伺服器（維持本機） |

其他：首次登入新版時偵測本機舊資料，一鍵「匯入到伺服器」（用同一組 API，id 沿用、可重跑）；新增技能與 Memory 的設定頁。

### 4.1 第二階段實作方式（已完成）

- 原本的 D1 同步區塊整段換成「伺服器儲存層」，對外函式名稱不變（`scheduleSync`、`syncBootstrap`、`syncNow`），其餘 UI 程式幾乎不用改。
- 啟動：讀伺服器的設定、個人資料、專案、文件、對話列表；只抓有變動的對話全文。伺服器為準，但本機尚未送出的修改會保留並送出。
- 存檔：每次 `saveChats / saveDocuments / saveProjects / 儲存設定` 後 1.5 秒，只送雜湊有變的項目；失敗 15 秒後重試，資料仍留在本機。
- 刪除：本機刪除 → 伺服器軟刪除；其他裝置刪除 → 下次同步時本機移除。
- 首次使用：這個瀏覽器從未上傳過的對話、文件、專案、設定會自動上傳；`ta_providers_v1` 內的供應商（含 Key）上傳加密後**從瀏覽器刪除**。
- 測試：`test/frontend.test.mjs` 用 jsdom 載入實際打包的 `app.js`，fetch 接到真的 router＋PGlite，驗證上述流程。

## 5. 空 API Key 與模型選單分組

- 後端：`providerFromBody` 已允許空 Key（只擋換行與超長）；空 Key 時**不送 `Authorization` 標頭**；資料庫 `api_key_enc` 可為 NULL。已有測試。
- 前端（已完成）：移除 `apiKey.length < 8` 檢查；編輯時 Key 欄位留空 = 保留原 Key，勾選「清除已儲存的 Key」改為無 Key；模型欄位可填多個（逗號分隔），「抓取模型」對已儲存的供應商由伺服器代查，Key 不經過瀏覽器。
- 模型選單（已完成）：改讀 `/api/models/grouped`，以 `<optgroup>`／分組標題呈現「Groq（內建）」與每個自訂供應商各自的模型；選取值為 `provider_id + model_id`，不再混用同一個 `MODELS` 陣列。內建 Groq 只在伺服器設定 `GROQ_API_KEY` 時出現。

## 6. 從 D1 遷移

1. 舊專案目錄執行唯讀匯出：
   `npx wrangler d1 execute personal-ai --remote --json --command "SELECT owner_id, item_key, value, updated_at, deleted FROM sync_items" > d1-export.json`
2. 預演：`node scripts/import-d1.mjs d1-export.json --dry-run`（只印統計）。
3. 匯入：`DATABASE_URL=… node scripts/import-d1.mjs d1-export.json`。
4. 對應：`project:` → projects；`doc:` → documents（並切塊）；`chat:` → conversations＋messages（`ai` → `assistant`）；`prompt:favs/recent` → prompts；`setting:*` → settings；`deleted=1` 不建立實體。所有原始列存入 `legacy_sync_items`。指向不存在專案的對話改為無專案。可重跑（同 id 覆蓋）。
5. D1 沒有的資料（API Key、模型、個人資料、知識庫、介面偏好）只在各裝置 localStorage → 由第二階段前端的「匯入本機資料」處理；API Key 需在新版重新輸入或由匯入流程上傳後加密。
6. 舊 Cloudflare 部署全程不動，可並行運作到確認無誤。

## 7. 分階段計畫與免費額度風險

| 階段 | 內容 | 狀態 |
|---|---|---|
| 1 後端基礎 | Netlify 結構、Neon schema、登入節流、AES-GCM、供應商／模型（含空 Key、分組）、設定、個人資料、對話、專案、文件＋檢索、技能、Memory、Prompt 的 CRUD API、Edge 串流、D1 匯入腳本、測試 | **完成（本機）** |
| 2 前端改為伺服器為主 | 伺服器儲存層取代 D1 同步、供應商設定頁（Key 加密存伺服器、可留空、可清除）、分組模型選單、聊天送 `provider_id`、知識庫改伺服器檢索、舊瀏覽器資料與 Key 自動上傳 | **完成（本機）**；首次部署待你同意 |
| 3 檔案 | Neon Object Storage bucket＋CORS、presigned 上傳、pdf.js／mammoth 抽文字、專案檔案 | |
| 4 技能與 Memory | 設定頁、技能注入系統提示（always／keyword／手動）、對話後建議寫入 Memory（需使用者確認） | |
| 5 強化 | pgvector 混合檢索、金鑰重加密腳本、匯出備份 | |

### 免費額度風險

**Netlify Free（credit 制）**（[How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)）：每月 **300 credits、硬上限**，用完**所有站點暫停**到下個週期，不能加購。

| 項目 | 費率 | 估算 |
|---|---|---|
| 正式部署 | 15 credits／次 | **最大風險**：20 次部署就用光。開發期用 Deploy Preview（0 credits），累積再一次正式部署 |
| Functions compute | 10 credits／GB-hour | 一般 API 約 0.2 秒 → 1 萬次 ≈ 0.6 GB-h ≈ 6 credits；聊天走 Edge 不計 |
| Web requests | 2 credits／萬次 | 個人使用每月幾萬次 ≈ 10 credits 內 |
| Bandwidth | 20 credits／GB | 前端約 1.3 MB（已設 immutable 快取）；檔案下載不經 Netlify（presigned 直連 Neon） |

個人日常使用估計每月 50–100 credits，主要變數是部署次數。

**Neon Free**（[Plans](https://neon.com/docs/introduction/plans)）：每專案 100 CU-hours／月、Postgres 儲存 1 GB、公網流量 5 GB／月、閒置 5 分鐘自動暫停（不可關）、Object Storage 5 GB。超過 CU-hours 或流量 → compute 暫停到下個週期；超過儲存 → 寫入失敗（不刪資料）。估算：最小 0.25 CU，每次喚醒至少約 5 分鐘 ≈ 0.02 CU-h，一天喚醒 20 次 ≈ 每月 12 CU-h，遠低於 100。1 GB 文字約可存數十萬則訊息；檔案本體放物件儲存不佔這 1 GB。Session 驗證不查庫，所以只有真正讀寫資料時才喚醒。

另：Netlify Function 預設區域 us-east-2（Ohio），Neon 專案與 bucket 也建在 AWS us-east-2 可降低延遲。
