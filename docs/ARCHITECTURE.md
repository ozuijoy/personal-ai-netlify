# Personal AI — Netlify + Neon 移植架構

> 狀態：第一至五階段（後端基礎、前端改為伺服器為主、檔案上傳、技能與記憶、語意檢索／金鑰輪替／備份）已在本機完成，未部署、未推送。平台限制皆引自官方文件（2026-11-10 查閱），連結附於各節。

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
- 環境變數供應商（`PROVIDER_N_*`，見 §3.6）的 Key 不加密入庫，只在呼叫上游時從環境變數讀取；API 只回 `has_key`，不回 Key 提示。
- 輪替：新金鑰放 `ENCRYPTION_KEY`＋`KEY_VERSION=v2`，舊金鑰改放 `ENCRYPTION_KEY_PREVIOUS`＋`KEY_VERSION_PREVIOUS=v1`，舊密文仍可解；之後可跑重加密腳本。
- 使用 WebCrypto，Node 與 Deno（Edge）共用同一份程式。

## 2. Neon 資料表

完整 SQL：`db/migrations/0001_init.sql`、`0002_vectors.sql`、`0003_model_kinds.sql`、`0004_cjk_bm25.sql`（0001–0003 已用 PGlite 實際執行並通過測試；0004 在 PGlite 上會略過，只以替身物件測試查詢）。

| 表 | 用途 | 重點欄位 |
|---|---|---|
| `providers` | 設定面板新增的供應商（環境變數供應商不在這裡） | `base_url`（CHECK https）、`api_key_enc` 可為 NULL（無 Key）、`api_key_hint`、`key_version` |
| `provider_models` | 各供應商模型清單 | `kind`（`chat`／`embed`，0003 新增，既有列為 `chat`）、`(provider_id, kind, model_id)` 唯一、`enabled`、`sort_order` |
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

### 3.2.1 第三階段實作（已完成）

- `src/storage.js`：以 WebCrypto 自寫 SigV4（不用 AWS SDK），path-style；presigned PUT/GET、HEAD、DELETE。用 AWS 官方文件的兩組範例簽章驗證正確。
- 環境變數用 `STORAGE_*`（不用 `AWS_*`，避免與 Lambda 保留名稱衝突，屬推測，部署時確認）；本機也接受 Neon CLI 產生的 `AWS_*`。
- API：`POST /api/files`（回 presigned PUT）→ 瀏覽器直傳 → `POST /api/files/:id/complete`（附抽出的文字）。complete 時伺服器 HEAD 檢查：物件不存在就拒絕；實際大小超過上限（presigned PUT 無法限制大小）就刪除物件。實作上文字併在 complete 一次送出，不另外呼叫 `/api/documents`。
- 抽文字函式庫**自架**在 `/assets/vendor/`（pdf.js 4.10.38 含中文 CMap、mammoth 1.8.0），build 時從 npm 複製，按需載入；CSP 不必開放 CDN，只在 `connect-src` 加上物件儲存的 origin。
- 掃描型 PDF：可抽文字少於 10 字視為無文字層，只保存檔案、標示「無文字層」，不做 OCR。
- 前端：知識庫「匯入檔案」改走上傳（PDF、DOCX、文字檔）；專案編輯視窗的檔案也一樣，按儲存時先確認專案已在伺服器，再帶 `project_id` 上傳。檔案清單可下載（5 分鐘 presigned GET）與刪除（物件＋知識庫文件一起刪）。
- 本機快取只存檔案文件的前 3000 字（`full=compact`），全文留在伺服器做檢索，避免 localStorage 爆量；這類文件前端不回寫。
- Bucket 需設定 CORS：`node scripts/storage-cors.mjs https://站點網址`。
- 測試：SigV4 範例、檔案 API 全流程（含超量、掃描檔、專案、503），以及 jsdom 前端實際上傳中文 PDF／DOCX／掃描 PDF 並檢索。

### 3.3 檢索

- 第一版（已實作）：查詢拆成英數字詞＋中文二字組（bigram），以命中數＋標題加權＋`simple` 全文分數排序。PostgreSQL 內建全文檢索不會斷中文；實測 pg_trgm 對短中文查詢相似度只有 0.2，不適合當主要依據。個人知識庫規模（數千塊）順序掃描即可。
- 中文斷詞＋BM25（0004，`src/keyword_search.js`）：Neon Lakebase Search 的 `lakebase_tokenizer`（`tokenizer_chinese`，Lindera＋Jieba，`mixed` 模式）產生 `doc_chunks.tsv_zh`（產生欄位，設定 `public.pa_zh` 複製自 `tokenizer_chinese`），`lakebase_text` 的 `lakebase_bm25` 索引 `doc_chunks_bm25` 排序。查詢：`tsv_zh <@> to_bm25query(to_tsvector('public.pa_zh', q), 'doc_chunks_bm25')`，升冪＝最相關；內層只掃 `doc_chunks`（owner 過濾、LIMIT 200）讓索引做 top-K，外層再接 documents 過濾已刪除與專案，排除分數 0 的列。需 Postgres 16+；資料庫沒有擴充套件時 0004 略過。官方文件：https://neon.com/docs/extensions/lakebase-tokenizer 、https://neon.com/docs/extensions/lakebase-text 。
- 引擎選擇：`settings['search.keyword']`（`auto`／`bm25`／`bigram`）＞環境變數 `KEYWORD_SEARCH`＞`auto`。`auto`：有索引用 BM25，BM25 無結果（`keyword_fallback: 'bm25_empty'`）或出錯（`keyword_error`）時同次查詢改用二字組；`bm25`：無結果不退回，出錯或未啟用仍退回並附 `keyword_error`；`bigram`：只用二字組。可用性檢查（`to_regclass('public.doc_chunks_bm25')`＋`pa_zh` 存在）每個 db 物件快取 60 秒，BM25 出錯時清快取。`hybridSearch` 回應加 `keyword_engine`。API：`GET /api/search/status`、`PUT /api/search/config {keyword}`；面板「供應商」分頁「關鍵字檢索」卡片。
- 風險：Jieba 詞典對繁體中文效果未實測；BM25 不加權標題；BM25 統計由 VACUUM 更新、非 MVCC（官方），0004 將 `doc_chunks` 的 `autovacuum_vacuum_insert_scale_factor` 設 0；備份不含 doc_chunks，不受產生欄位影響。
- 第二版（第五階段，選用）：`CREATE EXTENSION vector`（Neon 支援 pgvector 0.8），`doc_chunks` 加 `embedding vector(N)`＋HNSW 索引，用使用者自己的供應商產生嵌入，和關鍵字分數混合排序。維度依所選嵌入模型決定，所以延後。

## 3.4 技能與記憶（第四階段，已完成）

- **注入在伺服器做**（`src/repo/context.js`）：聊天請求帶 `project_id`、`skill_ids`、`use_skills`、`use_memory`，伺服器查技能與記憶後加進 system prompt。前端送來的同名內部欄位會被忽略，無法偽造。
- **技能觸發**：`always` 每次；`keyword` 最後一則使用者訊息含任一關鍵字（不分大小寫）；`manual` 只在輸入框旁的技能選單選取時。上限 6 個、指示合計 16,000 字。
- **記憶挑選**：全域記憶＋目前專案的記憶；釘選優先，其次和這次訊息二字組重疊多的，再其次最近更新。上限 40 條、6,000 字。記憶與技能視為使用者可信設定，和知識庫、搜尋結果（不可信資料）分開標示。
- **記憶建議**（`src/memory_suggest.js`，部署時為 Edge Function `/api/memories/suggest`）：回覆後若使用者訊息像在談自己（含「我」「以後」「喜歡」「記住」等），用同一個模型非串流呼叫一次，回傳最多 3 條建議。**只回傳，不寫入**；使用者按「記住」才 `POST /api/memories`。伺服器會濾掉疑似金鑰、密碼、長數字（證件、帳號）與重複（含二字組相似度 ≥ 0.7 的近似重複）。
- 設定：「在對話中使用技能」「在對話中使用記憶」「回覆後建議可記住的事」三個開關，會同步到伺服器 settings。回覆下方顯示「已套用技能：…」。
- 成本：建議每次多一次模型呼叫（用使用者自己的 Key）；放在 Edge，等待時間不計 Netlify compute。

## 3.5 語意檢索、金鑰輪替、備份（第五階段，已完成）

**語意檢索（`src/embeddings.js`、`db/migrations/0002_vectors.sql`）**
- `doc_chunks` 加 `embedding vector`（不限維度）與 `embedding_model`。換嵌入模型不必改 schema，查詢只比對同模型、同維度的向量。代價是不能建 HNSW 索引；個人規模（數萬段以內）順序掃描即可，日後可改固定維度並加 HNSW。
- **沒有內建或預設的嵌入模型**。settings `embedding`：未設定 → **關閉**（只用關鍵字）；`{provider_id, model, dims}` → 開啟；`PUT /api/embeddings/config {reset:true}`（或 `provider_id` 為空）→ 刪除設定、回到關閉。舊版留下的 `{disabled:true}` 視同關閉。
  - `provider_id` 可以是環境變數供應商 `env-N` 或設定面板（資料庫）的供應商；Key 一律在伺服器端取得（環境變數或解密）。
  - 嵌入模型選單只列各供應商的**嵌入**模型（`PROVIDER_N_EMBED_MODELS` 或面板的「嵌入模型」欄位，即 `provider_models.kind = 'embed'`），聊天模型不會出現；仍可自由輸入其他模型名稱。`GET /api/embeddings/status` 的 `options` 提供這份清單。
  - 指定模型時先實測一次並記下維度，不預設任何維度。例：Cloudflare Workers AI `@cf/baai/bge-m3` 為 1024 維；Cohere 相容端點不支援 `dimensions`，`embed-v5.0-pro` 固定 2048 維。
  - 還原備份後，若嵌入設定指向 `env-N` 且新環境有同樣的 `PROVIDER_N_*`，不需輸入任何 Key 即可重建向量；指向面板供應商則需先重新輸入該供應商的 Key。
- 補向量：`POST /api/embeddings/backfill` 每次最多處理約 40 秒（避開 Function 60 秒上限），前端迴圈呼叫；啟動時、上傳完成後、還原後會在背景自動補。文件內容更新會重新切塊，舊向量自然清除。
- 檢索：關鍵字前 20 名與向量前 20 名（相似度 ≥ 0.2）以 RRF（k = 60）合併。嵌入 API 失敗時自動退回關鍵字，回應帶 `vector_error`。
- 成本：每次知識庫檢索多一次嵌入呼叫（使用者自己的 Key）；在 Function 內執行，多數百毫秒 compute。

**金鑰輪替（`src/repo/providers.js`）**
- 新金鑰設 `ENCRYPTION_KEY`＋`KEY_VERSION`，舊金鑰設 `ENCRYPTION_KEY_PREVIOUS`＋`KEY_VERSION_PREVIOUS`，部署後在「資料控制 → API Key 加密金鑰」按「重新加密」或執行 `npm run db:rekey`。全部顯示新版本後再移除舊變數。
- 解不開的列（缺舊金鑰）會回報失敗、不動資料。以 `WHERE api_key_enc = 舊值` 做樂觀鎖，避免覆蓋同時間的更新。

**備份（`src/backup.js`）**
- `GET /api/backup?table=&cursor=` 依資料表分頁匯出，每頁 ≤ 約 3.5 MB（Function 緩衝回應上限 6 MB）；前端組成一個 `.json` 檔下載。
- 不含：API Key 密文、環境變數供應商（`env-N` 不在資料庫）、`doc_chunks`（還原時重新切塊）、上傳檔案本體（只含中繼資料）、登入紀錄。還原後面板供應商需重新輸入 Key。
- 還原會略過 id 以 `env-` 開頭的供應商列（不能藉備份建立或覆蓋環境變數供應商）；0003 之前的備份沒有 `provider_models.kind`，一律視為聊天模型。
- `POST /api/backup/restore {table, rows}`：以 `jsonb_populate_recordset` 寫入，相同 id 覆寫，其他資料保留；可重複執行。子表只接受自己名下的父列；找不到的 `project_id`、`file_id` 改為 NULL。

## 3.6 供應商來源：環境變數與設定面板（沒有內建供應商）

- **沒有任何內建供應商**（舊的 `builtin-groq`、`builtin-cloudflare-embed`、`GROQ_*`、`CLOUDFLARE_*`、`EMBEDDING_MODEL` 已移除，設定了也不會生效）。供應商只有兩個來源：
  1. **設定面板（資料庫）**：可新增、修改、刪除；Key 以 AES-GCM 加密存 `providers.api_key_enc`；模型存 `provider_models`，`kind` 分 `chat`／`embed`。
  2. **環境變數**：`PROVIDER_N_NAME`、`PROVIDER_N_BASE_URL`（必填）、`PROVIDER_N_API_KEY`、`PROVIDER_N_MODELS`、`PROVIDER_N_EMBED_MODELS`（選填，逗號分隔），`N = 1..20`。
- 環境變數解析（`src/providers.js` `scanEnvProviders`）：每次請求掃描 1–20 **全部編號**（跳號不中斷）；`NAME` 或 `BASE_URL` 缺一則略過；`BASE_URL` 用與面板相同的 `normalizeBaseUrl` 檢查（HTTPS、擋 localhost／私有網段／`.local`／`.internal`），不合法則略過；`API_KEY` 可空（自架閘道，不送 `Authorization`），含換行或過長則略過。略過原因以 `{index, error}`（不含 Key）放在 `GET /api/providers` 的 `env_errors`，面板顯示。
- 環境變數供應商 id 為 `env-N`，`source: 'env'`、`readonly: true`、`note: '由環境變數管理'`，`has_key` 只表示是否有 Key，`api_key_hint` 一律為空。Key **不進資料庫、不回傳瀏覽器、不進備份**。
- 不可經 API 修改：`PATCH`／`DELETE /api/providers/env-N`、`PUT /api/providers/env-N/models` 回 `403 env_provider_readonly`；建立面板供應商時不能使用 `env-` 開頭的 id。`POST /api/providers/env-N/discover` 可用（伺服器用環境變數 Key 代查）。
- 列表順序：環境變數供應商（依 N）在前，面板供應商在後。`GET /api/models/grouped` 只含**聊天**模型、每個供應商一組、沒有內建組；只有嵌入模型的供應商不出現在聊天選單。
- **預設值在面板選，沒有自動預設**：
  - 聊天：前端送 `provider_id + model`；請求沒帶時，伺服器改用設定面板選的 `settings.active_provider_id` + `settings.active_model_id`；仍沒有 → 400「請先在設定中新增供應商並選擇模型」。前端不再自動挑第一個模型，未選時模型選單顯示「選擇模型」，送出時提示同一句話。
  - 嵌入：見 §3.5，未設定即關閉。
- 舊前端相容：請求內帶 `provider: {baseUrl, apiKey}`（舊瀏覽器保存 Key 模式）仍可用，但沒有任何伺服器端退回。
- 遷移：`0003_model_kinds.sql` 只新增欄位與唯一索引（`provider_models.kind`，既有列為 `chat`，唯一鍵改為 `(provider_id, kind, model_id)`），需在部署新版程式前執行 `npm run db:migrate`。

## 3.7 網頁搜尋供應商（面板）

- `src/web_search_config.js`：`settings.search.web` = {provider: jina|tavily|off, maxResults, snippetChars, contextChars}；Key 存 `secret.search.<provider>`（AES-256-GCM，AAD = owner_id + 設定鍵）。`secret.*` 由 `/api/settings` 過濾、拒寫，`backup` 匯出排除；`/api/admin/rekey` 一併重新加密。
- `src/tools/search.js`：`searchWeb` 依 provider 呼叫 `s.jina.ai`（`Accept: application/json`、`X-Respond-With: no-content`）或 `api.tavily.com/search`（basic）；`limitSearchResults` 依上限截斷後注入系統提示。
- Edge `/api/chat` 以 `resolveSearch` 注入面板設定；沒有面板 Key 時退回 `JINA_API_KEY`／`TAVILY_API_KEY`。

## 4. 前端改動範圍（第二階段）

前端是單檔 `src/web_decoded.html`（約 31 萬字元），localStorage 鍵約 30 個。策略：**伺服器為主、localStorage 只當快取與離線暫存**，新增一個 `api` 小模組集中所有請求。

| 現有 localStorage | 改成 |
|---|---|
| `ta_providers_v1`、`ta_provider_active` | `/api/providers`（Key 不再存瀏覽器）；目前供應商存 `settings.active_provider_id` |
| `ta_custom_key`（原 fork 的 Groq BYOK） | 已移除（欄位、`x-groq-user-key` 標頭與相關文案都刪除；啟動時清掉舊值） |
| `ta_model` | `settings.active_model_id`（搭配 `active_provider_id`；沒有預設值） |
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
- 模型選單（已完成）：改讀 `/api/models/grouped`，以 `<optgroup>`／分組標題呈現每個供應商（環境變數 `env-N` 與面板供應商）各自的聊天模型，沒有內建組；選取值為 `provider_id + model_id`。前端不再內建任何模型清單（`MODELS` 只用於舊的瀏覽器保存 Key 模式）。
- 供應商設定頁：聊天模型與嵌入模型分兩個欄位；環境變數供應商以「（環境變數）」標示，欄位唯讀、儲存與刪除停用，並顯示「由環境變數管理」。

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
| 3 檔案 | Neon Object Storage bucket＋CORS、presigned 上傳、pdf.js／mammoth 抽文字、專案檔案 | **完成（本機）**；bucket 與 CORS 部署時建立 |
| 4 技能與 Memory | 設定頁、技能注入系統提示（always／keyword／手動）、對話後建議寫入 Memory（需使用者確認） | **完成（本機）** |
| 5 強化 | pgvector 混合檢索、金鑰重加密腳本、匯出備份 | **完成（本機）** |

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
