// 第四階段：聊天時由伺服器注入「技能」與「Memory」。
// 技能：enabled 且（always｜keyword 命中最後一則使用者訊息｜manual 且前端指定 skill_ids）。
// Memory：全域 + 目前專案；釘選優先，其次與這次訊息的詞重疊多的，再其次最近更新。
// 兩者都是使用者自己寫的設定，視為可信指示（與知識庫、網頁搜尋的「不可信資料」不同）。
import { OWNER } from './providers.js'
import { searchTerms } from './entities.js'

export const SKILL_LIMITS = { count: 6, chars: 16_000 }
export const MEMORY_LIMITS = { count: 40, chars: 6_000, scan: 300 }
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/

export function skillMatches(skill, text, manualIds) {
  if (!skill.enabled) return false
  if (skill.trigger_mode === 'always') return true
  if (skill.trigger_mode === 'manual') return manualIds.has(skill.id)
  if (skill.trigger_mode === 'keyword') {
    const hay = String(text || '').toLowerCase()
    return (skill.keywords || []).some((k) => {
      const kw = String(k || '').trim().toLowerCase()
      return kw && hay.includes(kw)
    }) || manualIds.has(skill.id)
  }
  return false
}

export function rankMemories(rows, text) {
  const terms = searchTerms(text, 24)
  const scored = rows.map((m, i) => {
    const c = String(m.content || '').toLowerCase()
    let hits = 0
    for (const t of terms) if (c.includes(t)) hits++
    return { m, score: (m.pinned ? 1000 : 0) + hits * 10 - i * 0.01 }
  })
  scored.sort((a, b) => b.score - a.score)
  const out = []
  let used = 0
  for (const { m } of scored) {
    const len = String(m.content || '').length
    if (out.length >= MEMORY_LIMITS.count || used + len > MEMORY_LIMITS.chars) continue
    out.push(m)
    used += len
  }
  return out
}

export async function loadChatContext(db, { text = '', projectId = null, skillIds = [], useSkills = true, useMemory = true } = {}, ownerId = OWNER) {
  const result = { skills: [], memories: [] }
  if (!db) return result
  const manual = new Set((Array.isArray(skillIds) ? skillIds : []).map(String).filter((x) => ID_RE.test(x)).slice(0, 10))
  const pid = projectId && ID_RE.test(String(projectId)) ? String(projectId) : null
  const [skills, memories] = await Promise.all([
    useSkills
      ? db.query(
        `SELECT id, name, description, instructions, trigger_mode, keywords, enabled FROM skills
         WHERE owner_id = $1 AND deleted_at IS NULL AND enabled = true ORDER BY updated_at DESC LIMIT 200`, [ownerId])
      : [],
    useMemory
      ? db.query(
        `SELECT id, content, kind, pinned, project_id FROM memories
         WHERE owner_id = $1 AND deleted_at IS NULL AND (project_id IS NULL ${pid ? 'OR project_id = $3' : ''})
         ORDER BY pinned DESC, updated_at DESC LIMIT $2`,
        pid ? [ownerId, MEMORY_LIMITS.scan, pid] : [ownerId, MEMORY_LIMITS.scan])
      : [],
  ])
  let used = 0
  for (const s of skills) {
    if (result.skills.length >= SKILL_LIMITS.count) break
    if (!skillMatches(s, text, manual)) continue
    const len = String(s.instructions || '').length
    if (used + len > SKILL_LIMITS.chars) continue
    result.skills.push(s)
    used += len
  }
  result.memories = rankMemories(memories, text)
  return result
}

const KIND_LABEL = { fact: '事實', preference: '偏好', instruction: '指示', note: '備註' }

export function formatChatContext({ skills = [], memories = [] } = {}) {
  const parts = []
  if (memories.length) {
    parts.push(
      '## 關於使用者的記憶\n以下是使用者確認過、希望你記住的資訊。自然地運用，不要逐條複述，也不要說「根據記憶」。若與使用者這次說的內容衝突，以這次為準。\n' +
      memories.map((m) => `- （${KIND_LABEL[m.kind] || '事實'}）${String(m.content).replace(/\s+/g, ' ').trim()}`).join('\n'),
    )
  }
  for (const s of skills) {
    parts.push(`## 技能：${s.name}\n${s.description ? s.description.trim() + '\n\n' : ''}${String(s.instructions || '').trim()}`)
  }
  return parts.join('\n\n')
}

/** handleChat 的 loadContext 選項（Edge 與一般路由共用）。 */
export function chatContextLoader(db) {
  return async (body, env, text) => {
    const ctx = await loadChatContext(db, {
      text,
      projectId: body.project_id || null,
      skillIds: body.skill_ids,
      useSkills: body.use_skills !== false,
      useMemory: body.use_memory !== false,
    })
    return { ...ctx, text: formatChatContext(ctx) }
  }
}
