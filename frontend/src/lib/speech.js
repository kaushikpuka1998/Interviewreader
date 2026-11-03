// Read-aloud for answers, using the browser's own speech engine (Web Speech API): no AI service, no cost.
// Markdown is turned into sentences a voice can say. Code and diagrams are skipped silently; tables are read row by
// row with their column names; a "text" block is read when it is words (a flow of steps, a tree, a list of terms)
// rather than code or ASCII art.
// The summary is extractive: the answer's own gist sections, or the opening explanation plus its key points.

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

// Fenced blocks that may hold plain words; every other language (java, sql, json, http, mermaid, ...) is code.
const TEXT_FENCES = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'none', 'md', 'markdown'])
const ARROW_LINE = /^[\s↓↑⬇⬆│|vV^]*$|^\s*(->|=>|→|⟶|-->)\s*$/

const TABLE_ROWS = 12   // longer tables: the first rows, then "and N more rows in the table"

/**
 * A markdown table as sentences, one per row, using the column names so a comparison makes sense when heard:
 *   | Feature | Vertical | Horizontal |   ->   "Comparing Vertical and Horizontal."
 *   | Approach | Scale up | Scale out |  ->   "Approach: Vertical, Scale up; Horizontal, Scale out."
 * Two-column tables read "Key: value". Rows whose cells are code (identifiers, numbers only) are still read as
 * words; empty cells are left out.
 */
function tableSpeech(lines) {
  const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => plain(c.replace(/<br\s*\/?>/gi, ', ')))
  const rows = lines.filter(l => !/^\s*\|?\s*:?-{2,}/.test(l)).map(cells)
  if (rows.length < 2) return rows.length ? [rows[0].filter(Boolean).join(', ')].filter(Boolean).map(t => `${t}.`) : []
  const [head, ...body] = rows
  const out = []
  // "Comparing A and B" only when the column headings are names, not phrases.
  const names = head.slice(1).filter(Boolean)
  const comparison = !head[0] || /^(feature|aspect|criteria|criterion|parameter|factor|dimension|comparison|property|attribute|category|point|basis|area|trait|characteristic)s?$/i.test(head[0])
  if (head.length > 2 && comparison && names.length && names.every(n => n.split(' ').length <= 4)) out.push(`Comparing ${names.join(' and ')}.`)
  for (const row of body.slice(0, TABLE_ROWS)) {
    const [key, ...rest] = row
    if (/^\s*\//.test(key)) continue   // a URL path ("/api/v1/users/**") can't be said usefully
    let text
    if (head.length > 2) {
      const parts = rest.map((v, k) => (v ? (head[k + 1] ? `${head[k + 1]}, ${v}` : v) : '')).filter(Boolean)
      text = key ? `${key}: ${parts.join('; ')}` : parts.join('; ')
    } else text = key && rest[0] ? `${key}: ${rest[0]}` : key || rest[0] || ''
    text = text.replace(/[:;,]\s*$/, '').trim()
    if (/[a-z]{2,}/i.test(text)) out.push(/[.!?]["”']?$/.test(text) ? text : `${text}.`)
  }
  if (body.length > TABLE_ROWS) out.push(`And ${body.length - TABLE_ROWS} more rows in the table.`)
  return out
}

/**
 * A tree ("Server / ├── 4 CPU / └── 16 GB RAM") as "Server: 4 CPU, 16 GB RAM." Several roots become several
 * sentences; deeper levels are listed with the rest.
 */
function treeBlock(body) {
  const groups = []
  for (const raw of body.split('\n')) {
    if (!raw.trim() || /^[\s│|]*$/.test(raw)) continue
    const item = raw.match(/^[\s│|]*[├└][─-]+\s*(.*)$/)
    if (item) {
      if (!groups.length) groups.push({ title: '', items: [] })
      groups[groups.length - 1].items.push(plain(item[1]))
    } else groups.push({ title: plain(raw.replace(/[│|]/g, ' ')), items: [] })
  }
  const said = groups.map(g => {
    const items = g.items.filter(Boolean)
    const text = g.title && items.length ? `${g.title.replace(/[:]\s*$/, '')}: ${items.join(', ')}` : g.title || items.join(', ')
    return text.replace(/[:;,]\s*$/, '')
  }).filter(Boolean)
  if (!said.length || said.some(t => /[┌┐┘┬┴┼═║]/.test(t))) return null
  return said.map(t => (/[.!?]["”']?$/.test(t) ? t : `${t}.`)).join(' ')
}

/**
 * A text block as speech, or null when it isn't words. Arrow lines between steps ("Request ↓ Acquire lock") become
 * "then"; code-like lines (comments, braces, assignments) or box-drawing art mean the block is skipped.
 */
function proseBlock(body) {
  if (/^[\s│|]*[├└][─-]+/m.test(body)) return treeBlock(body)
  const rows = body.split('\n').map(l => l.replace(/[│┃]/g, ' ').trim())
  // Identifiers, URLs and headers aren't words to say: publish_at, https://..., If-Match: 7.
  if (rows.some(l => /\b[a-z0-9]+_[a-z0-9_]+\b|https?:\/\/|^[A-Z][a-z]+(-[A-Z][a-z]+)+:\s/.test(l))) return null
  if (rows.some(l => /[┌┐└┘├┤┬┴┼─═║╔╗╚╝]|^\+[-=+]{3,}|^\s*(\/\/|#!|<\/?\w+[^>]*>|SELECT |INSERT |UPDATE |DELETE |CREATE )/i.test(l))) return null
  if (rows.some(l => !/^\s*O\(/.test(l) && /[{};]\s*$|\w\s*\(.*\)\s*[{;]?$|^\s*\w+\s*=\s*\S/.test(l))) return null
  // A single all-caps word on its own (ROLLBACK, COMMIT) is a code keyword.
  if (/^\s*[A-Z_]{3,}\s*$/.test(body)) return null
  // Side-by-side columns ("Thread A     Thread B") read as a jumble, so skip them.
  if (body.split('\n').filter(l => /\S\s{3,}\S/.test(l.trim())).length >= 2) return null
  const steps = []
  let joinNext = false
  for (const row of rows) {
    if (!row) { joinNext = false; continue }
    if (ARROW_LINE.test(row)) { if (steps.length) joinNext = true; continue }
    // A line that starts with an arrow continues the previous step ("→ free horizontal scaling").
    const lead = row.match(/^\s*(-->|->|=>|→|⟶)\s*/)
    if (lead && steps.length) joinNext = true
    const rest = lead ? row.slice(lead[0].length) : row
    // An arrow inside a line is a step too: "Retry 1 -> wait 100 ms" reads "Retry 1, then wait 100 ms".
    const text = plain(rest.replace(/[✅❌✔✖⚠️|]/g, ' ').replace(/\s*(-->|->|=>|→|⟶)\s*/g, ', then '))
      .replace(/^(,\s*then\s*)+|(,\s*then\s*)+$/g, '').replace(/[:;,]\s*$/, '').trim()
    if (!text) continue
    if (joinNext && steps.length) steps[steps.length - 1].push(text)
    else steps.push([text])
    joinNext = false
  }
  const words = steps.flat().join(' ').split(/\s+/).filter(w => /[a-z]{2,}/i.test(w))
  if (!words.length) return null
  // Each flow becomes a sentence ("A, then B, then C"), in chunks of five steps so no sentence runs too long.
  return steps.flatMap(flow => {
    const out = []
    for (let i = 0; i < flow.length; i += 5) out.push(flow.slice(i, i + 5).join(', then '))
    return out
  }).map(t => (/[.!?]["”']?$/.test(t) ? t : `${t}.`)).join(' ')
}

// Inline markdown to plain words.
function plain(s) {
  return String(s || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')          // links -> their text
    .replace(/<[^>]+>/g, ' ')                         // html tags
    .replace(/`+([^`]*)`+/g, '$1')                    // inline code
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')       // bold, italic, strike
    .replace(/\s*->\s*|\s*=>\s*|\s*→\s*/g, ' to ')     // arrows read as "to"
    .replace(/\be\.g\.,?/gi, 'for example,')                 // spoken forms of common abbreviations
    .replace(/\bi\.e\.,?/gi, 'that is,')
    .replace(/\betc\./gi, 'and so on.')
    .replace(/\bvs\.?(?=\s)/gi, 'versus')
    .replace(/\bO\(([^)]+)\)/g, 'O of $1')              // O(n log n) -> O of n log n
    .replace(/\s\+\s/g, ' and ')                         // persistence + delivery
    .replace(/(?<![\/\w])([A-Za-z]+)\/([A-Za-z]+)(?![\/\w])/g, '$1 or $2')   // CPU/RAM -> CPU or RAM (not /api/v1 paths)
    .replace(/\b([a-z][a-z0-9]*)_([a-z0-9_]+)\b/g, (m, a, b) => `${a} ${b.replace(/_/g, ' ')}`)   // expires_at -> expires at
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Markdown -> blocks: { kind: 'heading' | 'para' | 'item' | 'note', text, lead, level }.
 * "lead" is a list item's term (the bold part, or the text before " - " / ":"), used by the summary; "level" is a
 * heading's depth (1 for #). A table of contents (a "Contents" heading, or list items that only link to sections)
 * is left out: read aloud it is just a list of headings.
 */
export function blocks(md) {
  const out = []
  const lines = String(md || '').replace(/\r/g, '').split('\n')
  let para = []
  let inContents = false
  const flush = () => { if (para.length) { if (!inContents) out.push({ kind: 'para', text: plain(para.join(' ')) }); para = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = line.match(/^\s*```\s*([\w-]*)/)
    if (fence) {
      flush()
      const body = []
      while (i + 1 < lines.length && !/^\s*```/.test(lines[i + 1])) body.push(lines[++i])
      i++
      // Code is skipped silently; a text block that is words is read like a paragraph.
      const spoken = !inContents && TEXT_FENCES.has(fence[1].toLowerCase()) ? proseBlock(body.join('\n')) : null
      if (spoken) out.push({ kind: 'para', text: spoken, fenced: true })
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush()
      const rows = [line]
      while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) rows.push(lines[++i])
      if (!inContents) for (const text of tableSpeech(rows)) out.push({ kind: 'para', text, table: true })
      continue
    }
    const h = line.match(/^\s*#{1,6}\s+(.+)/)
    if (h) {
      flush()
      inContents = /^\s*(table of contents|contents|toc|outline)\s*:?\s*$/i.test(plain(h[1]))
      if (!inContents) out.push({ kind: 'heading', text: plain(h[1]), level: line.match(/#+/)[0].length })
      continue
    }
    const li = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)/)
    if (li) {
      flush()
      const raw = li[1]
      if (inContents || /^\s*\[[^\]]+\]\(#[^)]*\)\s*$/.test(raw)) continue   // a table-of-contents entry
      const bold = raw.match(/^\s*\*\*([^*]+)\*\*/)
      const text = plain(raw)
      const lead = bold ? plain(bold[1]).replace(/[:\-–]\s*$/, '') : (text.match(/^(.{2,60}?)\s+[-–:]\s+/) || [])[1]
      out.push({ kind: 'item', text, lead })
      continue
    }
    if (/^\s*(---+|\*\*\*+|>\s*)$/.test(line)) { flush(); continue }
    if (!line.trim()) { flush(); continue }
    para.push(line.replace(/^\s*>\s?/, ''))
  }
  flush()
  return out.filter(b => b.text)
}

// A sentence ends at . ! ? followed by a capital letter, a digit or a quote: "v1.2" and "Node.js" don't split.
const sentences = text => String(text).split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map(s => s.trim()).filter(Boolean)
const end = s => { const t = s.replace(/[:;,]\s*$/, ''); return /[.!?…]["”']?$/.test(t) ? t : `${t}.` }

/** The full answer as sentences to speak, starting with the question. */
export function fullScript(title, md) {
  const out = [end(plain(title))]
  for (const b of blocks(md)) {
    if (b.kind === 'heading') out.push(end(b.text))
    else out.push(...sentences(b.text).map(end))
  }
  return out
}

// The blocks under the first heading matching `re`, up to the next heading at the same or a higher level.
function section(bs, re) {
  const i = bs.findIndex(b => b.kind === 'heading' && re.test(b.text))
  if (i < 0) return []
  const level = bs[i].level
  const out = []
  for (let j = i + 1; j < bs.length && !(bs[j].kind === 'heading' && bs[j].level <= level); j++) if (bs[j].kind !== 'heading') out.push(bs[j])
  return out
}
const said = bs => bs.filter(b => b.kind === 'para' || b.kind === 'item').flatMap(b => sentences(b.text)).map(end)

/**
 * The gist, in about a minute. Long answers usually carry one already, so it is used when present:
 *   1. the "One-line answer" and the "90-second answer" sections;
 *   2. else the one-line answer plus the points of a Summary / Key takeaways / Cheat sheet section;
 *   3. else the opening explanation plus up to six key points (list-item terms, or headings when there are no lists).
 */
export function summaryScript(title, md) {
  const bs = blocks(md)
  const out = [end(plain(title))]
  const oneLine = said(section(bs, /one[- ]line/i)).slice(0, 2)
  const spoken = said(section(bs, /\b(90|60|30)[- ]second|\b(1|2|one|two)[- ]minute (answer|pitch|summary)|elevator pitch/i))
  if (spoken.length) return [...out, ...oneLine.filter(s => !spoken.includes(s)), ...spoken.slice(0, 14)]
  const recap = said(section(bs, /\b(summary|key takeaways|takeaways|tl;?dr|in short|recap|conclusion|cheat ?sheet)\b/i))
  if (recap.length) return [...out, ...oneLine, ...recap.filter(s => !oneLine.includes(s)).slice(0, 8)]
  if (oneLine.length) out.push(...oneLine)
  const intro = bs.find(b => b.kind === 'para')
  // An opening line that only introduces the list ("The four principles are:") adds nothing when spoken.
  if (intro && !/:\s*$/.test(intro.text)) out.push(...sentences(intro.text).slice(0, 2).map(end))
  const items = bs.filter(b => b.kind === 'item')
  let points = items.map(b => (b.lead ? `${b.lead}: ${sentences(b.text.slice(b.text.indexOf(b.lead) + b.lead.length).replace(/^\s*[-–:]\s*/, ''))[0] || ''}` : sentences(b.text)[0]))
    .map(s => s.replace(/:\s*$/, '').trim()).filter(Boolean)
  if (points.length < 2) points = bs.filter(b => b.kind === 'heading').map(b => b.text)
  points = points.slice(0, 6).map(s => (s.length > 160 ? `${s.slice(0, 157).replace(/\s+\S*$/, '')}…` : s))
  if (points.length) {
    out.push(points.length === 1 ? 'The key point.' : `Here are the ${points.length} key points.`)
    points.forEach((p, i) => out.push(end(`${i + 1}. ${p}`)))
  }
  return out
}

/** The clearest English voice available: Google or natural voices first, Indian English and US English preferred. */
export function pickVoice() {
  const voices = window.speechSynthesis.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang))
  const score = v => (/google|natural|premium|enhanced/i.test(v.name) ? 4 : 0) + (/en[-_]IN/i.test(v.lang) ? 2 : 0) + (/en[-_]US/i.test(v.lang) ? 1 : 0)
  return voices.sort((a, b) => score(b) - score(a))[0] || null
}

// ---------- following along in the answer ----------

const norm = s => String(s || '').toLowerCase().replace(/e\.g\.,?/g, 'for example').replace(/i\.e\.,?/g, 'that is')
  .replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * The element of the rendered answer that a spoken sentence comes from, so it can be highlighted and scrolled to.
 * Searches forward from the last match (answers repeat words), falling back to the whole answer.
 * `state` is { last: index into the block list } kept between calls.
 */
export function findSpoken(root, sentence, state) {
  if (!root) return null
  const els = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,tr')]
  const from = state.last ?? -1
  const after = (pred) => {
    for (let i = from + 1; i < els.length; i++) if (pred(els[i])) return i
    for (let i = 0; i <= from && i < els.length; i++) if (pred(els[i])) return i
    return -1
  }
  let i = -1
  // Summary key points read "2. Lead: text": match on the text, else on the lead. Words the speech adds
  // ("then" between the steps of a flow) aren't on the page; a 3-word key catches lines where arrows became "to".
  const body = sentence.replace(/^\d+\.\s*/, '')
  const parts = body.includes(': ') ? [body.slice(body.indexOf(': ') + 2), body.slice(0, body.indexOf(': '))] : [body]
  // A table row reads "Key: Column, value; Column, value": find the row by its first cell before anything else.
  if (/^[^:]{1,60}: [^;]+, [^;]+;/.test(body)) {
    const key = norm(body.slice(0, body.indexOf(':')))
    if (key) i = after(el => el.tagName === 'TR' && norm(el.firstElementChild?.textContent) === key)
  }
  for (const part of i >= 0 ? [] : parts) {
    const words = norm(part).split(' ').filter(w => w && w !== 'then')
    if (words.length < 2 && parts.length > 1) continue
    for (const n of [6, 3]) {
      const key = words.slice(0, Math.min(n, words.length)).join(' ')
      if (key) i = after(el => norm(el.textContent).includes(key))
      if (i >= 0) break
    }
    if (i >= 0) break
  }
  if (i < 0) return null
  // Elements are in page order, so a list item matches before the paragraph inside it: the whole item lights up.
  state.last = i
  return els[i]
}
