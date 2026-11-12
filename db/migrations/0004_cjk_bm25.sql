-- 0004：知識庫中文斷詞 + BM25 排序（Neon Lakebase Search）。
-- 官方文件：https://neon.com/docs/extensions/lakebase-tokenizer 、https://neon.com/docs/extensions/lakebase-text
--   lakebase_tokenizer：內建 tokenizer_chinese 設定（Lindera + Jieba 詞典，mixed 模式），產生標準 tsvector。
--   lakebase_text：lakebase_bm25 索引，查詢用 <@> 運算子與 to_bm25query()；兩者都需 Postgres 16 以上。
-- 只在資料庫提供這兩個擴充套件時才建立；否則（例如本機 PGlite、PG 14/15、非 Neon）略過，
-- 應用程式會自動退回原本的二字組（bigram）檢索。可重跑。
DO $$
DECLARE
  tok_schema text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'lakebase_tokenizer')
     OR NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'lakebase_text') THEN
    RAISE NOTICE '0004：此資料庫沒有 lakebase_tokenizer / lakebase_text，略過；知識庫維持二字組檢索。';
    RETURN;
  END IF;

  CREATE SCHEMA IF NOT EXISTS tokenizer_ext;
  CREATE EXTENSION IF NOT EXISTS lakebase_tokenizer WITH SCHEMA tokenizer_ext;
  CREATE EXTENSION IF NOT EXISTS lakebase_text;

  -- 擴充套件若早已裝在別的 schema，就以它實際所在的 schema 為準。
  SELECT n.nspname INTO tok_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'lakebase_tokenizer';

  -- 應用程式固定用 public.pa_zh，不必知道擴充套件裝在哪個 schema。
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
                  WHERE c.cfgname = 'pa_zh' AND n.nspname = 'public') THEN
    EXECUTE format('CREATE TEXT SEARCH CONFIGURATION public.pa_zh (COPY = %I.tokenizer_chinese)', tok_schema);
  END IF;

  -- 既有段落在 ADD COLUMN 時一次算好；之後新增的段落自動產生。
  EXECUTE $q$ALTER TABLE doc_chunks ADD COLUMN IF NOT EXISTS tsv_zh tsvector
           GENERATED ALWAYS AS (to_tsvector('public.pa_zh'::regconfig, content)) STORED$q$;

  -- BM25 統計在建索引時計算、之後由 VACUUM 更新（官方建議資料表設 insert scale factor = 0）。
  EXECUTE 'CREATE INDEX IF NOT EXISTS doc_chunks_bm25 ON doc_chunks USING lakebase_bm25 (tsv_zh)';
  EXECUTE 'ALTER TABLE doc_chunks SET (autovacuum_vacuum_insert_scale_factor = 0)';
END $$;
