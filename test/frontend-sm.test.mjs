// 前端技能與記憶（jsdom）：實際打包的 app.js + 真正的 router（含 /api/chat 伺服器注入）+ PGlite。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(40) }
  throw new Error('timeout waiting for condition')
}

test('frontend skills & memory: manage, inject via server, suggest → confirm', async () => {
  const pg = new PGlite({ extensions: { pg_trgm } })
  await pg.exec(read('db/migrations/0001_init.sql'))
  const db = {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'), __db: db }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const serverCall = async (url, init = {}) => {
    const headers = new Headers(init.headers || {})
    headers.set('cookie', cookie)
    if (init.method && init.method !== 'GET') headers.set('origin', 'https://example.com')
    return app.fetch(new Request(new URL(url, 'https://example.com/'), { method: init.method || 'GET', headers, body: init.body }), env)
  }
  const prov = await (await serverCall('/api/providers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '自建', base_url: 'https://llm.example.com/v1', models: ['m1'] }) })).json()
  const pid = prov.provider.id

  // 上游模型（Node 端的 fetch）
  const upstreamCalls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    upstreamCalls.push(body)
    if (body.stream === false) {
      return Response.json({ choices: [{ message: { content: '{"memories":[{"content":"使用者是後端工程師","kind":"fact"},{"content":"使用者偏好條列式回答","kind":"preference"}]}' } }] })
    }
    return new Response('data: {"choices":[{"delta":{"content":"好的"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }

  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  try {
    w.fetch = async (input, init = {}) => {
      const res = await serverCall(typeof input === 'string' ? input : input.url, init)
      return new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers })
    }
    Object.assign(w, {
      TextDecoder, TextEncoder, ReadableStream, TA_GEO: {}, scrollTo: () => {}, confirm: () => true,
      matchMedia: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
      marked: { parse: (t) => String(t), setOptions() {}, use() {}, Renderer: function () {} },
    })
    w.HTMLElement.prototype.scrollIntoView = function () {}
    w.HTMLElement.prototype.scrollTo = function () {}
    for (const f of ['i18n/zh-TW.js', 'i18n.js', 'app.js', 'prompts.js']) {
      if (fs.existsSync(path.join(root, 'public/assets', f))) w.eval(read('public/assets/' + f))
    }
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'))
    w.dispatchEvent(new w.Event('load'))
    const $ = (id) => w.document.getElementById(id)
    await waitFor(() => w.document.querySelector(`[data-model="${pid}|m1"]`))

    // 1) 設定頁新增技能（手動）與記憶
    w.document.querySelector('[data-pane="pane-skills"]').click()
    await waitFor(() => $('skills-online').style.display !== 'none')
    $('skill-f-name').value = '程式審查'
    $('skill-f-instr').value = '列出 bug 與修正方式。'
    $('skill-f-trigger').value = 'manual'
    $('skill-f-save').click()
    await waitFor(() => w.document.querySelectorAll('#skills-list .sm-row').length === 1)
    // 關鍵字技能：沒有關鍵字 → 擋下
    $('skill-f-name').value = '翻譯'
    $('skill-f-instr').value = '翻成英文。'
    $('skill-f-trigger').value = 'keyword'
    $('skill-f-trigger').dispatchEvent(new w.Event('change'))
    assert.notEqual($('skill-f-keywords-row').style.display, 'none')
    $('skill-f-save').click()
    await waitFor(() => /關鍵字/.test($('skills-status').textContent))
    $('skill-f-keywords').value = '翻譯，translate'
    $('skill-f-save').click()
    await waitFor(() => w.document.querySelectorAll('#skills-list .sm-row').length === 2)
    const kw = (await db.query(`SELECT keywords FROM skills WHERE name = '翻譯'`))[0].keywords
    assert.deepEqual(kw, ['翻譯', 'translate'])

    w.document.querySelector('[data-pane="pane-memory"]').click()
    await waitFor(() => $('memory-online').style.display !== 'none')
    $('mem-f-content').value = '使用者叫阿明'
    $('mem-f-kind').value = 'fact'
    $('mem-f-save').click()
    await waitFor(() => w.document.querySelectorAll('#memory-list .sm-row').length === 1)
    w.document.querySelector('#memory-list [data-mem-pin]').click()
    await waitFor(async () => (await db.query('SELECT pinned FROM memories'))[0].pinned === true)

    // 2) 輸入框技能選單：只列手動與關鍵字技能
    const pill = await waitFor(() => (!$('skill-pill').hidden ? $('skill-pill') : null))
    assert.deepEqual([...pill.options].map((o) => o.textContent).sort(), ['技能：無', '技能：程式審查', '技能：翻譯'].sort())
    const reviewId = (await db.query(`SELECT id FROM skills WHERE name = '程式審查'`))[0].id
    pill.value = reviewId
    pill.dispatchEvent(new w.Event('change'))

    // 3) 送出：伺服器注入技能＋記憶；回覆後出現記憶建議
    w.document.querySelector(`[data-model="${pid}|m1"]`).click()
    const input = $('prompt-input')
    input.value = '我是後端工程師，以後請用條列回答'
    input.dispatchEvent(new w.Event('input', { bubbles: true }))
    $('send-btn').click()
    const chatCall = await waitFor(() => upstreamCalls.find((c) => c.stream === true))
    const sys = chatCall.messages[0].content
    assert.match(sys, /技能：程式審查[\s\S]*列出 bug/)
    assert.doesNotMatch(sys, /技能：翻譯/)
    assert.match(sys, /使用者叫阿明/)
    await waitFor(() => w.document.querySelector('.applied-skills'))
    assert.match(w.document.querySelector('.applied-skills').textContent, /程式審查/)
    const card = await waitFor(() => w.document.querySelector('.mem-suggest'))
    assert.equal(card.querySelectorAll('[data-mem-accept]').length, 2)
    // 建議本身不寫入
    assert.equal((await db.query('SELECT count(*)::int n FROM memories'))[0].n, 1)
    card.querySelector('[data-mem-accept="1"]').click()
    await waitFor(async () => (await db.query(`SELECT count(*)::int n FROM memories WHERE content = '使用者偏好條列式回答' AND kind = 'preference'`))[0].n === 1)
    card.querySelector('[data-mem-skip="0"]').click()
    assert.equal((await db.query('SELECT count(*)::int n FROM memories'))[0].n, 2)
    assert.match(card.textContent, /已記住：使用者偏好條列式回答/)

    // 4) 關閉記憶 → 下一則不帶記憶、不再建議；設定同步到伺服器
    w.document.querySelector('[data-pane="pane-memory"]').click()
    await waitFor(() => w.document.querySelectorAll('#memory-list .sm-row').length === 2)
    $('set-use-memory').checked = false
    $('set-use-memory').dispatchEvent(new w.Event('change'))
    assert.equal($('set-mem-suggest').disabled, true)
    await waitFor(async () => {
      const r = await db.query(`SELECT value FROM settings WHERE key = 'use_memory'`)
      return r.length && JSON.stringify(r[0].value).includes('0')
    }, 8000)
    const before = upstreamCalls.length
    input.value = '我想知道今天天氣'
    input.dispatchEvent(new w.Event('input', { bubbles: true }))
    $('send-btn').click()
    await waitFor(() => upstreamCalls.length > before)
    await sleep(300)
    const calls = upstreamCalls.slice(before)
    assert.equal(calls.length, 1)
    assert.doesNotMatch(calls[0].messages[0].content, /阿明/)
  } finally {
    globalThis.fetch = originalFetch
    w.close()
  }
})
