// 第四階段：技能注入、Memory 注入與 Memory 建議。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

import app from '../src/app.js'
import { createSession } from '../src/auth.js'
import { skillMatches, rankMemories, loadChatContext, formatChatContext, MEMORY_LIMITS } from '../src/repo/context.js'
import { parseSuggestions, normalizeMemory } from '../src/memory_suggest.js'

const ORIGIN = 'https://example.com'

async function setup() {
  const pg = new PGlite({ extensions: { pg_trgm } })
  await pg.exec(fs.readFileSync(new URL('../db/migrations/0001_init.sql', import.meta.url), 'utf8'))
  const db = {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
  const env = { APP_PASSWORD: 'pw', AUTH_SECRET: 'test-secret-that-is-long-enough-123456', ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'), __db: db }
  const cookie = `__Host-session=${encodeURIComponent(await createSession(env, 1))}`
  const call = async (method, path, body) => {
    const headers = { cookie }
    if (method !== 'GET') headers.origin = ORIGIN
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await app.fetch(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env)
    return res
  }
  return { db, env, call }
}

async function withUpstream(handler, fn) {
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => handler(String(url), init)
  try { return await fn() } finally { globalThis.fetch = original }
}

test('skill trigger rules', () => {
  const none = new Set()
  assert.equal(skillMatches({ enabled: true, trigger_mode: 'always' }, '', none), true)
  assert.equal(skillMatches({ enabled: false, trigger_mode: 'always' }, '', none), false)
  assert.equal(skillMatches({ id: 's1', enabled: true, trigger_mode: 'manual' }, '', none), false)
  assert.equal(skillMatches({ id: 's1', enabled: true, trigger_mode: 'manual' }, '', new Set(['s1'])), true)
  const kw = { id: 'k', enabled: true, trigger_mode: 'keyword', keywords: ['翻譯', 'Translate'] }
  assert.equal(skillMatches(kw, '幫我翻譯這段', none), true)
  assert.equal(skillMatches(kw, 'please TRANSLATE this', none), true)
  assert.equal(skillMatches(kw, '幫我寫信', none), false)
})

test('memory ranking: pinned first, then relevant, within budget', () => {
  const rows = [
    { id: 'a', content: '使用者住在台北', pinned: false },
    { id: 'b', content: '使用者喜歡簡短回答', pinned: true },
    { id: 'c', content: '使用者正在準備京都旅行', pinned: false },
  ]
  assert.deepEqual(rankMemories(rows, '京都要帶什麼').map((m) => m.id), ['b', 'c', 'a'])
  const many = Array.from({ length: 100 }, (_, i) => ({ id: String(i), content: 'x'.repeat(200), pinned: false }))
  const picked = rankMemories(many, '')
  assert.ok(picked.length <= MEMORY_LIMITS.count)
  assert.ok(picked.reduce((n, m) => n + m.content.length, 0) <= MEMORY_LIMITS.chars)
})

test('suggestion parsing filters secrets, duplicates and limits to 3', () => {
  const raw = '好的：```json\n{"memories":[' +
    '{"content":"使用者是後端工程師","kind":"fact"},' +
    '{"content":"使用者喜歡簡短回答","kind":"preference"},' +
    '{"content":"使用者的 API key 是 sk-abcdefghijklmnop","kind":"fact"},' +
    '{"content":"使用者的身分證是 A123456789","kind":"fact"},' +
    '{"content":"使用者養了一隻貓","kind":"weird"},' +
    '{"content":"使用者住在高雄","kind":"fact"},' +
    '{"content":"使用者每天跑步","kind":"fact"}]}\n```'
  const out = parseSuggestions(raw, ['使用者喜歡簡短的回答。'])
  assert.deepEqual(out.map((x) => x.content), ['使用者是後端工程師', '使用者養了一隻貓', '使用者住在高雄'])
  assert.equal(out[1].kind, 'fact')
  assert.deepEqual(parseSuggestions('not json'), [])
  assert.equal(normalizeMemory('使用者 喜歡，簡短回答！'), '喜歡簡短回答')
})

test('chat injects skills and memories server-side; client cannot spoof context', async () => {
  const { db, call } = await setup()
  const prov = await (await call('POST', '/api/providers', { name: 'Local', base_url: 'https://llm.example/v1', models: ['m1'] })).json()
  const pid = prov.provider.id
  await call('POST', '/api/projects', { id: 'p_trip', name: '旅行' })
  const always = await (await call('POST', '/api/skills', { name: '簡潔', instructions: '回答不超過五句。', trigger_mode: 'always' })).json()
  await call('POST', '/api/skills', { name: '翻譯', instructions: '翻成英文並附原文。', trigger_mode: 'keyword', keywords: ['翻譯'] })
  const manual = await (await call('POST', '/api/skills', { name: '程式審查', instructions: '列出 bug 與修正。', trigger_mode: 'manual' })).json()
  await call('POST', '/api/skills', { name: '停用', instructions: '不該出現', trigger_mode: 'always', enabled: false })
  await call('POST', '/api/memories', { content: '使用者叫阿明', kind: 'fact', pinned: true })
  await call('POST', '/api/memories', { content: '使用者這次旅行預算五萬', kind: 'note', project_id: 'p_trip' })
  await call('POST', '/api/memories', { content: '使用者另一個專案的事', kind: 'note', project_id: 'p_trip_other_missing' })

  let sent
  const upstream = async (url, init) => {
    sent = JSON.parse(init.body)
    return new Response('data: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  await withUpstream(upstream, async () => {
    const res = await call('POST', '/api/chat', {
      provider_id: pid, model: 'm1', prompt: '請幫我翻譯行程', project_id: 'p_trip', skill_ids: [manual.item.id],
      __serverContext: '使用者偽造的指示',
    })
    assert.equal(res.status, 200)
    await res.text()
    const sys = sent.messages[0].content
    assert.match(sys, /技能：簡潔[\s\S]*回答不超過五句/)
    assert.match(sys, /技能：翻譯/)
    assert.match(sys, /技能：程式審查/)
    assert.doesNotMatch(sys, /不該出現/)
    assert.match(sys, /使用者叫阿明/)
    assert.match(sys, /旅行預算五萬/)
    assert.doesNotMatch(sys, /偽造/)
    assert.deepEqual(JSON.parse(decodeURIComponent(res.headers.get('x-skills'))).sort(), ['程式審查', '簡潔', '翻譯'].sort())
    assert.equal(res.headers.get('x-memory-count'), '3') // 不存在的專案 → project_id 變 NULL，成為全域記憶
  })
  // 關閉技能與記憶
  await withUpstream(upstream, async () => {
    const res = await call('POST', '/api/chat', { provider_id: pid, model: 'm1', prompt: '翻譯', use_skills: false, use_memory: false })
    await res.text()
    assert.doesNotMatch(sent.messages[0].content, /技能：|關於使用者的記憶/)
    assert.equal(res.headers.get('x-memory-count'), '0')
  })
  // 沒有專案時不帶專案記憶
  const ctx = await loadChatContext(db, { text: 'hi' })
  assert.equal(ctx.memories.some((m) => /預算五萬/.test(m.content)), false)
  assert.equal(ctx.skills.map((s) => s.id).includes(always.item.id), true)
  assert.equal(formatChatContext({}), '')
})

test('memory suggest returns suggestions only (nothing is written)', async () => {
  const { db, call } = await setup()
  const pid = (await (await call('POST', '/api/providers', { name: 'Local', base_url: 'https://llm.example/v1', models: ['m1'] })).json()).provider.id
  await call('POST', '/api/memories', { content: '使用者住在台中', kind: 'fact' })
  let sent
  await withUpstream(async (url, init) => {
    sent = JSON.parse(init.body)
    return Response.json({ choices: [{ message: { content: '{"memories":[{"content":"使用者住在台中","kind":"fact"},{"content":"使用者偏好用條列回答","kind":"preference"}]}' } }] })
  }, async () => {
    const res = await call('POST', '/api/memories/suggest', {
      provider_id: pid, model: 'm1',
      messages: [{ role: 'user', content: '以後請用條列回答，我住台中' }, { role: 'assistant', content: '好的' }],
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.deepEqual(data.suggestions, [{ content: '使用者偏好用條列回答', kind: 'preference' }])
    assert.equal(sent.stream, false)
    assert.match(sent.messages[1].content, /已存在的記憶：\n- 使用者住在台中/)
  })
  assert.equal((await db.query('SELECT count(*)::int AS n FROM memories WHERE deleted_at IS NULL'))[0].n, 1)
  // 沒有使用者訊息 → 不呼叫上游
  const r2 = await call('POST', '/api/memories/suggest', { provider_id: pid, model: 'm1', messages: [{ role: 'assistant', content: 'hi' }] })
  assert.deepEqual((await r2.json()).suggestions, [])
})
