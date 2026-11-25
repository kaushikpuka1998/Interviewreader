// The compensation post template (the format people know from LeetCode's Compensation board):
// "Company | Level | Location | Total" as the title, and a fixed block of facts followed by the pay breakdown.

export const CURRENCIES = {
  INR: { sym: '₹', unit: 'LPA', hint: 'in lakhs per year, e.g. 28' },
  USD: { sym: '$', unit: 'K', hint: 'in thousands per year, e.g. 150' },
  EUR: { sym: '€', unit: 'K', hint: 'in thousands per year, e.g. 90' },
  GBP: { sym: '£', unit: 'K', hint: 'in thousands per year, e.g. 85' },
}
export const STATUSES = ['Offer', 'Current employee', 'Negotiated offer', 'Declined offer']

const num = v => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
const trim = n => String(Math.round(n * 100) / 100)

export function fmtMoney(cur, n) {
  const c = CURRENCIES[cur] || CURRENCIES.INR
  return `${c.sym}${trim(n)}${c.unit === 'LPA' ? ' LPA' : c.unit}`
}

/** Yearly total: base + stock per year + bonus (the joining bonus is one-time, so it stays out). */
export const compTotal = f => num(f.base) + num(f.stock) + num(f.bonus)

export function compTitle(f) {
  const total = compTotal(f)
  return [f.company, f.level || f.role, f.location, total ? fmtMoney(f.cur, total) : ''].map(x => (x || '').trim()).filter(Boolean).join(' | ')
}

export function compBody(f) {
  const line = (k, v) => (String(v ?? '').trim() ? `**${k}:** ${String(v).trim()}` : '')
  const money = (label, v) => (num(v) ? `- ${label}: ${fmtMoney(f.cur, num(v))}` : '')
  const total = compTotal(f)
  const facts = [
    line('Status', f.status), line('Company', f.company),
    line('Position', [f.role, f.level && `(${f.level.trim()})`].filter(Boolean).join(' ')),
    line('Location', f.location), line('Education', f.education), line('Years of experience', f.yoe),
  ].filter(Boolean)
  const pay = [money('Base', f.base), money('Stock / RSUs (per year)', f.stock), money('Bonus', f.bonus), money('Joining bonus (one-time)', f.joining),
    total ? `- **Total (per year): ${fmtMoney(f.cur, total)}**` : ''].filter(Boolean)
  return [facts.join('\n'), pay.length ? `**Compensation**\n${pay.join('\n')}` : '', line('Benefits and notes', f.notes)].filter(Boolean).join('\n\n')
}

/** Reads a template post back into parts for display: { facts: [[label, value]], pay: [line], source, notes }, or null for any other post. */
export function parseCompBody(body) {
  if (!/^\*\*(Status|Company):\*\*/.test(body || '')) return null
  const facts = [], pay = []
  let source = '', notes = ''
  for (const block of body.split(/\n\n+/)) {
    const lines = block.split('\n')
    if (/^\*\*Compensation\*\*/.test(lines[0])) { pay.push(...lines.slice(1).map(l => l.replace(/^- /, ''))); continue }
    for (const l of lines) {
      const m = l.match(/^\*\*(.+?):\*\*\s*(.*)$/)
      if (!m) continue
      if (m[1] === 'Source') source = m[2]
      else if (m[1] === 'Status' && m[2] === 'Reported median') continue   // imported posts once carried this line; it says nothing the Imported tag does not
      // Imported posts once carried a boilerplate note with a source link; posts stored from that version must not show it.
      else if (m[1] === 'Benefits and notes') notes = /^Median of reported submissions/.test(m[2]) ? '' : m[2]
      else facts.push([m[1], m[2]])
    }
  }
  return { facts, pay, source, notes }
}

/** One plain line for the feed card: "Software Engineer: SSE (SDE-2) · India · 4-5 years", or the text itself for other posts. */
export function bodyPreview(body) {
  const p = parseCompBody(body)
  if (!p) return body
  const get = k => p.facts.find(([l]) => l === k)?.[1]
  return [get('Position'), get('Location'), get('Typical experience') || get('Years of experience')].filter(Boolean).join(' · ')
}

/** "**bold**" and "[text](url)" in a template line, as parts: { text, bold } or { text, href }. */
export function inlineParts(s) {
  return String(s).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/).filter(Boolean).map(t => {
    const b = t.match(/^\*\*([^*]+)\*\*$/); if (b) return { text: b[1], bold: true }
    const a = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/); if (a) return { text: a[1], href: a[2] }
    return { text: t }
  })
}
