export function searchDocuments(query, documents, limit = 5) {
  const q = String(query || '').trim().toLowerCase()
  if (!q || !Array.isArray(documents)) return []
  const terms = q.split(/\s+/).filter((t) => t.length > 1).slice(0, 8)
  const scored = []
  for (const doc of documents.slice(0, 200)) {
    if (!doc || typeof doc.content !== 'string') continue
    const title = String(doc.title || '')
    const text = doc.content
    const lower = `${title}\n${text}`.toLowerCase()
    let score = 0
    for (const term of terms) {
      if (!lower.includes(term)) continue
      score += title.toLowerCase().includes(term) ? 4 : 1
      const count = Math.min(5, lower.split(term).length - 1)
      score += count
    }
    if (score > 0) {
      const first = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] || 0
      scored.push({
        title,
        score,
        snippet: text.slice(Math.max(0, first - 120), Math.min(text.length, first + 520)),
      })
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}