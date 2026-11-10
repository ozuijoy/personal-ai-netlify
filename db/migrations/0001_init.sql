-- Personal AI (Netlify + Neon) schema v1
-- 單一擁有者部署，但每張表都帶 owner_id，日後可擴成多使用者。
-- 所有時間欄位用 timestamptz；客戶端時間戳（毫秒）只用於衝突判斷時另存 client_updated_at。
-- 軟刪除：deleted_at 不為 NULL 代表已刪除（方便多裝置傳播刪除、也方便救回）。

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- ── 供應商與模型 ─────────────────────────────────────────────
-- API Key 以 AES-256-GCM 在伺服器端加密：api_key_enc = "v1.<iv>.<ciphertext+tag>"（base64url），
-- AAD 綁定 owner_id + provider id，避免密文被搬到別列使用。api_key_hint 只存末 4 碼供 UI 顯示。
CREATE TABLE IF NOT EXISTS providers (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id      text NOT NULL DEFAULT 'owner',
  name          text NOT NULL,
  base_url      text NOT NULL,
  api_key_enc   text,                 -- NULL = 無 Key（自建 / 本地閘道等）
  api_key_hint  text,
  key_version   text,                 -- 加密金鑰版本，供金鑰輪替
  extra_headers jsonb NOT NULL DEFAULT '{}'::jsonb,  -- 保留：部分供應商需額外標頭（同樣不得含祕密）
  enabled       boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT providers_base_url_https CHECK (base_url ~* '^https://'),
  CONSTRAINT providers_name_len CHECK (char_length(name) BETWEEN 1 AND 100)
);
CREATE INDEX IF NOT EXISTS providers_owner_idx ON providers (owner_id, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS provider_models (
  id           bigserial PRIMARY KEY,
  provider_id  text NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id     text NOT NULL,
  display_name text,
  enabled      boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, model_id),
  CONSTRAINT provider_models_len CHECK (char_length(model_id) BETWEEN 1 AND 200)
);

-- ── 設定 / 個人資料 ─────────────────────────────────────────
-- settings：介面偏好、目前選擇的模型（active_model = {provider_id, model_id}）、自訂提示等，一鍵一列。
CREATE TABLE IF NOT EXISTS settings (
  owner_id   text NOT NULL DEFAULT 'owner',
  key        text NOT NULL,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, key),
  CONSTRAINT settings_key_fmt CHECK (key ~ '^[a-z][a-z0-9_.-]{0,63}$')
);

CREATE TABLE IF NOT EXISTS profiles (
  owner_id   text PRIMARY KEY DEFAULT 'owner',
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 專案 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id     text NOT NULL DEFAULT 'owner',
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  data         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 其他前端欄位（role、icon 等）
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects (owner_id, updated_at DESC) WHERE deleted_at IS NULL;

-- ── 對話與訊息 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id    text NOT NULL DEFAULT 'owner',
  project_id  text REFERENCES projects(id) ON DELETE SET NULL,
  title       text NOT NULL DEFAULT '',
  pinned      boolean NOT NULL DEFAULT false,
  archived    boolean NOT NULL DEFAULT false,
  provider_id text,
  model_id    text,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS conversations_owner_idx ON conversations (owner_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS conversations_project_idx ON conversations (project_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS messages (
  id              bigserial PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  seq             integer NOT NULL,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content         text NOT NULL DEFAULT '',
  sources         jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{file_id, name, mime}]，檔案本體在物件儲存
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- model、tokens、耗時等
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, seq)
);

-- ── 檔案（本體在物件儲存，這裡只放中繼資料）─────────────────
CREATE TABLE IF NOT EXISTS files (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id    text NOT NULL DEFAULT 'owner',
  project_id  text REFERENCES projects(id) ON DELETE SET NULL,
  filename    text NOT NULL,
  mime        text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes  bigint NOT NULL DEFAULT 0,
  sha256      text,
  storage_key text NOT NULL UNIQUE,      -- 例：owner/2026/11/<uuid>/<檔名>
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'extracted', 'failed')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS files_owner_idx ON files (owner_id, created_at DESC) WHERE deleted_at IS NULL;

-- ── 知識庫文件與切塊 ────────────────────────────────────────
-- documents：使用者筆記、從檔案抽出的全文、舊版 knowledge/documents 遷移結果。
CREATE TABLE IF NOT EXISTS documents (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id   text NOT NULL DEFAULT 'owner',
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  file_id    text REFERENCES files(id) ON DELETE SET NULL,
  title      text NOT NULL DEFAULT '',
  doc_type   text NOT NULL DEFAULT 'note',      -- note | file | knowledge | web
  content    text NOT NULL DEFAULT '',
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents (owner_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_title_trgm ON documents USING gin (title gin_trgm_ops);

-- 檢索單位。中文沒有空白斷詞，PostgreSQL 內建 tsvector 對中文效果差，
-- 第一版用 pg_trgm（三字元片段）做模糊比對；英文另有 'simple' tsvector。
-- 向量欄位（pgvector）待確定嵌入模型維度後於 0002 加入。
CREATE TABLE IF NOT EXISTS doc_chunks (
  id          bigserial PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  owner_id    text NOT NULL DEFAULT 'owner',
  chunk_index integer NOT NULL,
  content     text NOT NULL,
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS doc_chunks_trgm ON doc_chunks USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS doc_chunks_tsv ON doc_chunks USING gin (tsv);

-- ── 技能（新功能）───────────────────────────────────────────
-- 一個技能 = 名稱 + 說明 + 指示；啟用時依 trigger 決定何時注入系統提示。
CREATE TABLE IF NOT EXISTS skills (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id     text NOT NULL DEFAULT 'owner',
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  trigger_mode text NOT NULL DEFAULT 'manual' CHECK (trigger_mode IN ('always', 'manual', 'keyword')),
  keywords     text[] NOT NULL DEFAULT '{}',
  enabled      boolean NOT NULL DEFAULT true,
  data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS skills_owner_idx ON skills (owner_id, updated_at DESC) WHERE deleted_at IS NULL;

-- ── Memory（新功能）─────────────────────────────────────────
-- 每條一個事實或偏好；scope 為 global 或某專案。由使用者手動新增，或對話後經使用者確認寫入。
CREATE TABLE IF NOT EXISTS memories (
  id                     text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id               text NOT NULL DEFAULT 'owner',
  project_id             text REFERENCES projects(id) ON DELETE CASCADE,
  content                text NOT NULL,
  kind                   text NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact', 'preference', 'instruction', 'note')),
  pinned                 boolean NOT NULL DEFAULT false,
  source_conversation_id text REFERENCES conversations(id) ON DELETE SET NULL,
  data                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
CREATE INDEX IF NOT EXISTS memories_owner_idx ON memories (owner_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS memories_trgm ON memories USING gin (content gin_trgm_ops);

-- ── Prompt 庫（收藏 / 最近使用）──────────────────────────────
CREATE TABLE IF NOT EXISTS prompts (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id   text NOT NULL DEFAULT 'owner',
  kind       text NOT NULL DEFAULT 'favorite' CHECK (kind IN ('favorite', 'recent', 'template')),
  title      text NOT NULL DEFAULT '',
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ── 登入節流（Serverless 沒有共享記憶體，必須放資料庫）──────
CREATE TABLE IF NOT EXISTS login_attempts (
  client_key    text PRIMARY KEY,           -- IP 的 SHA-256，不存明文 IP
  failures      integer NOT NULL DEFAULT 0,
  first_at      timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);

-- ── 舊 D1 原始資料（遷移時原樣保存，方便核對與重跑）──────────
CREATE TABLE IF NOT EXISTS legacy_sync_items (
  owner_id    text NOT NULL,
  item_key    text NOT NULL,
  value       text,
  updated_at  bigint NOT NULL,
  deleted     boolean NOT NULL DEFAULT false,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, item_key)
);

INSERT INTO schema_migrations (version) VALUES ('0001_init') ON CONFLICT DO NOTHING;
