// docs__edit / docs__create_folder / docs__delete，以及 docs__save 只改標題／搬資料夾不必重送 content
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { DOC_TOOLS, callDocTool } from '../src/doc_tools.js'
import { createEntity, getEntity } from '../src/repo/entities.js'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
async function makeDb() {
  const pg = new PGlite({ extensions: { pg_trgm } })
  await pg.exec(read('db/migrations/0001_init.sql'))
  await pg.exec(read('db/migrations/0003_model_kinds.sql'))
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: (st) => pg.transaction(async (t) => { const out = []; for (const [q, p] of st) out.push((await t.query(q, p || [])).rows); return out }),
  }
}
const call = (db, name, args) => callDocTool(db, {}, { name, arguments: JSON.stringify(args || {}) })

test('new doc tools are declared', () => {
  const names = DOC_TOOLS.map((t) => t.function.name)
  for (const n of ['docs__edit', 'docs__create_folder', 'docs__delete']) assert.ok(names.includes(n), n)
  const save = DOC_TOOLS.find((t) => t.function.name === 'docs__save')
  assert.ok(!(save.function.parameters.required || []).includes('content'))
})

test('docs__create_folder creates once, then reuses by name; save into it', async () => {
  const db = await makeDb()
  const r1 = await call(db, 'docs__create_folder', { name: '旅行計畫' })
  assert.equal(r1.is_error, false)
  assert.equal(r1.action, 'folder_created')
  assert.ok(r1.project && r1.project.id)
  const r2 = await call(db, 'docs__create_folder', { name: '旅行計畫' })
  assert.equal(JSON.parse(r2.content).action, 'exists')
  assert.equal(JSON.parse(r2.content).id, r1.project.id)
  const s = await call(db, 'docs__save', { title: '京都', content: '嵐山', project_id: '旅行計畫' })
  assert.equal(s.is_error, false)
  assert.equal(s.item.project_id, r1.project.id)
})

test('docs__save: rename / move without content; create still needs content', async () => {
  const db = await makeDb()
  await createEntity(db, 'projects', { id: 'p1', name: 'A' })
  await createEntity(db, 'documents', { id: 'd1', title: '舊標題', content: '原文不變' })
  let r = await call(db, 'docs__save', { id: 'd1', project_id: 'A' })
  assert.equal(r.is_error, false)
  let d = await getEntity(db, 'documents', 'd1')
  assert.equal(d.project_id, 'p1'); assert.equal(d.content, '原文不變')
  r = await call(db, 'docs__save', { id: 'd1', title: '新標題' })
  d = await getEntity(db, 'documents', 'd1')
  assert.equal(d.title, '新標題'); assert.equal(d.content, '原文不變')
  r = await call(db, 'docs__save', { title: '沒內容' })
  assert.equal(r.is_error, true)
  r = await call(db, 'docs__save', { id: 'd1' })
  assert.equal(r.is_error, true)
})

test('docs__edit: unique replace, ambiguous, missing, replace_all', async () => {
  const db = await makeDb()
  await createEntity(db, 'documents', { id: 'd1', title: 't', content: '貓 狗 貓 鳥' })
  let r = await call(db, 'docs__edit', { id: 'd1', old_text: '狗', new_text: '魚' })
  assert.equal(r.is_error, false)
  assert.equal((await getEntity(db, 'documents', 'd1')).content, '貓 魚 貓 鳥')
  r = await call(db, 'docs__edit', { id: 'd1', old_text: '貓', new_text: '虎' })
  assert.equal(r.is_error, true); assert.match(r.content, /2 次/)
  r = await call(db, 'docs__edit', { id: 'd1', old_text: '龍', new_text: '虎' })
  assert.equal(r.is_error, true); assert.match(r.content, /找不到/)
  r = await call(db, 'docs__edit', { id: 'd1', old_text: '貓', new_text: '$&', replace_all: true })
  assert.equal((await getEntity(db, 'documents', 'd1')).content, '$& 魚 $& 鳥')
  r = await call(db, 'docs__edit', { id: 'd1', old_text: ' 鳥', new_text: '' })
  assert.equal((await getEntity(db, 'documents', 'd1')).content, '$& 魚 $&')
})

test('docs__delete soft-deletes', async () => {
  const db = await makeDb()
  await createEntity(db, 'documents', { id: 'd1', title: 't', content: 'x' })
  const r = await call(db, 'docs__delete', { id: 'd1' })
  assert.equal(r.is_error, false); assert.equal(r.deleted_id, 'd1')
  assert.equal(await getEntity(db, 'documents', 'd1'), null)
  assert.equal((await call(db, 'docs__delete', { id: 'd1' })).is_error, true)
})
