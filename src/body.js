import { MAX_BODY_BYTES } from './config.js'

export function bodyTooLarge(request) {
  const length = Number(request.headers.get('content-length') || 0)
  return Number.isFinite(length) && length > MAX_BODY_BYTES
}

export async function readJsonBody(request) {
  if (bodyTooLarge(request)) throw new Error('PAYLOAD_TOO_LARGE')
  const contentType = request.headers.get('content-type') || ''
  if (!/application\/json/i.test(contentType)) throw new Error('UNSUPPORTED_MEDIA_TYPE')
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE')
  let data
  try { data = JSON.parse(text) } catch { throw new Error('INVALID_JSON') }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_JSON')
  return data
}

export async function readFormBody(request) {
  if (bodyTooLarge(request)) throw new Error('PAYLOAD_TOO_LARGE')
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE')
  return new URLSearchParams(text)
}

export function bodyErrorMessage(err) {
  if (!err) return '請求無效'
  if (err.message === 'PAYLOAD_TOO_LARGE') return '請求內容過大'
  if (err.message === 'UNSUPPORTED_MEDIA_TYPE') return '請使用 application/json'
  return 'JSON 格式不正確'
}