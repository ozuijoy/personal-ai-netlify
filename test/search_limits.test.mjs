import test from 'node:test'
import assert from 'node:assert/strict'
import { limitSearchResults, searchLimits } from '../src/tools/search.js'

const mk = (n, len) => Array.from({ length: n }, (_, i) => ({ title: 't' + i, url: 'https://x/' + i, content: 'a'.repeat(len) }))

test('search limits: defaults 3 results, 400 chars each, 1500 total', () => {
  assert.deepEqual(searchLimits({}), { maxResults: 3, snippetChars: 400, contextChars: 1500 })
  const out = limitSearchResults(mk(5, 1200), {})
  assert.equal(out.length, 3)
  assert.ok(out.every((r) => r.content.length <= 401))
})

test('search limits: env overrides and total cap', () => {
  const env = { SEARCH_MAX_RESULTS: '5', SEARCH_SNIPPET_CHARS: '1000', SEARCH_CONTEXT_CHARS: '1200' }
  const out = limitSearchResults(mk(5, 1000), env)
  const total = out.reduce((s, r) => s + r.content.replace(/…$/, '').length, 0)
  assert.ok(total <= 1200)
  assert.equal(searchLimits({ SEARCH_MAX_RESULTS: '99' }).maxResults, 5)
})
