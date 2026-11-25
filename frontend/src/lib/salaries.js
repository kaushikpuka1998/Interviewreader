// Company-wise salary data: shaping and filtering for the Salaries pages (the data itself comes from /api/public/salaries).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

export const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
// The common levels, each with its own public page: /salaries/level/<slug> and /salaries/<company>/<slug>.
export const LEVELS = [
  { slug: 'sde-1', norm: 'SDE-1 / Entry', name: 'SDE-1' },
  { slug: 'sde-2', norm: 'SDE-2', name: 'SDE-2' },
  { slug: 'sde-3', norm: 'SDE-3 / Senior', name: 'SDE-3' },
  { slug: 'staff', norm: 'Staff / Principal+', name: 'Staff / Principal' },
]
export const NORMS = LEVELS.map(l => l.norm)
export const levelBySlug = slug => LEVELS.find(l => l.slug === slug)
export const levelOfNorm = norm => LEVELS.find(l => l.norm === norm)
export const segmentBySlug = (segments, slug) => segments.find(x => slugify(x) === slug)

/** Questions and answers about a company's pay (for a level when given); shown on the page and sent to search engines as FAQ data. */
export function faqOf(company, level) {
  const where = level ? `${company.name} ${level.name}` : company.name
  const ls = levelsOf(company, level ? level.norm : '')
  const lo = ls.reduce((a, l) => (l.inr < a.inr ? l : a)), hi = ls.reduce((a, l) => (l.inr > a.inr ? l : a))
  const pay = rangeText(lo.lpa, hi.lpa, 'INR')
  const items = [[`How much does ${where} pay in India?`, `${where} pays a median total of ${pay} a year in India, counting base salary, stock and bonus.`]]
  if (!level && company.levels.length > 1) items.push([`What is the highest paying level at ${company.name}?`, `${company.levels[company.levels.length - 1].level} is the highest reported level at ${company.name}, at a median of ${lpa(company.levels[company.levels.length - 1].lpa, 'INR')} a year.`])
  if (level) items.push([`What experience does a ${where} role need?`, `${ls.map(l => l.yoe && `${l.level} usually needs ${l.yoe}`).filter(Boolean).join('; ') || 'Experience varies by team.'}.`])
  return items
}
export const faqJsonLd = items => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })
export const SORTS = [['top', 'Highest pay'], ['low', 'Lowest pay'], ['name', 'Company name']]

let cache
// Kept for the session once it has companies; an empty answer (the server is still loading the data) or a failure is asked again next time.
export const fetchSalaries = () => (cache ||= fetch(`${API_BASE}/public/salaries`)
  .then(r => (r.ok ? r.json() : Promise.reject(new Error('Could not load salaries'))))
  .then(d => { if (!d.companies?.length) cache = undefined; return d })
  .catch(e => { cache = undefined; throw e }))

// Rupees per unit: approximate fixed rates for a rough comparison, not live exchange rates.
export const CURRENCIES = { INR: { sym: '₹', rate: 1 }, USD: { sym: '$', rate: 88 }, EUR: { sym: '€', rate: 102 }, GBP: { sym: '£', rate: 116 }, AED: { sym: 'AED ', rate: 24 }, SGD: { sym: 'S$', rate: 68 }, CAD: { sym: 'C$', rate: 63 }, AUD: { sym: 'A$', rate: 57 } }
const KEY = 'ir_salary_currency'
let current = 'INR'
try { const c = localStorage.getItem(KEY); if (CURRENCIES[c]) current = c } catch { /* no storage: stay on rupees */ }
export const getCurrency = () => current
export function setCurrency(c) { if (!CURRENCIES[c]) return; current = c; try { localStorage.setItem(KEY, c) } catch { /* ignore */ } }

const trim = n => Number(n.toFixed(2))
// The data says "38.0"; show 38. In rupees 100 LPA and up is crore; in other currencies it is thousands (K) or millions (M).
function amt(v, cur) {
  const n = Number(v)
  if (cur === 'INR') return n >= 100 ? [`₹${trim(n / 100)}`, 'Cr'] : [`₹${n}`, 'LPA']
  const { sym, rate } = CURRENCIES[cur]
  const k = (n * 100000) / rate / 1000   // thousands of the currency
  return k >= 1000 ? [`${sym}${trim(k / 1000)}`, 'M'] : [`${sym}${Math.round(k)}`, 'K']
}
const join = ([a, u]) => (u === 'LPA' || u === 'Cr' ? `${a} ${u}` : `${a}${u}`)
export const lpa = (v, cur = current) => join(amt(v, cur))
export const rangeText = (min, max, cur = current) => {
  const x = amt(min, cur), y = amt(max, cur)
  if (Number(min) === Number(max)) return join(x)
  if (x[1] === y[1]) return cur === 'INR' ? `${x[0]} – ${y[0]} ${y[1]}` : `${x[0]} – ${y[0]}${y[1]}`
  return `${join(x)} – ${join(y)}`
}

/** The levels of a company that are the given common level (all of them when norm is empty). */
export const levelsOf = (company, norm) => (norm ? company.levels.filter(l => l.norm === norm) : company.levels)

/** Lowest and highest pay (LPA text and rupees) among a company's levels, or null when it has none of this level. */
export function spanOf(company, norm = '') {
  const ls = levelsOf(company, norm)
  if (!ls.length) return null
  const lo = ls.reduce((a, l) => (l.inr < a.inr ? l : a)), hi = ls.reduce((a, l) => (l.inr > a.inr ? l : a))
  return { min: lo.lpa, max: hi.lpa, minInr: lo.inr, maxInr: hi.inr, count: ls.length }
}

/** Companies that match the search, segment and level, sorted; each carries the span that was matched. */
export function pick(companies, { q = '', segment = '', norm = '', sort = 'top' }) {
  const needle = q.trim().toLowerCase()
  const rows = []
  for (const c of companies) {
    if (needle && !c.name.toLowerCase().includes(needle)) continue
    if (segment && c.segment !== segment) continue
    const span = spanOf(c, norm)
    if (span) rows.push({ company: c, span })
  }
  const by = { top: (a, b) => b.span.maxInr - a.span.maxInr, low: (a, b) => a.span.minInr - b.span.minInr, name: (a, b) => a.company.name.localeCompare(b.company.name) }
  return rows.sort(by[sort] || by.top)
}

/** Other companies in the same segment with pay close to this one's top level, for the "similar companies" row. */
export function similar(companies, company, n = 6) {
  const top = spanOf(company).maxInr
  return companies.filter(c => c.slug !== company.slug && c.segment === company.segment)
    .sort((a, b) => Math.abs(spanOf(a).maxInr - top) - Math.abs(spanOf(b).maxInr - top)).slice(0, n)
}
