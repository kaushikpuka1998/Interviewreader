// Estimates time/space complexity from the SHAPE of a solution (loop nesting, halving, sorting, recursion). It reads
// the code, it does not run it, so it is an estimate: unusual code can fool it. Used by ComplexityCard after a submission.
const PY_LIKE = new Set(['python', 'ruby'])

function strip(src, lang) {
  let s = String(src || '').replace(/\/\*[\s\S]*?\*\//g, ' ')
  s = s.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '""').replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""')
  return s.replace(PY_LIKE.has(lang) ? /#[^\n]*/g : /\/\/[^\n]*/g, '')
}

// What one loop header costs: 'const' (tiny fixed bound), 'log' (halves/doubles), or 'n'.
function kindOf(header, whole) {
  const small = /(?:<=?|range\(|in)\s*\(?\s*(\d+)\s*\)?/.exec(header)
  if (small && Number(small[1]) <= 64 && !/[a-z_]\w*\s*\)?\s*$/i.test(header.replace(/\d+\s*\)?\s*$/, ''))) return 'const'
  if (/\*=|\/=|>>=|<<=|\/\s*2|>>\s*1|\*\s*2|\/\/=\s*2/.test(header)) return 'log'
  if (/(\w+)\s*<=?\s*(\w+)/.test(header) && /\bwhile\b/.test(header) && /\bmid\b|>>\s*1|\/\/?\s*2/.test(whole)) return 'log'
  return 'n'
}

function label(poly, log, exp) {
  if (exp) return 'O(2ⁿ)'
  const l = log > 0
  if (poly === 0) return l ? 'O(log n)' : 'O(1)'
  if (poly === 1) return l ? 'O(n log n)' : 'O(n)'
  if (poly === 2) return l ? 'O(n² log n)' : 'O(n²)'
  return 'O(n³)'
}

export function analyzeComplexity(source, language = '') {
  const code = strip(source, language)
  if (code.trim().length < 15) return null
  const py = PY_LIKE.has(language)
  const reasons = []
  let best = { poly: 0, log: 0 }
  const offer = (poly, log) => { if (poly > best.poly || (poly === best.poly && log > best.log)) best = { poly, log } }
  const deg = (stack) => stack.reduce((a, k) => (k === 'n' ? { ...a, poly: a.poly + 1 } : k === 'log' ? { ...a, log: a.log + 1 } : a), { poly: 0, log: 0 })
  const SORT = /\.sort\s*\(|\bsorted\s*\(|\bsort\s*\(|Arrays\.sort|Collections\.sort|sort\.(?:Ints|Slice|Strings)|\.sort_by|\.sort!/
  const HEAP = /heappush|heappop|PriorityQueue|priority_queue|TreeMap|TreeSet|BinaryHeap|\.offer\s*\(|\.poll\s*\(|SortedList|bisect/
  let sorts = 0, heaps = 0, maxLoops = 0

  const visit = (stack, text, atLoopStart, kind) => {
    if (atLoopStart) {
      const d = deg([...stack, kind])
      offer(d.poly, d.log)
      maxLoops = Math.max(maxLoops, stack.filter(k => k !== 'const').length + (kind === 'const' ? 0 : 1))
    }
    if (SORT.test(text)) { sorts++; const d = deg(stack); offer(d.poly + 1, d.log + 1) }
    if (HEAP.test(text)) { const d = deg(stack); if (d.poly > 0) { heaps++; offer(d.poly, d.log + 1) } }
  }

  if (py) {
    const stack = []   // { indent, kind }
    for (const raw of code.split('\n')) {
      if (!raw.trim()) continue
      const indent = raw.match(/^\s*/)[0].replace(/\t/g, '    ').length
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      const line = raw.trim()
      const kinds = stack.map(s => s.kind)
      let kind = null
      if (/^(for|while)\b/.test(line)) kind = kindOf(line, code)
      else if (/^loop\b|\.each\b|\.times\b/.test(line)) kind = 'n'
      if (kind) { visit(kinds, line, true, kind); stack.push({ indent, kind }) }
      else visit(kinds, line, false)
      // comprehensions: each extra "for" on a line nests one more loop
      const inline = (line.match(/\bfor\b[^:]*?\bin\b/g) || []).length - (/^for\b/.test(line) ? 1 : 0)
      let k2 = [...kinds, ...(kind ? [kind] : [])]
      for (let i = 0; i < inline; i++) { const kk = kindOf(line, code); visit(k2, '', true, kk); k2 = [...k2, kk] }
    }
  } else {
    const re = /\{|\}|\b(for|while|do|loop)\b|\.(forEach|map|filter|reduce|flatMap|some|every)\s*\(|[^\n{};]*$/gm
    const stack = []        // one entry per open brace: loop kind or null
    let pending = null
    const active = () => stack.filter(Boolean)
    let m
    const tokens = /\{|\}|\b(?:for|while|do|loop)\b|\.(?:forEach|map|filter|reduce|flatMap|some|every)\s*\(/g
    let last = 0
    while ((m = tokens.exec(code))) {
      const chunk = code.slice(last, m.index)
      visit(active(), chunk, false)
      last = m.index + m[0].length
      const t = m[0]
      if (t === '{') stack.push(pending); else if (t === '}') stack.pop()
      if (t === '{') { pending = null; continue }
      if (t === '}') continue
      if (t === 'do' || t === 'loop' || t.startsWith('.')) { pending = 'n'; visit(active(), '', true, 'n'); continue }
      // for / while: read the balanced (...) header
      let i = last; while (i < code.length && code[i] !== '(') { if (!/\s/.test(code[i])) break; i++ }
      let header = ''
      if (code[i] === '(') {
        let depth = 0, j = i
        for (; j < code.length; j++) { if (code[j] === '(') depth++; else if (code[j] === ')' && --depth === 0) break }
        header = code.slice(i, j + 1); tokens.lastIndex = j + 1; last = j + 1
        // "while (cond);" right after a do { } body is the tail of a do-while, not a new loop
        if (t === 'while' && /^\s*;/.test(code.slice(j + 1, j + 6)) && /\}\s*$/.test(code.slice(0, m.index))) continue
      } else header = code.slice(last, code.indexOf('{', last) > -1 ? code.indexOf('{', last) : last + 80)
      const kind = kindOf(`${t} ${header}`, code)
      pending = kind
      visit(active(), '', true, kind)
    }
    visit(active(), code.slice(last), false)
  }

  // Recursion: a function that calls itself.
  const names = new Set()
  for (const re of [/\bdef\s+(\w+)\s*\(/g, /\bfunction\s+(\w+)\s*\(/g, /\bfunc\s+(?:\([^)]*\)\s*)?(\w+)\s*\(/g, /\bfn\s+(\w+)\s*[<(]/g,
    /\b[\w<>\[\],.?*&:]+\s+(\w+)\s*\([^;{)]*\)\s*(?:const\s*)?(?:throws\s+[\w, ]+)?\s*\{/g]) {
    for (const mm of code.matchAll(re)) if (!/^(if|for|while|switch|catch|return|main)$/.test(mm[1])) names.add(mm[1])
  }
  let selfCalls = 0
  for (const n of names) {
    const calls = (code.match(new RegExp(`\\b${n}\\s*\\(`, 'g')) || []).length - 1
    if (calls > 0) selfCalls = Math.max(selfCalls, calls)
  }
  const memo = /\bmemo\b|cache|lru_cache|\bdp\b|\bseen\b|visited|\bmemoize/i.test(code)
  const halves = /\/\s*2|>>\s*1|\bmid\b|\/\/\s*2/.test(code)
  let exp = false
  if (selfCalls >= 2 && !memo) { exp = true; reasons.push('Recursion that branches into 2+ calls with no memoization') }
  else if (selfCalls >= 1) {
    if (selfCalls >= 2) { offer(Math.max(best.poly, 1), best.log); reasons.push('Branching recursion, kept polynomial by memoization') }
    else if (halves && best.poly === 0) { offer(0, 1); reasons.push('Recursion that halves its input') }
    else { offer(Math.max(best.poly, 1), best.log); reasons.push('Recursion makes about n calls') }
  }

  if (maxLoops >= 2) reasons.push(`${maxLoops} nested loops`)
  else if (maxLoops === 1) reasons.push('One loop over the input')
  if (best.log > 0 && !exp && (/\bmid\b/.test(code) || halves)) reasons.push('Halving the search range (binary search)')
  if (sorts) reasons.push('Sorting adds an n log n step')
  if (heaps) reasons.push('Heap / ordered-map operations inside a loop add a log factor')

  const time = label(best.poly, best.log, exp)
  // Space: extra structures sized by the input.
  let space = 'O(1)'
  if (/new\s+\w+(?:<[^>]*>)?\s*\[[^\]]+\]\s*\[|vector\s*<\s*vector|\[\s*\[[^\]]*\]\s*(?:\*|for)|make\(\s*\[\]\[\]|\[\s*\[\s*0/.test(code)) space = 'O(n²)'
  else if (/\bnew\s+\w+(?:<[^>]*>)?\s*(?:\[\s*[A-Za-z_]|\()|(?:vector|unordered_\w+|map|set|deque|stack|queue|priority_queue)\s*<[^;(){}]*>\s+\w+\s*[;=({]|=\s*\[\s*\]|=\s*\{\s*\}|\b(?:dict|set|list|defaultdict|deque|Counter)\s*\(|\bmake\(|Vec::new|vec!|\.append\(|\.push\(|\.push_back\(|\.add\(|\[[^\]]*\bfor\b/.test(code)) space = 'O(n)'
  if (selfCalls >= 1 && space === 'O(1)') space = halves ? 'O(log n)' : 'O(n)'
  return { time, space, reasons, poly: best.poly, log: best.log, exp }
}
