-- 0003：供應商模型分成「聊天」與「嵌入」兩類。
-- 聊天選單只列 kind = 'chat'；語意檢索的嵌入模型選單只列 kind = 'embed'。
-- 既有列一律視為聊天模型。同一個 model_id 可以同時是兩類（唯一鍵改成 provider_id + kind + model_id）。
ALTER TABLE provider_models ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'chat';
ALTER TABLE provider_models DROP CONSTRAINT IF EXISTS provider_models_kind_chk;
ALTER TABLE provider_models ADD CONSTRAINT provider_models_kind_chk CHECK (kind IN ('chat', 'embed'));
ALTER TABLE provider_models DROP CONSTRAINT IF EXISTS provider_models_provider_id_model_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS provider_models_provider_kind_model_key ON provider_models (provider_id, kind, model_id);
