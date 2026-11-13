import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRoles } from '../src/chat.js'

test('normalizeRoles: single system, strict alternation starting with user', () => {
  const out = normalizeRoles([
    { role: 'system', content: 'S' },
    { role: 'assistant', content: 'hi' },
    { role: 'user', content: 'a' },
    { role: 'user', content: 'b' },
    { role: 'system', content: 'S2' },
    { role: 'assistant', content: 'x' },
    { role: 'user', content: 'c' },
    { role: 'user', content: 'c' },
  ])
  assert.deepEqual(out, [
    { role: 'system', content: 'S\n\nS2' },
    { role: 'user', content: 'a\n\nb' },
    { role: 'assistant', content: 'x' },
    { role: 'user', content: 'c' },
  ])
})

import { buildSearchQuery } from '../src/chat.js'
test('buildSearchQuery: skip greetings, add context for follow-ups', () => {
  assert.equal(buildSearchQuery({ prompt: '你好' }), '')
  assert.equal(buildSearchQuery({ prompt: '謝謝！' }), '')
  assert.equal(buildSearchQuery({ prompt: 'Netlify Edge Functions 的執行時間上限是多少' }), 'Netlify Edge Functions 的執行時間上限是多少')
  assert.equal(
    buildSearchQuery({ messages: [{ role: 'user', content: 'Neon 免費方案的儲存上限' }, { role: 'assistant', content: '...' }, { role: 'user', content: '那運算時數呢？' }] }),
    'Neon 免費方案的儲存上限 那運算時數呢？',
  )
})
