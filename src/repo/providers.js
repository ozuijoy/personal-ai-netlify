import { decryptSecret, encryptSecret, keyHint, keyring } from '../crypto.js'
import {
  NO_PROVIDER_MESSAGE, envProvider, envProviders, isEnvProviderId, normalizeBaseUrl, providerFromBody, publicEnvProvider, scanEnvProviders,
} from '../providers.js'

export const OWNER = 'owner'
export const MODEL_KINDS = ['chat', 'embed']

function envReadonlyError() {
  const err = new Error('此供應商由環境變數管理，請到部署平台修改 PROVIDER_N_* 變數')
  err.status = 403
  err.code = 'env_provider_readonly'
  return err
}

const aadFor = (ownerId, id) => `provider:${ownerId}:${id}`

function publicProvider(row, models = [], embedModels = []) {
  return {
    id: row.id,
    name: row.name,
    base_url: row.base_url,
    has_key: !!row.api_key_enc,
    api_key_hint: row.api_key_hint || '',
    enabled: row.enabled,
    sort_order: row.sort_order,
    source: 'db',
    readonly: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    models,
    embed_models: embedModels,
  }
}

function cleanName(name) {
  const text = String(name || '').trim().slice(0, 100)
  return text || '供應商'
}

function cleanModels(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const item of list.slice(0, 500)) {
    const id = String(typeof item === 'string' ? item : item && (item.model_id || item.id) || '').trim()
    if (!id || id.length > 200 || seen.has(id)) continue
    seen.add(id)
    out.push({
      model_id: id,
      display_name: typeof item === 'object' && item.display_name ? String(item.display_name).slice(0, 200) : null,
      enabled: typeof item === 'object' && item.enabled === false ? false : true,
    })
  }
  return out
}

/** 資料庫（設定面板）供應商；不含環境變數供應商。 */
export async function listDbProviders(db, ownerId = OWNER) {
  const rows = await db.query(
    `SELECT * FROM providers WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY sort_order, created_at`,
    [ownerId],
  )
  const models = rows.length
    ? await db.query(
      `SELECT provider_id, kind, model_id, display_name, enabled, sort_order FROM provider_models
        WHERE provider_id = ANY($1::text[]) ORDER BY sort_order, model_id`,
      [rows.map((r) => r.id)],
    )
    : []
  const chat = new Map()
  const embed = new Map()
  for (const m of models) {
    const map = m.kind === 'embed' ? embed : chat
    if (!map.has(m.provider_id)) map.set(m.provider_id, [])
    map.get(m.provider_id).push({ model_id: m.model_id, display_name: m.display_name, enabled: m.enabled, sort_order: m.sort_order })
  }
  return rows.map((r) => publicProvider(r, chat.get(r.id) || [], embed.get(r.id) || []))
}

/** 全部供應商：環境變數（env-N，唯讀）在前，資料庫供應商在後。 */
export async function listProviders(db, env, ownerId = OWNER) {
  const fromEnv = envProviders(env).map(publicEnvProvider)
  const fromDb = db ? await listDbProviders(db, ownerId) : []
  return [...fromEnv, ...fromDb]
}

/** 環境變數設定錯誤（只含編號與原因，不含 Key），顯示在設定面板。 */
export function envProviderErrors(env) {
  return scanEnvProviders(env).errors
}

/** 聊天模型選單：依供應商分組，只列啟用的供應商與「聊天」模型（嵌入模型不出現）。 */
export async function groupedModels(db, env, ownerId = OWNER) {
  const providers = await listProviders(db, env, ownerId)
  return providers
    .filter((p) => p.enabled !== false)
    // 只有嵌入模型的供應商（例如只設 PROVIDER_N_EMBED_MODELS）不出現在聊天選單
    .filter((p) => p.models.length || (p.source === 'db' && !p.embed_models.length))
    .map((p) => ({
      provider: { id: p.id, name: p.name, source: p.source, readonly: !!p.readonly, has_key: p.has_key },
      models: (p.models || []).filter((m) => m.enabled !== false).map((m) => ({ id: m.model_id, name: m.display_name || m.model_id })),
    }))
}

/** 嵌入模型選項：每個供應商只列「嵌入」模型（聊天模型不出現）；前端另可自由輸入。 */
export async function embeddingModelOptions(db, env, ownerId = OWNER) {
  const providers = await listProviders(db, env, ownerId)
  return providers
    .filter((p) => p.enabled !== false)
    .map((p) => ({
      provider: { id: p.id, name: p.name, source: p.source, readonly: !!p.readonly },
      models: (p.embed_models || []).filter((m) => m.enabled !== false).map((m) => m.model_id),
    }))
}

export async function createProvider(db, env, input, ownerId = OWNER) {
  const baseUrl = normalizeBaseUrl(input.base_url || input.baseUrl)
  const id = input.id && /^[A-Za-z0-9_-]{1,64}$/.test(input.id) && !isEnvProviderId(input.id) ? input.id : crypto.randomUUID()
  const apiKey = String(input.api_key ?? input.apiKey ?? '').trim()
  let enc = null
  if (apiKey) enc = await encryptSecret(apiKey, aadFor(ownerId, id), env)
  const models = cleanModels(input.models || (input.model ? [input.model] : []))
  const embedModels = cleanModels(input.embed_models || [])
  const statements = [[
    `INSERT INTO providers (id, owner_id, name, base_url, api_key_enc, api_key_hint, key_version, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE((SELECT max(sort_order) + 1 FROM providers WHERE owner_id = $2), 0))`,
    [id, ownerId, cleanName(input.name), baseUrl, enc ? enc.value : null, apiKey ? keyHint(apiKey) : null, enc ? enc.version : null],
  ]]
  statements.push(...insertModelStatements(id, models, 'chat'), ...insertModelStatements(id, embedModels, 'embed'))
  await db.tx(statements)
  return getProvider(db, env, id, ownerId)
}

export async function getProvider(db, env, id, ownerId = OWNER) {
  const list = isEnvProviderId(id) ? envProviders(env).map(publicEnvProvider) : await listDbProviders(db, ownerId)
  return list.find((p) => p.id === id) || null
}

/**
 * 更新供應商。api_key 規則：
 *   - 欄位不存在 → 保留原 Key
 *   - 空字串 / null 且 clear_key: true → 清除 Key（改成無 Key 供應商）
 *   - 非空字串 → 重新加密覆蓋
 */
export async function updateProvider(db, env, id, input, ownerId = OWNER) {
  if (isEnvProviderId(id)) throw envReadonlyError()
  const row = (await db.query(`SELECT * FROM providers WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId]))[0]
  if (!row) return null
  const sets = []
  const params = [id, ownerId]
  const push = (col, value) => { params.push(value); sets.push(`${col} = $${params.length}`) }
  if ('name' in input) push('name', cleanName(input.name))
  if ('base_url' in input || 'baseUrl' in input) push('base_url', normalizeBaseUrl(input.base_url || input.baseUrl))
  if ('enabled' in input) push('enabled', !!input.enabled)
  if ('sort_order' in input) push('sort_order', Number.parseInt(input.sort_order, 10) || 0)
  const keyGiven = 'api_key' in input || 'apiKey' in input
  if (keyGiven) {
    const apiKey = String(input.api_key ?? input.apiKey ?? '').trim()
    if (apiKey) {
      const enc = await encryptSecret(apiKey, aadFor(ownerId, id), env)
      push('api_key_enc', enc.value); push('api_key_hint', keyHint(apiKey)); push('key_version', enc.version)
    } else if (input.clear_key) {
      push('api_key_enc', null); push('api_key_hint', null); push('key_version', null)
    }
  }
  const statements = []
  if (sets.length) statements.push([`UPDATE providers SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND owner_id = $2`, params])
  if (Array.isArray(input.models)) statements.push(...modelStatements(id, input.models, 'chat'))
  if (Array.isArray(input.embed_models)) statements.push(...modelStatements(id, input.embed_models, 'embed'))
  if (statements.length) await db.tx(statements)
  return getProvider(db, env, id, ownerId)
}

function insertModelStatements(providerId, models, kind) {
  return models.map((m, i) => [
    `INSERT INTO provider_models (provider_id, kind, model_id, display_name, enabled, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
    [providerId, kind, m.model_id, m.display_name, m.enabled, i],
  ])
}

function modelStatements(providerId, list, kind = 'chat') {
  if (!MODEL_KINDS.includes(kind)) throw new Error('模型種類不正確')
  return [
    [`DELETE FROM provider_models WHERE provider_id = $1 AND kind = $2`, [providerId, kind]],
    ...insertModelStatements(providerId, cleanModels(list), kind),
  ]
}

/** 覆寫模型清單。models → 聊天模型、embed_models → 嵌入模型；沒給的那一類不變。 */
export async function setProviderModels(db, env, id, input, ownerId = OWNER) {
  if (isEnvProviderId(id)) throw envReadonlyError()
  const row = (await db.query(`SELECT id FROM providers WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId]))[0]
  if (!row) return null
  const lists = Array.isArray(input) ? { models: input } : (input || {})
  const statements = []
  if (Array.isArray(lists.models)) statements.push(...modelStatements(id, lists.models, 'chat'))
  if (Array.isArray(lists.embed_models)) statements.push(...modelStatements(id, lists.embed_models, 'embed'))
  if (statements.length) await db.tx(statements)
  return getProvider(db, env, id, ownerId)
}

export async function deleteProvider(db, id, ownerId = OWNER) {
  if (isEnvProviderId(id)) throw envReadonlyError()
  const rows = await db.query(
    `UPDATE providers SET deleted_at = now(), api_key_enc = NULL, api_key_hint = NULL, updated_at = now()
      WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id`,
    [id, ownerId],
  )
  return rows.length > 0
}

/** 伺服器內部用：取得可直接呼叫上游的 {baseUrl, apiKey}。絕不回傳給前端。 */
export async function providerCredentials(db, env, id, ownerId = OWNER) {
  if (isEnvProviderId(id)) {
    const p = envProvider(env, id)
    if (!p) throw new Error('找不到這個供應商（環境變數 PROVIDER_N_* 未設定或格式不正確）')
    return { baseUrl: p.base_url, apiKey: p.api_key }
  }
  if (!db) throw new Error('伺服器未設定 DATABASE_URL')
  const row = (await db.query(
    `SELECT id, base_url, api_key_enc, enabled FROM providers WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [id, ownerId],
  ))[0]
  if (!row) throw new Error('找不到這個供應商')
  if (!row.enabled) throw new Error('這個供應商已停用')
  const apiKey = row.api_key_enc ? await decryptSecret(row.api_key_enc, aadFor(ownerId, id), env) : ''
  return { baseUrl: normalizeBaseUrl(row.base_url), apiKey }
}

/**
 * 聊天用的供應商解析（沒有內建供應商）：
 *   1. body.provider_id + model（新前端）→ 環境變數供應商或查庫解密
 *   2. body.provider / baseUrl（舊前端，過渡期相容）→ providerFromBody
 *   3. 都沒有 → 設定面板選的預設模型（settings.active_provider_id + active_model_id）
 *   4. 仍沒有 → 錯誤「請先在設定中新增供應商並選擇模型」
 */
export async function resolveChatProvider(db, body, env, ownerId = OWNER) {
  let providerId = body && (body.provider_id || body.providerId)
  let model = String((body && (body.model || body.model_id)) || '').trim().slice(0, 200)
  const legacy = body && (typeof body.provider === 'object' && body.provider || body.baseUrl)
  if (!providerId && legacy) return providerFromBody(body)
  if (!providerId && db) {
    const rows = await db.query(
      `SELECT key, value FROM settings WHERE owner_id = $1 AND key IN ('active_provider_id', 'active_model_id')`, [ownerId])
    const s = Object.fromEntries(rows.map((r) => [r.key, typeof r.value === 'string' ? r.value : (r.value == null ? '' : String(r.value))]))
    if (s.active_provider_id && s.active_model_id) {
      providerId = s.active_provider_id
      model = String(s.active_model_id).trim().slice(0, 200)
    }
  }
  if (!providerId || !model) throw new Error(NO_PROVIDER_MESSAGE)
  const cred = await providerCredentials(db, env, String(providerId), ownerId)
  return { ...cred, model }
}

// ── 金鑰輪替（第五階段）──────────────────────────────────────
// 步驟：1) 新金鑰放 ENCRYPTION_KEY、KEY_VERSION 改新版本；舊金鑰放 ENCRYPTION_KEY_PREVIOUS、KEY_VERSION_PREVIOUS。
//       2) 部署後執行重新加密（設定頁按鈕或 npm run db:rekey）。3) keyStatus 顯示全部為新版本後，移除 PREVIOUS 變數。
export async function keyStatus(db, env, ownerId = OWNER) {
  const { current, ring } = keyring(env)
  const rows = await db.query(
    `SELECT COALESCE(key_version, split_part(api_key_enc, '.', 1)) AS version, count(*)::int AS n
       FROM providers WHERE owner_id = $1 AND deleted_at IS NULL AND api_key_enc IS NOT NULL GROUP BY 1 ORDER BY 1`, [ownerId])
  const versions = Object.fromEntries(rows.map((r) => [r.version, r.n]))
  const outdated = rows.filter((r) => r.version !== current).reduce((a, r) => a + r.n, 0)
  return {
    current, configured: !!ring[current], previous_configured: Object.keys(ring).length > 1,
    versions, outdated, unreadable: rows.filter((r) => !ring[r.version]).map((r) => r.version),
  }
}

export async function rekeyProviders(db, env, ownerId = OWNER) {
  const { current, ring } = keyring(env)
  if (!ring[current]) throw new Error('伺服器未設定 ENCRYPTION_KEY')
  const rows = await db.query(
    `SELECT id, api_key_enc FROM providers
      WHERE owner_id = $1 AND api_key_enc IS NOT NULL AND split_part(api_key_enc, '.', 1) <> $2`, [ownerId, current])
  const statements = []
  const failed = []
  for (const row of rows) {
    try {
      const plain = await decryptSecret(row.api_key_enc, aadFor(ownerId, row.id), env)
      const enc = await encryptSecret(plain, aadFor(ownerId, row.id), env)
      statements.push([
        `UPDATE providers SET api_key_enc = $1, key_version = $2 WHERE id = $3 AND owner_id = $4 AND api_key_enc = $5`,
        [enc.value, enc.version, row.id, ownerId, row.api_key_enc],
      ])
    } catch (err) {
      failed.push({ id: row.id, error: String(err.message || err).slice(0, 200) })
    }
  }
  if (statements.length) await db.tx(statements)
  return { rekeyed: statements.length, failed, current }
}
