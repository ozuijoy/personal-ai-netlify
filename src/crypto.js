// API Key 伺服器端加密：AES-256-GCM（WebCrypto，Node 與 Deno/Edge 皆可用）。
//
// 金鑰：ENCRYPTION_KEY = base64 編碼的 32 bytes（npm run gen:key 產生），只放 Netlify 環境變數。
// 輪替：新金鑰放 ENCRYPTION_KEY，舊的放 ENCRYPTION_KEY_PREVIOUS；KEY_VERSION 標記目前版本。
// 格式："<version>.<iv base64url>.<ciphertext+tag base64url>"
// AAD：呼叫端傳入（例：`provider:<owner>:<id>`），密文被複製到別列時解密會失敗。

const enc = new TextEncoder()
const dec = new TextDecoder()

export function b64urlEncode(bytes) {
  let bin = ''
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(text) {
  const s = String(text).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '==='.slice((s.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function rawKey(b64) {
  if (!b64) return null
  let bytes
  try { bytes = b64urlDecode(String(b64).trim()) } catch { throw new Error('ENCRYPTION_KEY 不是有效的 base64') }
  if (bytes.length !== 32) throw new Error('ENCRYPTION_KEY 必須是 32 bytes（base64 約 44 字元）')
  return bytes
}

const keyCache = new Map()
async function importKey(b64) {
  if (keyCache.has(b64)) return keyCache.get(b64)
  const key = await crypto.subtle.importKey('raw', rawKey(b64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  keyCache.set(b64, key)
  return key
}

export function keyring(env = {}) {
  const current = String(env.KEY_VERSION || 'v1')
  const ring = {}
  if (env.ENCRYPTION_KEY) ring[current] = env.ENCRYPTION_KEY
  if (env.ENCRYPTION_KEY_PREVIOUS) {
    const prev = String(env.KEY_VERSION_PREVIOUS || 'v0')
    if (!ring[prev]) ring[prev] = env.ENCRYPTION_KEY_PREVIOUS
  }
  return { current, ring }
}

export function encryptionConfigured(env) {
  return !!env.ENCRYPTION_KEY
}

export async function encryptSecret(plaintext, aad, env) {
  const { current, ring } = keyring(env)
  if (!ring[current]) throw new Error('伺服器未設定 ENCRYPTION_KEY，無法儲存 API Key')
  const key = await importKey(ring[current])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(String(aad)), tagLength: 128 },
    key,
    enc.encode(String(plaintext)),
  )
  return { value: `${current}.${b64urlEncode(iv)}.${b64urlEncode(ct)}`, version: current }
}

export async function decryptSecret(token, aad, env) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw new Error('密文格式不正確')
  const [version, ivText, ctText] = parts
  const { ring } = keyring(env)
  if (!ring[version]) throw new Error(`找不到金鑰版本 ${version}`)
  const key = await importKey(ring[version])
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64urlDecode(ivText), additionalData: enc.encode(String(aad)), tagLength: 128 },
      key,
      b64urlDecode(ctText),
    )
    return dec.decode(pt)
  } catch {
    throw new Error('API Key 解密失敗（金鑰錯誤或資料被竄改）')
  }
}

export function keyHint(plaintext) {
  const s = String(plaintext || '')
  if (s.length < 8) return s ? '••••' : ''
  return `••••${s.slice(-4)}`
}

export async function sha256Hex(text) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(text))))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}
