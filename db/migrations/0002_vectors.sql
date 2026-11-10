-- 0002：語意檢索（pgvector）。
-- 欄位用不限維度的 vector，並記錄 embedding_model：換嵌入模型不必改 schema，查詢只比對同模型、同維度的向量。
-- 代價是不能建 HNSW／IVFFlat 索引（需固定維度）；個人知識庫規模（數萬塊以內）順序掃描即可。
-- 規模變大時再加：ALTER COLUMN embedding TYPE vector(<維度>) + CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)。
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE doc_chunks ADD COLUMN IF NOT EXISTS embedding vector;
ALTER TABLE doc_chunks ADD COLUMN IF NOT EXISTS embedding_model text;
CREATE INDEX IF NOT EXISTS doc_chunks_embedding_model_idx ON doc_chunks (owner_id, embedding_model);
