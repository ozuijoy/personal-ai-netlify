import { appConfig, sessionCookieName } from './config.js'

const encoder = new TextEncoder()

function b64url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(text) {
  const padded = String(text).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(text).length + 3) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function timingSafeEqual(a, b) {
  const aa = typeof a === 'string' ? encoder.encode(a) : a
  const bb = typeof b === 'string' ? encoder.encode(b) : b
  if (aa.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i]
  return diff === 0
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

export function parseCookies(header) {
  const out = {}
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=')
    if (i < 1) continue
    const key = part.slice(0, i).trim()
    const value = part.slice(i + 1).trim()
    if (!key) continue
    try { out[key] = decodeURIComponent(value) } catch { out[key] = value }
  }
  return out
}

export function getSessionCookie(request) {
  return parseCookies(request.headers.get('cookie') || '')[sessionCookieName(request)] || ''
}

export async function createSession(env, days) {
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url(encoder.encode(JSON.stringify({
    sub: 'owner',
    v: 1,
    sv: String(env.SESSION_VERSION || '1'),
    iat: now,
    exp: now + Math.max(1, days) * 86400,
  })))
  const sig = b64url(await hmac(env.AUTH_SECRET, payload))
  return `${payload}.${sig}`
}

export async function verifySession(request, env) {
  const token = getSessionCookie(request)
  if (!token || !env.AUTH_SECRET) return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let expected = ''
  try { expected = b64url(await hmac(env.AUTH_SECRET, payload)) } catch { return null }
  if (!timingSafeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)))
    if (!data || data.sub !== 'owner' || data.v !== 1) return null
    // 改 SESSION_VERSION 環境變數即可讓所有既有登入失效（不需資料庫查詢）。
    if (String(data.sv || '1') !== String(env.SESSION_VERSION || '1')) return null
    if (!Number.isFinite(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null
    return data
  } catch {
    return null
  }
}

export function sessionCookie(request, token, maxAge) {
  const secure = new URL(request.url).protocol === 'https:'
  const name = sessionCookieName(request)
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:'
  const name = sessionCookieName(request)
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}

export async function passwordMatches(password, env) {
  if (!env.APP_PASSWORD || !env.AUTH_SECRET) return false
  const supplied = await sha256(`${String(password)}\n${env.AUTH_SECRET}`)
  const expected = await sha256(`${env.APP_PASSWORD}\n${env.AUTH_SECRET}`)
  return timingSafeEqual(supplied, expected)
}

export async function requireAuth(request, env) {
  const session = await verifySession(request, env)
  if (!session) return null
  const cfg = appConfig(env)
  if (!cfg.hasPassword || !cfg.hasAuthSecret) return null
  return { name: 'Owner', ...session }
}