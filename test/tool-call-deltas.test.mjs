import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// 從建置後的 app.js 取出 mergeToolCallDeltas（需先 npm run build）
const src = fs.readFileSync(new URL('../public/assets/app.js', import.meta.url), 'utf8')
const code = src.slice(src.indexOf('function toolArgsComplete'), src.indexOf('function toolLabel'))
const mergeToolCallDeltas = new Function(code + '\nreturn mergeToolCallDeltas;')()
const run = (chunks) => {
  const acc = []
  for (const c of chunks) mergeToolCallDeltas(acc, c)
  return acc.filter(Boolean).map((c) => [c.id, c.name, c.arguments])
}

test('tool call deltas: parallel calls sharing index 0 are split, not concatenated', () => {
  assert.deepEqual(run([
    [{ index: 0, id: 'a', function: { name: 'web__search', arguments: '{"query":"x"}' } }],
    [{ index: 0, id: 'b', function: { name: 'web__search', arguments: '{"query":"y"}' } }],
  ]), [['a', 'web__search', '{"query":"x"}'], ['b', 'web__search', '{"query":"y"}']])
})

test('tool call deltas: no id / no index, one complete call per chunk', () => {
  assert.deepEqual(run([
    [{ function: { name: 'web__search', arguments: '{"q":1}' } }],
    [{ function: { name: 'web__search', arguments: '{"q":2}' } }],
  ]), [['', 'web__search', '{"q":1}'], ['', 'web__search', '{"q":2}']])
})

test('tool call deltas: OpenAI-style fragmented arguments still merge', () => {
  assert.deepEqual(run([
    [{ index: 0, id: 'a', function: { name: 'web__search', arguments: '' } }],
    [{ index: 0, function: { arguments: '{"q":' } }],
    [{ index: 0, function: { arguments: '1}' } }],
    [{ index: 1, id: 'b', function: { name: 'docs__list', arguments: '{}' } }],
  ]), [['a', 'web__search', '{"q":1}'], ['b', 'docs__list', '{}']])
})

test('tool call deltas: index 0 reused with fragments after a new id', () => {
  assert.deepEqual(run([
    [{ index: 0, id: 'a', function: { name: 'web__search' } }],
    [{ index: 0, function: { arguments: '{"q":1}' } }],
    [{ index: 0, id: 'b', function: { name: 'web__search' } }],
    [{ index: 0, function: { arguments: '{"q":2}' } }],
  ]), [['a', 'web__search', '{"q":1}'], ['b', 'web__search', '{"q":2}']])
})

test('tool call deltas: repeated full name / arguments are not duplicated', () => {
  assert.deepEqual(run([
    [{ index: 0, id: 'a', function: { name: 'web__search', arguments: '{"q":1}' } }],
    [{ index: 0, id: 'a', function: { name: 'web__search', arguments: '{"q":1}' } }],
  ]), [['a', 'web__search', '{"q":1}']])
})
