// Company-wise salary data: shaping and filtering for the Salaries pages (the data itself comes from /api/public/salaries).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

export const NORMS = ['SDE-1 / Entry', 'SDE-2', 'SDE-3 / Senior', 'Staff / Principal+']
export const SORTS = [['top', 'Highest pay'], ['low', 'Lowest pay'], ['name', 'Company name']]

let cache
// Kept for the session once it has companies; an empty answer (the server is still loading the data) or a failure is asked again next time.
export const fetchSalaries = () => (cache ||= fetch(`${API_BASE}/public/salaries`)
  .then(r => (r.ok ? r.json() : Promise.reject(new Error('Could not load salaries'))))
  .then(d => { if (!d.companies?.length) cache = undefined; return d })
  .catch(e => { cache = undefined; throw e }))

const num = v => String(Number(v))   // the data says "38.0"; show 38
export const lpa = v => `₹${num(v)} LPA`
export const rangeText = (min, max) => (Number(min) === Number(max) ? lpa(min) : `₹${num(min)} – ₹${num(max)} LPA`)

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
