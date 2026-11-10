// 物件儲存（S3 相容，預設 Neon Object Storage）。
// 只用 WebCrypto 自己做 AWS SigV4，不引入 AWS SDK（體積大、Edge/Function 冷啟動慢）。
// Neon 只支援 path-style：https://<endpoint>/<bucket>/<key>（官方：neon.com/docs/storage/s3-compatibility）。
//
// 環境變數（避開 AWS_* 名稱：Netlify Functions 跑在 AWS Lambda 上，AWS_REGION 等名稱可能被保留——推測，部署時確認）
//   STORAGE_ENDPOINT           例 https://br-xxx.storage.c-2.us-east-2.aws.neon.tech
//   STORAGE_REGION             例 us-east-2
//   STORAGE_BUCKET             例 personal-ai-files
//   STORAGE_ACCESS_KEY_ID      Neon credential 的 token_id（nak_live_…）
//   STORAGE_SECRET_ACCESS_KEY  Neon credential 的 s3_secret_access_key（nsk_live_…）
// 本機開發也接受 Neon CLI 產生的 AWS_ENDPOINT_URL_S3 / AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY。

const enc = new TextEncoder()

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(data) {
  return hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data))
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(data))
}
// RFC 3986：S3 要求除 unreserved 之外全部編碼；路徑中的 / 保留。
export function uriEncode(str, keepSlash = false) {
  let out = ''
  for (const ch of String(str)) {
    if (/[A-Za-z0-9\-._~]/.test(ch) || (keepSlash && ch === '/')) out += ch
    else for (const b of enc.encode(ch)) out += '%' + b.toString(16).toUpperCase().padStart(2, '0')
  }
  return out
}
function amzDate(d) {
  const iso = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return { full: iso, short: iso.slice(0, 8) }
}
async function signingKey(secret, short, region, service = 's3') {
  const kDate = await hmac('AWS4' + secret, short)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

export function storageConfig(env = {}) {
  const endpoint = env.STORAGE_ENDPOINT || env.AWS_ENDPOINT_URL_S3 || ''
  const cfg = {
    endpoint: endpoint.replace(/\/+$/, ''),
    region: env.STORAGE_REGION || env.AWS_REGION || 'us-east-2',
    bucket: env.STORAGE_BUCKET || '',
    accessKeyId: env.STORAGE_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || '',
  }
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) return null
  if (!/^https:\/\//.test(cfg.endpoint)) return null
  return cfg
}

/** 物件的 path-style URL（不含查詢字串）。 */
export function objectUrl(cfg, key, { pathStyle = true } = {}) {
  return pathStyle
    ? `${cfg.endpoint}/${uriEncode(cfg.bucket)}/${uriEncode(key, true)}`
    : `${cfg.endpoint}/${uriEncode(key, true)}`
}

/**
 * 產生 presigned URL（查詢字串簽章，UNSIGNED-PAYLOAD，只簽 host）。
 * extraQuery：例如 { 'response-content-disposition': 'attachment; filename=...' }
 */
export async function presign(cfg, { method, url, expires = 900, extraQuery = {}, now = new Date() }) {
  const u = new URL(url)
  const { full, short } = amzDate(now)
  const scope = `${short}/${cfg.region}/s3/aws4_request`
  const q = {
    ...extraQuery,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${scope}`,
    'X-Amz-Date': full,
    'X-Amz-Expires': String(Math.max(1, Math.min(604800, expires | 0))),
    'X-Amz-SignedHeaders': 'host',
  }
  const canonicalQuery = Object.keys(q).sort().map((k) => `${uriEncode(k)}=${uriEncode(q[k])}`).join('&')
  const canonicalRequest = [method, u.pathname, canonicalQuery, `host:${u.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', full, scope, await sha256Hex(canonicalRequest)].join('\n')
  const sig = hex(await hmac(await signingKey(cfg.secretAccessKey, short, cfg.region), stringToSign))
  return `${u.origin}${u.pathname}?${canonicalQuery}&X-Amz-Signature=${sig}`
}

/** 伺服器端直接呼叫 S3（標頭簽章），用於 HEAD / DELETE / PutBucketCors。 */
export async function signedFetch(cfg, { method, url, body = '', headers = {}, fetchImpl = fetch, now = new Date() }) {
  const u = new URL(url)
  const { full, short } = amzDate(now)
  const scope = `${short}/${cfg.region}/s3/aws4_request`
  const payloadHash = await sha256Hex(body)
  const h = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': full }
  const names = Object.keys(h).sort()
  const canonicalQuery = [...u.searchParams.entries()].sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`).join('&')
  const canonicalRequest = [method, u.pathname, canonicalQuery, names.map((n) => `${n}:${h[n]}\n`).join(''), names.join(';'), payloadHash].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', full, scope, await sha256Hex(canonicalRequest)].join('\n')
  const sig = hex(await hmac(await signingKey(cfg.secretAccessKey, short, cfg.region), stringToSign))
  const reqHeaders = { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}` }
  delete reqHeaders.host
  return fetchImpl(url, { method, headers: reqHeaders, body: method === 'GET' || method === 'HEAD' ? undefined : body })
}

/** storage 介面：之後要換 Netlify Blobs 或其他 S3 服務，只要換這個物件。 */
export function createStorage(env = {}, { fetchImpl } = {}) {
  if (env.__storage) return env.__storage // 測試注入
  const cfg = storageConfig(env)
  if (!cfg) return null
  const f = fetchImpl || ((...a) => fetch(...a))
  return {
    kind: 's3',
    async uploadUrl(key, { expires = 900 } = {}) {
      return { method: 'PUT', url: await presign(cfg, { method: 'PUT', url: objectUrl(cfg, key), expires }) }
    },
    async downloadUrl(key, { filename, mime, expires = 300, inline = false } = {}) {
      const extraQuery = {}
      if (filename) extraQuery['response-content-disposition'] = `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${uriEncode(filename)}`
      if (mime) extraQuery['response-content-type'] = mime
      return presign(cfg, { method: 'GET', url: objectUrl(cfg, key), expires, extraQuery })
    },
    async head(key) {
      const res = await signedFetch(cfg, { method: 'HEAD', url: objectUrl(cfg, key), fetchImpl: f })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`storage HEAD ${res.status}`)
      return { size: Number(res.headers.get('content-length') || 0), contentType: res.headers.get('content-type') || '' }
    },
    async remove(key) {
      const res = await signedFetch(cfg, { method: 'DELETE', url: objectUrl(cfg, key), fetchImpl: f })
      if (!res.ok && res.status !== 404) throw new Error(`storage DELETE ${res.status}`)
      return true
    },
    config: { endpoint: cfg.endpoint, bucket: cfg.bucket, region: cfg.region },
    _cfg: cfg,
  }
}
