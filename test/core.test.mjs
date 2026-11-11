import test from 'node:test'
import assert from 'node:assert/strict'

import { createSession, verifySession, passwordMatches } from '../src/auth.js'
import {
  chatCompletionsUrl,
  modelsUrl,
  normalizeBaseUrl,
  parseModelIds,
  providerFromBody,
  publicEnvProvider,
  scanEnvProviders,
  envProvider,
} from '../src/providers.js'
import { calculate } from '../src/tools/calc.js'
import { searchDocuments } from '../src/tools/docs.js'
import { buildPollinationsUrl, normalizeImageOptions } from '../src/images.js'

const env = {
  APP_PASSWORD: 'correct horse battery staple',
  AUTH_SECRET: 'test-secret-that-is-long-enough-123456',
  SESSION_DAYS: '30',
}

test('session round-trip and tamper rejection', async () => {
  const token = await createSession(env, 30)
  const request = new Request('https://example.com/', {
    headers: { cookie: `__Host-session=${encodeURIComponent(token)}` },
  })
  const session = await verifySession(request, env)
  assert.equal(session.sub, 'owner')

  const bad = token.slice(0, -2) + 'aa'
  const badRequest = new Request('https://example.com/', {
    headers: { cookie: `__Host-session=${encodeURIComponent(bad)}` },
  })
  assert.equal(await verifySession(badRequest, env), null)
})

test('password comparison is exact', async () => {
  assert.equal(await passwordMatches('correct horse battery staple', env), true)
  assert.equal(await passwordMatches('wrong', env), false)
})

test('provider URLs normalize to OpenAI-compatible endpoints', () => {
  assert.equal(normalizeBaseUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1')
  assert.equal(chatCompletionsUrl('https://api.groq.com/openai/v1'), 'https://api.groq.com/openai/v1/chat/completions')
  assert.equal(modelsUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1/models')
  assert.equal(chatCompletionsUrl('https://example.com/v1/chat/completions'), 'https://example.com/v1/chat/completions')
})

test('provider URL rejects insecure and private targets', () => {
  for (const bad of [
    'http://api.example.com/v1',
    'https://localhost/v1',
    'https://127.0.0.1/v1',
    'https://10.0.0.2/v1',
    'https://172.16.1.2/v1',
    'https://192.168.1.2/v1',
    'https://printer.local/v1',
    'https://service.internal/v1',
    'https://[::1]/v1',
    'https://[fe80::1]/v1',
    'https://[fc00::1]/v1',
    'https://0x7f000001/v1',
  ]) {
    assert.throws(() => normalizeBaseUrl(bad), /HTTPS|主機/, bad)
  }
})

test('provider hostnames beginning with fc/fd are not treated as IPv6', () => {
  assert.equal(normalizeBaseUrl('https://fc-api.example.com/v1'), 'https://fc-api.example.com/v1')
  assert.equal(normalizeBaseUrl('https://fd.example.com/v1'), 'https://fd.example.com/v1')
})

test('providerFromBody requires a base URL but allows an empty key (self-hosted models)', () => {
  assert.throws(() => providerFromBody({}), /供應商/)
  const noKey = providerFromBody({ provider: { baseUrl: 'https://llm.example.com/v1', apiKey: '', model: 'local' } })
  assert.equal(noKey.apiKey, '')
  const shortKey = providerFromBody({ provider: { baseUrl: 'https://api.example.com/v1', apiKey: 'short', model: 'm' } })
  assert.equal(shortKey.apiKey, 'short')
  assert.throws(() => providerFromBody({ provider: { baseUrl: 'https://api.example.com/v1', apiKey: 'a\nb' } }), /API Key/)
})

test('providerFromBody never falls back to a built-in provider', () => {
  for (const env of [{}, { GROQ_API_KEY: 'gsk_12345678', GROQ_MODEL: 'llama-test' }, { PROVIDER_1_NAME: 'X', PROVIDER_1_BASE_URL: 'https://x.example.com/v1' }]) {
    assert.throws(() => providerFromBody({}, env), /請先在設定中新增供應商並選擇模型/)
  }
  const explicit = providerFromBody({ provider: { baseUrl: 'https://api.example.com/v1', apiKey: '' } })
  assert.equal(explicit.baseUrl, 'https://api.example.com/v1')
  assert.equal(explicit.apiKey, '')
})

test('env providers: scans all of 1..20 across gaps, requires NAME + BASE_URL, empty key allowed', () => {
  const env = {
    PROVIDER_1_NAME: 'Groq', PROVIDER_1_BASE_URL: 'https://api.groq.com/openai/v1/', PROVIDER_1_API_KEY: 'gsk_env_1',
    PROVIDER_1_MODELS: 'openai/gpt-oss-120b, openai/gpt-oss-20b,,openai/gpt-oss-120b',
    // 2–6 空號
    PROVIDER_7_NAME: '自建', PROVIDER_7_BASE_URL: 'https://llm.example.com/v1', PROVIDER_7_API_KEY: '', PROVIDER_7_MODELS: 'qwen-local',
    PROVIDER_9_NAME: '缺網址', PROVIDER_9_API_KEY: 'sk-orphan',
    PROVIDER_10_BASE_URL: 'https://noname.example.com/v1',
    PROVIDER_12_NAME: '不安全', PROVIDER_12_BASE_URL: 'http://insecure.example.com/v1',
    PROVIDER_13_NAME: '內網', PROVIDER_13_BASE_URL: 'https://192.168.1.5/v1',
    PROVIDER_14_NAME: '壞 Key', PROVIDER_14_BASE_URL: 'https://k.example.com/v1', PROVIDER_14_API_KEY: 'a\nb',
    PROVIDER_20_NAME: 'Cloudflare', PROVIDER_20_BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1',
    PROVIDER_20_API_KEY: 'cf-token', PROVIDER_20_EMBED_MODELS: '@cf/baai/bge-m3',
    PROVIDER_21_NAME: '超出範圍', PROVIDER_21_BASE_URL: 'https://out.example.com/v1',
    PROVIDER_0_NAME: '零', PROVIDER_0_BASE_URL: 'https://zero.example.com/v1',
  }
  const { providers, errors } = scanEnvProviders(env)
  assert.deepEqual(providers.map((p) => p.id), ['env-1', 'env-7', 'env-20'])
  assert.equal(providers[0].base_url, 'https://api.groq.com/openai/v1')
  assert.deepEqual(providers[0].models, ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
  assert.deepEqual(providers[0].embed_models, [])
  assert.equal(providers[1].api_key, '')
  assert.deepEqual(providers[2].models, [])
  assert.deepEqual(providers[2].embed_models, ['@cf/baai/bge-m3'])
  assert.deepEqual(errors.map((e) => e.index), [9, 10, 12, 13, 14])
  assert.match(errors.find((e) => e.index === 12).error, /HTTPS/)
  assert.match(errors.find((e) => e.index === 13).error, /主機/)
  assert.equal(JSON.stringify(errors).includes('sk-orphan'), false)
  assert.equal(envProvider(env, 'env-7').name, '自建')
  assert.equal(envProvider(env, 'env-9'), null)
  assert.equal(envProvider(env, 'env-21'), null)

  const pub = publicEnvProvider(providers[0])
  assert.equal(pub.readonly, true)
  assert.equal(pub.source, 'env')
  assert.equal(pub.note, '由環境變數管理')
  assert.equal(pub.has_key, true)
  assert.equal(JSON.stringify(pub).includes('gsk_env_1'), false)
  assert.equal(publicEnvProvider(providers[1]).has_key, false)
  assert.deepEqual(parseModelIds(' a ,b,a,, ' + 'x'.repeat(201)), ['a', 'b'])
})

test('calculator handles precedence, parentheses, unary and errors', () => {
  assert.equal(calculate('1+2*3'), 7)
  assert.equal(calculate('(1+2)*3'), 9)
  assert.equal(calculate('-2^2'), -4)
  assert.equal(calculate('10%4'), 2)
  assert.throws(() => calculate('1/0'), /除以零/)
  assert.throws(() => calculate('alert(1)'), /只支援/)
})

test('document search ranks title and content matches', () => {
  const docs = [
    { title: '旅遊計畫', content: '東京與京都五天行程' },
    { title: '工作筆記', content: '東京辦公室的會議紀錄' },
    { title: '無關', content: '今天天氣很好' },
  ]
  const results = searchDocuments('東京', docs)
  assert.equal(results.length, 2)
  assert.equal(results[0].title, '旅遊計畫')
})

test('image options are bounded and URL uses Pollinations', () => {
  const options = normalizeImageOptions({ prompt: '貓與太空船', width: 9999, height: 10, seed: 7 })
  assert.equal(options.width, 1536)
  assert.equal(options.height, 256)
  const url = buildPollinationsUrl(options)
  assert.match(url, /^https:\/\/image\.pollinations\.ai\/prompt\//)
  assert.match(url, /width=1536/)
  assert.match(url, /nologo=true/)
  assert.throws(() => normalizeImageOptions({ prompt: '' }), /提示詞/)
})

test('session is revoked when SESSION_VERSION changes', async () => {
  const token = await createSession({ ...env, SESSION_VERSION: '1' }, 30)
  const req = new Request('https://example.com/', { headers: { cookie: `__Host-session=${encodeURIComponent(token)}` } })
  assert.ok(await verifySession(req, { ...env, SESSION_VERSION: '1' }))
  assert.equal(await verifySession(req, { ...env, SESSION_VERSION: '2' }), null)
})
