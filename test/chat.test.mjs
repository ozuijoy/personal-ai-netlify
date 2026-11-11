import test from 'node:test'
import assert from 'node:assert/strict'

import { handleChat } from '../src/chat.js'

function chatRequest(body) {
  return new Request('https://example.com/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const provider = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-12345678',
  model: 'test-model',
}

test('chat has no built-in provider: without one it asks the user to add one and pick a model', async () => {
  const original = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; return new Response('') }
  try {
    // 舊的 GROQ_* 變數不再有任何作用
    const response = await handleChat(chatRequest({ prompt: '你好' }), {
      GROQ_API_KEY: 'gsk_12345678',
      GROQ_BASE_URL: 'https://groq.example/v1',
      GROQ_MODEL: 'groq-test-model',
    })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error, '請先在設定中新增供應商並選擇模型')
    assert.equal(called, false)
  } finally {
    globalThis.fetch = original
  }
})

test('chat proxies raw SSE and sends OpenAI-style messages', async () => {
  const original = globalThis.fetch
  let captured = null
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) }
    return new Response(
      'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }
  try {
    const response = await handleChat(chatRequest({
      prompt: '哈囉',
      provider,
      custom_prompt: '你是測試助理',
      chat_history: [{ role: 'user', content: '先前訊息' }, { role: 'ai', content: '先前回覆' }],
    }), {})
    assert.equal(response.status, 200)
    assert.match(captured.url, /\/chat\/completions$/)
    assert.equal(captured.body.model, 'test-model')
    assert.equal(captured.body.messages[0].role, 'system')
    assert.equal(captured.body.messages.at(-1).content, '哈囉')
    assert.equal(captured.body.messages.some((m) => m.role === 'assistant'), true)
    const text = await response.text()
    assert.match(text, /你好/)
    assert.equal(response.headers.get('x-search-status'), 'off')
  } finally {
    globalThis.fetch = original
  }
})

test('chat converts a non-stream JSON provider response to SSE', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(
    JSON.stringify({ choices: [{ message: { content: 'JSON 回覆' } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
  try {
    const response = await handleChat(chatRequest({ prompt: 'test', provider }), {})
    const text = await response.text()
    assert.match(text, /JSON 回覆/)
    assert.match(text, /\[DONE\]/)
  } finally {
    globalThis.fetch = original
  }
})

test('chat rejects missing provider', async () => {
  const response = await handleChat(chatRequest({ prompt: 'test' }), {})
  assert.equal(response.status, 400)
})

test('chat rejects image attachments in v1', async () => {
  const response = await handleChat(chatRequest({
    prompt: 'test',
    provider,
    image: 'data:image/png;base64,abc',
  }), {})
  assert.equal(response.status, 400)
})
test('chat omits Authorization header for providers without a key', async () => {
  const original = globalThis.fetch
  let headers = null
  globalThis.fetch = async (url, init) => {
    headers = init.headers
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  try {
    const res = await handleChat(chatRequest({ prompt: 'hi', provider: { baseUrl: 'https://llm.example.com/v1', apiKey: '', model: 'local' } }), {})
    assert.equal(res.status, 200)
    assert.equal(headers.Authorization, undefined)
  } finally { globalThis.fetch = original }
})

test('chat uses injected resolver (provider_id path)', async () => {
  const original = globalThis.fetch
  let captured = null
  globalThis.fetch = async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) }
    return new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  try {
    const res = await handleChat(chatRequest({ prompt: 'hi', provider_id: 'p1', model: 'm1' }), {}, {
      resolveProvider: async (body) => ({ baseUrl: 'https://x.example.com/v1', apiKey: 'sk-secret-123', model: body.model }),
    })
    assert.equal(res.status, 200)
    assert.equal(captured.url, 'https://x.example.com/v1/chat/completions')
    assert.equal(captured.headers.Authorization, 'Bearer sk-secret-123')
    assert.equal(captured.body.model, 'm1')
  } finally { globalThis.fetch = original }
})
