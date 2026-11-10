import { decryptSecret, encryptSecret, keyHint } from '../crypto.js'
import { BUILTIN_GROQ_ID, builtinProvider, normalizeBaseUrl, providerFromBody } from '../providers.js'

export const OWNER = 'owner'

const aadFor = (ownerId, id) => `provider:${ownerId}:${id}`

function publicProvider(row, models = []) {
  return {
    id: row.id,
    name: row.name,
    base_url: row.base_url,
    has_key: !!row.api_key_enc,
    api_key_hint: row.api_key_hint || '',
    enabled: row.enabled,
    sort_order: row.sort_order,
    builtin: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    models,
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

export async function listProviders(db, env, ownerId = OWNER) {
  const rows = await db.query(
    `SELECT * FROM providers WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY sort_order, created_at`,
    [ownerId],
  )
  const models = rows.length
    ? await db.query(
      `SELECT provider_id, model_id, display_name, enabled, sort_order FROM provider_models
        WHERE provider_id = ANY($1::text[]) ORDER BY sort_order, model_id`,
      [rows.map((r) => r.id)],
    )
    : []
  const byProvider = new Map()
  for (const m of models) {
    if (!byProvider.has(m.provider_id)) byProvider.set(m.provider_id, [])
    byProvider.get(m.provider_id).push({ model_id: m.model_id, display_name: m.display_name, enabled: m.enabled, sort_order: m.sort_order })
  }
  const list = rows.map((r) => publicProvider(r, byProvider.get(r.id) || []))
  const builtin = builtinProvider(env)
  return builtin ? [builtin, ...list] : list
}

/** 模型選單：依供應商分組，只列啟用的供應商與模型。 */
export async function groupedModels(db, env, ownerId = OWNER) {
  const providers = db ? await listProviders(db, env, ownerId) : (builtinProvider(env) ? [builtinProvider(env)] : [])
  return providers
    .filter((p) => p.enabled !== false)
    .map((p) => ({
      provider: { id: p.id, name: p.name, builtin: !!p.builtin, has_key: p.has_key },
      models: (p.models || []).filter((m) => m.enabled !== false).map((m) => ({ id: m.model_id, name: m.display_name || m.model_id })),
    }))
}

export async function createProvider(db, env, input, ownerId = OWNER) {
  const baseUrl = normalizeBaseUrl(input.base_url || input.baseUrl)
  const id = input.id && /^[A-Za-z0-9_-]{1,64}$/.test(input.id) && input.id !== BUILTIN_GROQ_ID ? input.id : crypto.randomUUID()
  const apiKey = String(input.api_key ?? input.apiKey ?? '').trim()
  let enc = null
  if (apiKey) enc = await encryptSecret(apiKey, aadFor(ownerId, id), env)
  const models = cleanModels(input.models || (input.model ? [input.model] : []))
  const statements = [[
    `INSERT INTO providers (id, owner_id, name, base_url, api_key_enc, api_key_hint, key_version, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE((SELECT max(sort_order) + 1 FROM providers WHERE owner_id = $2), 0))`,
    [id, ownerId, cleanName(input.name), baseUrl, enc ? enc.value : null, apiKey ? keyHint(apiKey) : null, enc ? enc.version : null],
  ]]
  models.forEach((m, i) => statements.push([
    `INSERT INTO provider_models (provider_id, model_id, display_name, enabled, sort_order) VALUES ($1, $2, $3, $4, $5)`,
    [id, m.model_id, m.display_name, m.enabled, i],
  ]))
  await db.tx(statements)
  return getProvider(db, env, id, ownerId)
}

export async function getProvider(db, env, id, ownerId = OWNER) {
  const list = await listProviders(db, env, ownerId)
  return list.find((p) => p.id === id) || null
}

/**
 * 更新供應商。api_key 規則：
 *   - 欄位不存在 → 保留原 Key
 *   - 空字串 / null 且 clear_key: true → 清除 Key（改成無 Key 供應商）
 *   - 非空字串 → 重新加密覆蓋
 */
export async function updateProvider(db, env, id, input, ownerId = OWNER) {
  if (id === BUILTIN_GROQ_ID) throw new Error('內建供應商由伺服器環境變數管理')
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
  if (Array.isArray(input.models)) statements.push(...modelStatements(id, input.models))
  if (statements.length) await db.tx(statements)
  return getProvider(db, env, id, ownerId)
}

function modelStatements(providerId, list) {
  const models = cleanModels(list)
  const st = [[`DELETE FROM provider_models WHERE provider_id = $1`, [providerId]]]
  models.forEach((m, i) => st.push([
    `INSERT INTO provider_models (provider_id, model_id, display_name, enabled, sort_order) VALUES ($1, $2, $3, $4, $5)`,
    [providerId, m.model_id, m.display_name, m.enabled, i],
  ]))
  return st
}

export async function setProviderModels(db, env, id, list, ownerId = OWNER) {
  const row = (await db.query(`SELECT id FROM providers WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId]))[0]
  if (!row) return null
  await db.tx(modelStatements(id, list))
  return getProvider(db, env, id, ownerId)
}

export async function deleteProvider(db, id, ownerId = OWNER) {
  const rows = await db.query(
    `UPDATE providers SET deleted_at = now(), api_key_enc = NULL, api_key_hint = NULL, updated_at = now()
      WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id`,
    [id, ownerId],
  )
  return rows.length > 0
}

/** 伺服器內部用：取得可直接呼叫上游的 {baseUrl, apiKey}。絕不回傳給前端。 */
export async function providerCredentials(db, env, id, ownerId = OWNER) {
  if (id === BUILTIN_GROQ_ID) {
    const b = builtinProvider(env)
    if (!b) throw new Error('伺服器未設定 GROQ_API_KEY')
    return { baseUrl: b.base_url, apiKey: String(env.GROQ_API_KEY) }
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
 * 聊天用的供應商解析：
 *   1. body.provider_id（新前端）→ 查庫 + 解密
 *   2. body.provider / baseUrl（舊前端，過渡期相容）→ providerFromBody
 *   3. 都沒有 → 伺服器 Groq
 */
export async function resolveChatProvider(db, body, env, ownerId = OWNER) {
  const providerId = body && (body.provider_id || body.providerId)
  if (providerId) {
    const cred = await providerCredentials(db, env, String(providerId), ownerId)
    const model = String(body.model || body.model_id || '').trim().slice(0, 200)
    if (!model) throw new Error('請先選擇模型')
    return { ...cred, model }
  }
  return providerFromBody(body, env)
}
