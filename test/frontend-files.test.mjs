// 前端檔案流程（jsdom）：實際打包的 app.js + 真正的 router + PGlite + 假物件儲存。
// 抽文字使用真的 pdf.js（含中文 CMap）與 mammoth。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { searchDocuments } from '../src/repo/entities.js'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(50) }
  throw new Error('timeout waiting for condition')
}

test('frontend files: upload PDF (CJK) / DOCX / scanned PDF, knowledge search, delete', async () => {
  const pg = new PGlite({ extensions: { pg_trgm } })
  await pg.exec(read('db/migrations/0001_init.sql'))
  const db = {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
  const objects = new Map()
  const puts = []
  const storage = {
    kind: 'memory',
    uploadUrl: async (key) => ({ method: 'PUT', url: `https://store.example/${encodeURIComponent(key)}` }),
    downloadUrl: async (key) => `https://store.example/${encodeURIComponent(key)}?dl=1`,
    head: async (key) => (objects.has(key) ? { size: objects.get(key) } : null),
    remove: async (key) => { objects.delete(key) },
  }
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 5).toString('base64'), __db: db, __storage: storage }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`

  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  w.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'https://example.com/')
    const headers = new Headers(init.headers || {})
    headers.set('cookie', cookie)
    if (init.method && init.method !== 'GET') headers.set('origin', 'https://example.com')
    const res = await app.fetch(new Request(url, { method: init.method || 'GET', headers, body: init.body }), env)
    return new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers })
  }
  // 假 XHR：模擬瀏覽器直傳物件儲存
  w.XMLHttpRequest = class {
    constructor() { this.upload = {}; this.headers = {} }
    open(method, url) { this.method = method; this.url = url }
    setRequestHeader(k, v) { this.headers[k] = v }
    send(file) {
      const key = decodeURIComponent(new URL(this.url).pathname.slice(1))
      puts.push({ key, type: this.headers['Content-Type'], size: file.size })
      setTimeout(() => {
        objects.set(key, file.size)
        if (this.upload.onprogress) this.upload.onprogress({ lengthComputable: true, loaded: file.size, total: file.size })
        this.status = 200
        this.onload()
      }, 5)
    }
  }
  Object.assign(w, {
    TextDecoder, TextEncoder, ReadableStream,
    matchMedia: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
    scrollTo: () => {}, marked: { parse: (t) => String(t), setOptions() {}, use() {} },
    confirm: () => true, open: () => null,
  })
  w.HTMLElement.prototype.scrollIntoView = function () {}
  // jsdom 的 Blob 沒有 text()/arrayBuffer()（瀏覽器都有），用 FileReader 補上
  const readAs = (blob, how) => new Promise((resolve, reject) => {
    const r = new w.FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r[how](blob)
  })
  w.Blob.prototype.arrayBuffer = function () { return readAs(this, 'readAsArrayBuffer') }
  w.Blob.prototype.text = function () { return readAs(this, 'readAsText') }
  w.HTMLElement.prototype.scrollTo = function () {}
  // 真的 pdf.js（Node 版）＋ 自架的 cmaps；真的 mammoth 瀏覽器版
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  w.__TA_PDFJS = pdfjs
  w.__TA_PDFJS_BASE = path.join(root, 'public/assets/vendor/pdfjs-4.10.38') + '/'
  w.eval(read('public/assets/vendor/mammoth-1.8.0.min.js'))
  assert.equal(typeof w.mammoth.extractRawText, 'function')

  for (const f of ['public/assets/i18n.js', 'public/assets/app.js', 'public/assets/prompts.js']) if (fs.existsSync(path.join(root, f))) w.eval(read(f))
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'))
  await waitFor(() => w.document.getElementById('server-files-wrap') && w.document.getElementById('sync-status').textContent.includes('同步'))

  const fixture = (name, type) => new w.File([fs.readFileSync(path.join(root, 'test/fixtures', name))], name, { type })
  const input = w.document.getElementById('import-rag-file')
  Object.defineProperty(input, 'files', { value: [fixture('cjk.pdf', 'application/pdf'), fixture('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), fixture('scan.pdf', 'application/pdf')], configurable: true })
  input.dispatchEvent(new w.Event('change'))

  const status = await waitFor(() => { const t = w.document.getElementById('files-status').textContent; return /上傳完成/.test(t) ? t : null }, 30000)
  assert.match(status, /上傳完成 3\/3/)
  assert.match(status, /scan\.pdf：沒有可抽取的文字/)
  assert.equal(puts.length, 3)
  assert.equal(puts[0].type, 'application/pdf')

  const files = await db.query('SELECT filename, status, error FROM files ORDER BY created_at')
  assert.deepEqual(files.map((f) => [f.filename, f.status]), [['cjk.pdf', 'extracted'], ['notes.docx', 'extracted'], ['scan.pdf', 'uploaded']])
  assert.equal(files[2].error, 'no_text_layer')
  // 中文 PDF（CID 字型）經 CMap 正確抽出，且能被檢索
  const pdfDoc = (await db.query(`SELECT content FROM documents WHERE title = 'cjk'`))[0].content
  assert.match(pdfDoc, /京都嵐山竹林旅遊筆記/)
  assert.match(pdfDoc, /伏見稻荷大社/)
  assert.match((await searchDocuments(db, '伏見稻荷'))[0].title, /cjk/)
  assert.match((await searchDocuments(db, '預算核准'))[0].title, /notes/)

  // 前端清單：知識庫顯示「檔案」標記、檔案區 3 筆
  await waitFor(() => w.document.querySelectorAll('#server-files-box .server-file-row').length === 3)
  const docs = JSON.parse(w.localStorage.getItem('ta_documents'))
  assert.equal(docs.filter((d) => d.fileId).length, 2)
  assert.ok(w.document.getElementById('knowledge-list-box').textContent.includes('檔案'))

  // 刪除 DOCX → 物件、文件都刪除；本機快取同步移除
  const docxId = (await db.query(`SELECT id FROM files WHERE filename = 'notes.docx'`))[0].id
  w.document.querySelector(`[data-file-del="${docxId}"]`).click()
  await waitFor(async () => (await searchDocuments(db, '預算核准')).length === 0)
  await waitFor(() => JSON.parse(w.localStorage.getItem('ta_documents')).filter((d) => d.fileId).length === 1)
  assert.equal([...objects.keys()].some((k) => k.endsWith('notes.docx')), false)
  // 檔案文件不會被前端回寫（本機只有前 3000 字）
  await sleep(1800)
  assert.match((await db.query(`SELECT content FROM documents WHERE title = 'cjk'`))[0].content, /伏見稻荷大社/)
  w.close()
})
