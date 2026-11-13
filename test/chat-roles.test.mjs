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
