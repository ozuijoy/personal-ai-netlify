function tokenize(input) {
  const text = String(input || '').replace(/\s+/g, '')
  if (!text) throw new Error('表達式為空')
  if (text.length > 200) throw new Error('表達式過長')
  const tokens = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < text.length && /[0-9.eE]/.test(text[j])) j++
      const raw = text.slice(i, j)
      const n = Number(raw)
      if (!Number.isFinite(n)) throw new Error('數字格式不正確')
      tokens.push({ type: 'number', value: n })
      i = j
      continue
    }
    if ('+-*/%^()'.includes(ch)) {
      tokens.push({ type: ch })
      i++
      continue
    }
    throw new Error('只支援數字、括號與 + - * / % ^')
  }
  return tokens
}

export function calculate(expression) {
  const tokens = tokenize(expression)
  let pos = 0

  function peek() { return tokens[pos] }
  function eat(type) {
    if (!tokens[pos] || tokens[pos].type !== type) throw new Error('表達式語法錯誤')
    return tokens[pos++]
  }

  function primary() {
    const tok = peek()
    if (!tok) throw new Error('表達式不完整')
    if (tok.type === 'number') { pos++; return tok.value }
    if (tok.type === '(') {
      pos++
      const value = expr()
      eat(')')
      return value
    }
    if (tok.type === '+' || tok.type === '-') {
      pos++
      const value = power()
      return tok.type === '-' ? -value : value
    }
    throw new Error('表達式語法錯誤')
  }

  function power() {
    let left = primary()
    if (peek() && peek().type === '^') {
      pos++
      left = Math.pow(left, power())
    }
    return left
  }

  function term() {
    let left = power()
    while (peek() && '*/%'.includes(peek().type)) {
      const op = tokens[pos++].type
      const right = power()
      if (op === '*') left *= right
      else if (op === '/') {
        if (right === 0) throw new Error('不可除以零')
        left /= right
      } else {
        if (right === 0) throw new Error('不可除以零')
        left %= right
      }
    }
    return left
  }

  function expr() {
    let left = term()
    while (peek() && '+-'.includes(peek().type)) {
      const op = tokens[pos++].type
      const right = term()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  const value = expr()
  if (pos !== tokens.length) throw new Error('表達式語法錯誤')
  if (!Number.isFinite(value)) throw new Error('計算結果無效')
  return value
}