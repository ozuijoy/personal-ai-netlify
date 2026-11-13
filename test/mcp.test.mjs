// MCP：面板設定、Streamable HTTP 客戶端（JSON 與 SSE 回應、Mcp-Session-Id）、工具清單、呼叫、聊天注入 tools 與工具回合。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { vector } from '@electric-sql/pglite/vector'
import {
  callMcpTool, createMcpServer, deleteMcpServer, listMcpServers, normalizeMcpUrl, rekeyMcpSecrets, resolveMcpTools, updateMcpServer,
} from '../src/mcp.js'
import { getSettings } from '../src/repo/entities.js'
import { exportPage } from '../src/backup.js'
import { handleChat, toolTurnMessages } from '../src/chat.js'

const sql = (f) => fs.readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8')
const KEY = Buffer.alloc(32, 3).toString('base64')
const KEY2 = Buffer.alloc(32, 5).toString('base64')

async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm, vector } })
  for (const f of ['0001_init.sql', '0002_vectors.sql', '0003_model_kinds.sql', '0004_cjk_bm25.sql']) await pg.exec(sql(f))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
}

function fakeMcp(log) {
  return async (url, init) => {
    const h = init.headers
    const msg = JSON.parse(init.body)
    log.push({ url, method: msg.method, headers: h })
    if (!msg.id) return new Response(null, { status: 202 })
    if (msg.method === 'initialize') {
      return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fake' } } })}\n\n`,
        { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Mcp-Session-Id': 'sess-1' } })
    }
    assert.equal(h['Mcp-Session-Id'], 'sess-1')
    assert.equal(h['MCP-Protocol-Version'], '2025-06-18')
    if (msg.method === 'tools/list') {
      return Response.json({ jsonrpc: '2.0', id: msg.id, result: { tools: [
        { name: 'get-weather', description: '查天氣', inputSchema: { type: 'object', properties: { city: { type: 'string' } } }, annotations: { readOnlyHint: true } },
        { name: 'delete_all', description: '危險', inputSchema: { type: 'object', properties: {} } },
      ] } })
    }
    if (msg.method === 'tools/call') {
      return new Response(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress', params: {} })}\n\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `${msg.params.arguments.city} 晴` }] } })}\n\n`,
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    }
    return Response.json({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'nope' } })
  }
}

test('mcp: url validation', () => {
  assert.throws(() => normalizeMcpUrl('http://x.com/mcp'))
  assert.throws(() => normalizeMcpUrl('https://127.0.0.1/mcp'))
  assert.equal(normalizeMcpUrl('https://mcp.example.com/mcp'), 'https://mcp.example.com/mcp')
})

test('mcp: add server, list tools, call with confirmation API, disable, rekey, delete', async () => {
  const db = await makeDb()
  const env = { ENCRYPTION_KEY: KEY }
  const log = []
  const opts = { fetchImpl: fakeMcp(log) }
  const sv = await createMcpServer(db, env, { name: 'Weather', url: 'https://mcp.example.com/mcp', token: 'tok_secret_abc123' }, undefined, opts)
  assert.equal(sv.tools_error, '')
  assert.equal(sv.tools.length, 2)
  assert.equal(sv.has_token, true)
  assert.equal(log[0].headers.Authorization, 'Bearer tok_secret_abc123')
  assert.ok(log.some((l) => l.method === 'notifications/initialized'))
  const raw = await getSettings(db)
  assert.ok(!JSON.stringify(raw).includes('tok_secret_abc123'))
  assert.ok(!JSON.stringify(await exportPage(db, 'settings', null)).includes('secret.mcp'))

  let tools = await resolveMcpTools(db)
  assert.equal(tools.length, 2)
  const fn = tools[0].function.name
  assert.match(fn, /^mcp[0-9a-f]{8}__get-weather$/)
  const r = await callMcpTool(db, env, { name: fn, arguments: '{"city":"台北"}' }, undefined, opts)
  assert.equal(r.content, '台北 晴')
  assert.equal(r.is_error, false)

  await updateMcpServer(db, env, sv.id, { disabled_tools: ['delete_all'] }, undefined, opts)
  tools = await resolveMcpTools(db)
  assert.deepEqual(tools.map((t) => t.function.name), [fn])
  await assert.rejects(callMcpTool(db, env, { name: `${sv.id}__delete_all`, arguments: {} }, undefined, opts))
  await updateMcpServer(db, env, sv.id, { enabled: false }, undefined, opts)
  assert.equal((await resolveMcpTools(db)).length, 0)
  await assert.rejects(callMcpTool(db, env, { name: fn, arguments: {} }, undefined, opts))

  const env2 = { ENCRYPTION_KEY: KEY2, KEY_VERSION: 'v2', ENCRYPTION_KEY_PREVIOUS: KEY, KEY_VERSION_PREVIOUS: 'v1' }
  assert.equal((await rekeyMcpSecrets(db, env2)).rekeyed, 1)
  assert.equal((await listMcpServers(db, env2)).servers.length, 1)
  assert.equal(await deleteMcpServer(db, sv.id), true)
  assert.equal(Object.keys(await getSettings(db)).filter((k) => k.includes('mcp')).length, 0)
})

test('chat: injects MCP tools and converts tool turns', async () => {
  const msgs = toolTurnMessages([{ content: '', tool_calls: [{ id: 'c1', name: 'mcpab__get-weather', arguments: '{"city":"台北"}' }], results: [{ id: 'c1', content: '台北 晴' }] }])
  assert.equal(msgs[0].role, 'assistant')
  assert.equal(msgs[0].tool_calls[0].function.name, 'mcpab__get-weather')
  assert.deepEqual(msgs[1], { role: 'tool', tool_call_id: 'c1', content: '台北 晴' })

  const orig = globalThis.fetch
  let sent
  globalThis.fetch = async (url, init) => {
    sent = JSON.parse(init.body)
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  }
  try {
    const req = new Request('https://app.example/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      prompt: '台北天氣', tool_turns: [{ tool_calls: [{ id: 'c1', name: 'mcpab__get-weather', arguments: '{}' }], results: [{ id: 'c1', content: '晴' }] }],
    }) })
    const res = await handleChat(req, {}, {
      resolveProvider: async () => ({ baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'm' }),
      resolveTools: async () => [{ type: 'function', function: { name: 'mcpab__get-weather', description: 'x', parameters: { type: 'object', properties: {} } } }],
    })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('X-Tool-Count'), '1')
    assert.equal(sent.tools.length, 1)
    const roles = sent.messages.map((m) => m.role)
    assert.deepEqual(roles, ['system', 'user', 'assistant', 'tool'])
  } finally { globalThis.fetch = orig }
})
