// 伺服器端保存回答：串流分兩路、關頁仍寫入、以 mid 去重、整份覆蓋時保留未確認的代存訊息。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { vector } from '@electric-sql/pglite/vector'
import { getConversation, saveServerMessages, upsertConversation } from '../src/repo/conversations.js'
import { handleChat, replySaver, textFromSse } from '../src/chat.js'

const sql = (f) => fs.readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8')
async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm, vector } })
  for (const f of ['0001_init.sql', '0002_vectors.sql', '0003_model_kinds.sql', '0004_cjk_bm25.sql']) await pg.exec(sql(f))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
}

test('textFromSse', () => {
  assert.equal(textFromSse('data: {"choices":[{"delta":{"content":"你"}}]}\n\ndata: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n'), '你好')
})

test('saveServerMessages: creates conversation, dedupes by mid; PUT keeps unacknowledged server messages', async () => {
  const db = await makeDb()
  const input = { conversation_id: '1700000000000', title: '問天氣', messages: [
    { mid: 'u1', role: 'user', content: '天氣？' }, { mid: 'a1', role: 'assistant', content: '晴天' }] }
  assert.equal((await saveServerMessages(db, input)).saved, 2)
  assert.equal((await saveServerMessages(db, input)).saved, 0)
  let c = await getConversation(db, '1700000000000')
  assert.equal(c.title, '問天氣')
  assert.deepEqual(c.messages.map((m) => m.content), ['天氣？', '晴天'])

  // 前端只知道使用者訊息（關頁前推送）→ 代存的回答保留
  await upsertConversation(db, { id: '1700000000000', title: '問天氣', messages: [{ mid: 'u1', role: 'user', content: '天氣？' }] })
  c = await getConversation(db, '1700000000000')
  assert.deepEqual(c.messages.map((m) => m.content), ['天氣？', '晴天'])
  // 前端確認（同 mid）後，以前端版本為準；之後刪除可生效
  await upsertConversation(db, { id: '1700000000000', messages: [{ mid: 'u1', role: 'user', content: '天氣？' }, { mid: 'a1', role: 'assistant', content: '晴天（停止）' }] })
  c = await getConversation(db, '1700000000000')
  assert.deepEqual(c.messages.map((m) => m.content), ['天氣？', '晴天（停止）'])
  await upsertConversation(db, { id: '1700000000000', messages: [{ mid: 'u1', role: 'user', content: '天氣？' }] })
  c = await getConversation(db, '1700000000000')
  assert.equal(c.messages.length, 1)
})

test('handleChat persist: saves full reply even when client stops reading', async () => {
  const db = await makeDb()
  const orig = globalThis.fetch
  let upstreamSignal = 'unset'
  globalThis.fetch = async (url, init) => {
    upstreamSignal = init.signal
    return new Response('data: {"choices":[{"delta":{"content":"第一段"}}]}\n\ndata: {"choices":[{"delta":{"content":"第二段"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  }
  const jobs = []
  try {
    const req = new Request('https://app.example/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      prompt: '寫兩段', persist: { conversation_id: 'c1', title: '測試', user: { mid: 'u9', content: '寫兩段' }, assistant_mid: 'a9' },
    }) })
    const res = await handleChat(req, {}, {
      resolveProvider: async () => ({ baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'm' }),
      saveReply: replySaver((input) => saveServerMessages(db, input)),
      waitUntil: (p) => jobs.push(p),
    })
    assert.notEqual(upstreamSignal, req.signal)
    await res.body.cancel() // 瀏覽器關頁
    await Promise.all(jobs)
    const c = await getConversation(db, 'c1')
    assert.deepEqual(c.messages.map((m) => [m.role, m.content]), [['user', '寫兩段'], ['assistant', '第一段第二段']])
  } finally { globalThis.fetch = orig }
})
