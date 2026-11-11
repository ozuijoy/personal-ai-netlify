// 物件儲存（SigV4）與檔案流程。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { presign, signedFetch, createStorage, objectUrl, uriEncode } from '../src/storage.js'
import { safeFilename } from '../src/repo/files.js'
import { shellCsp } from '../src/security.js'
import { searchDocuments } from '../src/repo/entities.js'

const AWS = { region: 'us-east-1', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' }
const T0 = new Date(Date.UTC(2013, 4, 24, 0, 0, 0))

test('SigV4 presigned URL matches the AWS documentation example', async () => {
  // docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
  const url = await presign(AWS, { method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', expires: 86400, now: T0 })
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/)
})

test('SigV4 header signing matches the AWS GET Object example', async () => {
  // docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
  let seen
  await signedFetch(AWS, {
    method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { Range: 'bytes=0-9' }, now: T0,
    fetchImpl: async (u, init) => { seen = init; return new Response('') },
  })
  assert.match(seen.headers.authorization, /SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/)
})

test('path-style object URLs and filename safety', () => {
  const cfg = { endpoint: 'https://br-x.storage.c-2.us-east-2.aws.neon.tech', bucket: 'files' }
  assert.equal(objectUrl(cfg, 'owner/2026/11/id/報告 v1.pdf'), 'https://br-x.storage.c-2.us-east-2.aws.neon.tech/files/owner/2026/11/id/%E5%A0%B1%E5%91%8A%20v1.pdf')
  assert.equal(uriEncode('a b/c', false), 'a%20b%2Fc')
  assert.equal(safeFilename('../../etc/passwd'), '_.._etc_passwd')
  assert.equal(safeFilename('  旅遊 筆記.docx '), '旅遊 筆記.docx')
  assert.equal(createStorage({ STORAGE_ENDPOINT: 'http://insecure', STORAGE_BUCKET: 'b', STORAGE_ACCESS_KEY_ID: 'a', STORAGE_SECRET_ACCESS_KEY: 's' }), null)
  assert.match(shellCsp('n', { STORAGE_ENDPOINT: 'https://br-x.storage.c-2.us-east-2.aws.neon.tech/' }), /connect-src 'self' https:\/\/br-x\.storage\.c-2\.us-east-2\.aws\.neon\.tech;/)
  assert.match(shellCsp('n', {}), /connect-src 'self';/)
  assert.ok(createStorage({ STORAGE_ENDPOINT: 'https://x', STORAGE_BUCKET: 'b', STORAGE_ACCESS_KEY_ID: 'a', STORAGE_SECRET_ACCESS_KEY: 's' }))
})

test('file upload → complete → knowledge search → download → delete', async () => {
  const pg = new PGlite({ extensions: { pg_trgm } })
  await pg.exec(fs.readFileSync(new URL('../db/migrations/0001_init.sql', import.meta.url), 'utf8'))
  await pg.exec(fs.readFileSync(new URL('../db/migrations/0003_model_kinds.sql', import.meta.url), 'utf8'))
  const db = {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
  const objects = new Map()
  const removed = []
  const fakeStorage = {
    kind: 'memory',
    uploadUrl: async (key) => ({ method: 'PUT', url: `https://store.example/${encodeURIComponent(key)}?sig=1` }),
    downloadUrl: async (key, o) => `https://store.example/${encodeURIComponent(key)}?dl=${o.inline ? 'inline' : 'attachment'}`,
    head: async (key) => (objects.has(key) ? { size: objects.get(key), contentType: 'application/pdf' } : null),
    remove: async (key) => { removed.push(key); objects.delete(key) },
  }
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'), __db: db, __storage: fakeStorage, MAX_UPLOAD_MB: '25' }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const call = async (method, path, body) => {
    const headers = { cookie }
    if (body !== undefined) { headers['content-type'] = 'application/json'; headers.origin = 'https://example.com' }
    if (method !== 'GET') headers.origin = 'https://example.com'
    const res = await app.fetch(new Request('https://example.com' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env)
    return { status: res.status, data: await res.json() }
  }

  const me = await call('GET', '/api/me')
  assert.equal(me.data.config.files, true)
  assert.equal(me.data.config.max_upload_mb, 25)

  // 超過上限 → 400
  assert.equal((await call('POST', '/api/files', { filename: 'big.pdf', mime: 'application/pdf', size: 26 * 1048576 })).status, 400)

  const created = await call('POST', '/api/files', { filename: '京都 旅遊.pdf', mime: 'application/pdf', size: 12345 })
  assert.equal(created.status, 201)
  const file = created.data.file
  assert.equal(file.status, 'pending')
  assert.equal(created.data.upload.method, 'PUT')
  assert.equal(created.data.upload.headers['Content-Type'], 'application/pdf')
  assert.equal(file.storage_key, undefined) // 不外洩內部鍵
  // 尚未上傳 → complete 失敗
  assert.equal((await call('POST', `/api/files/${file.id}/complete`, { text: 'x', extract: 'ok' })).status, 400)
  // pending 不出現在列表
  assert.equal((await call('GET', '/api/files')).data.files.length, 0)

  const key = (await db.query('SELECT storage_key FROM files WHERE id = $1', [file.id]))[0].storage_key
  assert.match(key, /^owner\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/京都 旅遊\.pdf$/)
  objects.set(key, 12345)
  const done = await call('POST', `/api/files/${file.id}/complete`, { text: '第一天去嵐山竹林，第二天去伏見稻荷。', extract: 'ok', pages: 2 })
  assert.equal(done.status, 200)
  assert.equal(done.data.file.status, 'extracted')
  assert.ok(done.data.document_id)
  const hits = await searchDocuments(db, '嵐山竹林')
  assert.equal(hits[0].document_id || hits[0].id ? true : false, true)
  assert.match(hits[0].title, /京都 旅遊/)
  const list = (await call('GET', '/api/files')).data.files
  assert.equal(list.length, 1)
  assert.equal(list[0].document_id, done.data.document_id)
  assert.match((await call('GET', `/api/files/${file.id}/download?inline=1`)).data.url, /dl=inline/)

  // 掃描型 PDF（無文字層）→ uploaded + no_text_layer
  const f2 = (await call('POST', '/api/files', { filename: 'scan.pdf', mime: 'application/pdf', size: 10 })).data.file
  objects.set((await db.query('SELECT storage_key FROM files WHERE id = $1', [f2.id]))[0].storage_key, 10)
  const d2 = await call('POST', `/api/files/${f2.id}/complete`, { extract: 'none' })
  assert.equal(d2.data.file.status, 'uploaded')
  assert.equal(d2.data.file.error, 'no_text_layer')

  // 實際大小超過上限（presigned PUT 無法限制）→ 刪除物件
  const f3 = (await call('POST', '/api/files', { filename: 'liar.bin', size: 10 })).data.file
  const k3 = (await db.query('SELECT storage_key FROM files WHERE id = $1', [f3.id]))[0].storage_key
  objects.set(k3, 30 * 1048576)
  assert.equal((await call('POST', `/api/files/${f3.id}/complete`, {})).status, 400)
  assert.ok(removed.includes(k3))

  // 刪除 → 物件移除、文件軟刪除、不再被檢索
  assert.equal((await call('DELETE', `/api/files/${file.id}`)).status, 200)
  assert.ok(removed.includes(key))
  assert.equal((await searchDocuments(db, '嵐山竹林')).length, 0)

  // 專案檔案：project_id 帶到檔案與知識庫文件；不存在的專案 → NULL
  await call('POST', '/api/projects', { id: 'p_site', name: '網站' })
  const pf = (await call('POST', '/api/files', { filename: 'spec.txt', mime: 'text/plain', size: 5, project_id: 'p_site' })).data.file
  assert.equal(pf.project_id, 'p_site')
  objects.set((await db.query('SELECT storage_key FROM files WHERE id = $1', [pf.id]))[0].storage_key, 5)
  const pd = await call('POST', `/api/files/${pf.id}/complete`, { text: '首頁要有搜尋列', extract: 'ok' })
  assert.equal((await db.query('SELECT project_id FROM documents WHERE id = $1', [pd.data.document_id]))[0].project_id, 'p_site')
  assert.equal((await call('GET', '/api/files?project_id=p_site')).data.files.length, 1)
  const ghost = (await call('POST', '/api/files', { filename: 'x.txt', size: 1, project_id: 'nope' })).data.file
  assert.equal(ghost.project_id, null)

  // 未設定物件儲存 → 503
  const env2 = { ...env, __storage: undefined }
  delete env2.__storage
  const res = await app.fetch(new Request('https://example.com/api/files', { method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: 'https://example.com' }, body: JSON.stringify({ filename: 'a.txt', size: 1 }) }), env2)
  assert.equal(res.status, 503)
})
