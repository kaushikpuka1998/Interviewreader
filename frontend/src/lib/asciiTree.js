// Turns an ASCII tree (| and +---+ connectors between labels) into mermaid, or returns null if it does not look like one.
// ponytail: geometry heuristic with ±1 column drift; anything it cannot read confidently stays a plain block.
const BAR = /\+[-+]*>?|-{2,}>?/g
const CAMEL = /[a-z][A-Z]|^[A-Z]{2,}[a-z]/

const ARROW = /^[\svV^]*[vV^][\svV^]*$/   // a row of arrow heads only

function rowLabels(line) {
  if (ARROW.test(line)) return []
  const text = line.replace(BAR, m => ' '.repeat(m.length)).replace(/\|/g, ' ').replace(/\s>\s/g, '   ').replace(/(^|\s)[/\\](?=\s|$)/g, '$1 ')
  const out = []
  for (const m of text.matchAll(/\S+(?: \S+)*/g)) {
    // one space between two CamelCase words (NullPointerException IOException) is two labels
    let start = m.index
    let parts = m[0].split(' ')
    let cur = []
    const flush = () => { if (cur.length) { const s = cur.join(' '); out.push({ text: s, a: start, b: start + s.length - 1 }); start += s.length + 1; cur = [] } }
    parts.forEach(w => { if (cur.length && CAMEL.test(w) && CAMEL.test(cur[cur.length - 1])) flush(); cur.push(w) })
    flush()
  }
  return out.filter(l => !/^[.…]+$/.test(l.text))
}

export function asciiTreeToMermaid(src) {
  const lines = String(src).replace(/\t/g, '    ').replace(/[─━]/g, '-').replace(/[⟶→]/g, '>').split('\n')
  if (lines.length < 4 || !lines.some(l => /^[\s|/\\vV^]*[|/\\][\s|/\\vV^]*$/.test(l) || /\+-+\+/.test(l))) return null
  const rows = lines.map(rowLabels)
  const labels = rows.flatMap((r, y) => r.map(l => Object.assign(l, { y })))
  if (labels.length < 4 || labels.length > 40 || labels.some(l => /[{};=<>]/.test(l.text))) return null

  const at = (y, c) => rows[y]?.find(l => c >= l.a - 1 && c <= l.b + 1)
  const isConn = (y, c) => '|+/\\'.includes(lines[y]?.[c] || ' ') || (ARROW.test(lines[y] || '') && /[vV^]/.test(lines[y][c] || ' '))
  const edges = new Set()
  const parent = new Map()
  const link = (p, ch) => { if (p !== ch && !parent.has(ch)) { parent.set(ch, p); edges.add([p, ch]) } }
  // "Client > Upload API" on one row: a chain
  rows.forEach((r, y) => r.slice(1).forEach((l, i) => { if (lines[y].slice(r[i].b + 1, l.a).trim() === '>') link(r[i], l) }))

  const walk = (p, row, col, seen) => {
    for (let y = row + 1; y < lines.length; y++) {
      const lab = at(y, col)
      if (lab) return link(p, lab)
      const c = [col, col - 1, col + 1].find(k => isConn(y, k))
      if (c === undefined) return
      col = c
      if (lines[y][col] === '+') {
        // "+--> Label": a branch straight off the trunk, which carries on down
        const side = rows[y].find(l => l.a > col && /^-*>?\s*$/.test(lines[y].slice(col + 1, l.a)))
        if (side) link(p, side)
        const key = y + ':' + col
        if (seen.has(key)) return
        seen.add(key)
        // a bar: every other "+" in the run is a branch
        let l = col, r = col
        while (/[-+]/.test(lines[y][l - 1] || '')) l--
        while (/[-+]/.test(lines[y][r + 1] || '')) r++
        for (let k = l; k <= r; k++) if (lines[y][k] === '+' && k !== col) { seen.add(y + ':' + k); walk(p, y, k, seen) }
      }
    }
  }
  for (const p of labels) {
    const seen = new Set()
    for (let c = p.a - 1; c <= p.b + 1; c++) if ('|/\\'.includes(lines[p.y + 1]?.[c] || ' ')) walk(p, p.y, c, seen)
  }
  // stacked siblings: no connector, directly under a label that starts in the same column
  for (const l of labels) {
    if (parent.has(l) || !l.y) continue
    const above = rows[l.y - 1].find(o => Math.abs(o.a - l.a) <= 2)
    if (above && parent.has(above)) link(parent.get(above), l)
  }
  if (edges.size < 3) return null
  const used = new Set([...edges].flat())
  if (labels.filter(l => used.has(l) && !parent.has(l)).length > 2) return null   // too ragged to trust
  const id = new Map(labels.filter(l => used.has(l)).map((l, i) => [l, 'n' + i]))
  const q = t => `"${t.replace(/"/g, '#quot;')}"`
  return ['flowchart TD', ...[...id].map(([l, n]) => `  ${n}[${q(l.text)}]`), ...[...edges].map(([p, c]) => `  ${id.get(p)} --> ${id.get(c)}`)].join('\n')
}

// "User → CDN Edge → Origin" / "User ← CDN Edge" request-and-response lines become a sequence diagram.
// An indented "← Asset" under a chain is the reply (carrying Asset) from that chain's last node to the one before it.
export function arrowFlowToMermaid(src) {
  const names = []
  const out = []
  const part = n => { let i = names.indexOf(n); if (i < 0) i = names.push(n) - 1; return 'P' + i }
  const heads = []
  let prev = [], arrows = 0
  for (const raw of String(src).split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (!/[→←]/.test(line)) {
      if (!/:$/.test(line) || line.length > 60) return null    // prose or code: not a flow
      out.push({ head: line.slice(0, -1) }); prev = []; continue
    }
    const toks = line.split(/\s*([→←])\s*/)                      // [name, arrow, name, ...] (leading "" if it starts with an arrow)
    if (toks.some((t, i) => i % 2 === 0 && t.length > 40) || /[{};=<>]/.test(line)) return null
    if (toks[0] === '') {                                        // reply line
      if (prev.length < 2) return null
      const [last, before] = [prev[prev.length - 1], prev[prev.length - 2]]
      out.push(toks[1] === '←' ? { from: last, to: before, text: toks[2], back: true } : { from: last, to: toks[2], text: 'request' })
      arrows++; continue
    }
    prev = [toks[0]]
    for (let i = 1; i < toks.length; i += 2) {
      const [a, b] = [toks[i - 1], toks[i + 1]]
      if (!a || !b) return null
      out.push(toks[i] === '→' ? { from: a, to: b, text: 'request' } : { from: b, to: a, text: 'response', back: true })
      prev.push(b); arrows++
    }
  }
  if (arrows < 2) return null
  out.forEach(o => { if (o.from) { part(o.from); part(o.to) } })
  const body = out.map(o => o.head
    ? `  Note over ${part(names[0])},${part(names[names.length - 1])}: ${o.head}`
    : `  ${part(o.from)}${o.back ? '-->>' : '->>'}${part(o.to)}: ${o.text}`)
  return ['sequenceDiagram', ...names.map((n, i) => `  participant P${i} as ${n}`), ...body].join('\n')
}

// Actor names on top, "|" lifelines, "|---- msg ---->|" messages and loose text rows (notes) between them.
export function lifelinesToMermaid(src) {
  const lines = String(src).replace(/\t/g, '    ').split('\n').filter(l => l.trim())
  if (lines.length < 4 || lines[0].includes('|') || /[{};=<>]/.test(lines[0])) return null
  const actors = [...lines[0].matchAll(/\S+(?: \S+)*/g)].map(m => ({ name: m[0], a: m.index, b: m.index + m[0].length - 1 }))
  const bars = [...lines[1]].flatMap((c, i) => c === '|' ? [i] : [])
  if (actors.length < 2 || actors.length > 6 || bars.length !== actors.length || lines[1].replace(/[\s|]/g, '')) return null
  // each actor owns the lifeline closest to the middle of its name
  actors.forEach(a => { a.col = bars.reduce((best, c) => Math.abs(c - (a.a + a.b) / 2) < Math.abs(best - (a.a + a.b) / 2) ? c : best) })
  const idOf = col => actors.findIndex(a => Math.abs(a.col - col) <= 1)
  const out = []
  for (const line of lines.slice(1)) {
    const m = line.match(/\|(<?)-+\s*(.*?)\s*-+(>?)\|/)
    if (m && (m[1] || m[3])) {
      const [l, r] = [idOf(m.index), idOf(m.index + m[0].length - 1)]
      if (l < 0 || r < 0) return null
      out.push(m[1] ? `  P${r}-->>P${l}: ${m[2] || 'reply'}` : `  P${l}->>P${r}: ${m[2] || 'message'}`)
      continue
    }
    const flat = line.replace(/\|/g, ' ')
    if (!flat.trim()) continue
    const a = flat.search(/\S/), b = flat.trimEnd().length - 1
    const text = flat.trim().replace(/^X\s+/, '')
    const hit = actors.map((x, i) => i).filter(i => actors[i].col >= a - 1 && actors[i].col <= b + 1)
    const who = hit.length ? hit : [actors.map((x, i) => i).reduce((best, i) => Math.abs(actors[i].col - (a + b) / 2) < Math.abs(actors[best].col - (a + b) / 2) ? i : best, 0)]
    out.push(`  Note over P${who[0]}${who.length > 1 ? `,P${who[who.length - 1]}` : ''}: ${text}`)
  }
  if (!out.some(o => o.includes('>>'))) return null
  return ['sequenceDiagram', ...actors.map((x, i) => `  participant P${i} as ${x.name}`), ...out].join('\n')
}

export const textToMermaid = (body) => lifelinesToMermaid(body) || asciiTreeToMermaid(body) || arrowFlowToMermaid(body)
