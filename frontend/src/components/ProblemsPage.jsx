import { useEffect, useMemo, useRef, useState } from 'react'
import Loader from './Loader.jsx'
import { setPageSeo } from '../lib/seo.js'
import TopBar from './TopBar.jsx'
import AuthModal from './AuthModal.jsx'
import PremiumToast from './PremiumToast.jsx'
import { fetchCodingProblems, fetchCompanies } from '../lib/codingProblems.js'
import { fetchSolvedIds, fetchAttemptedIds } from '../lib/code.js'
import { isLoggedIn, getUser } from '../lib/auth.js'
import { difficultyBadge } from '../lib/badges.js'
import OnlineCount from './OnlineCount.jsx'
import { COMPANY_GROUPS, OTHER, groupOf } from '../lib/companyGroups.js'

const DIFFICULTIES = ['All', 'Basic', 'Intermediate', 'Advanced']
const STATUSES = [['all', 'All'], ['solved', 'Solved'], ['todo', 'Not solved']]

// Every coding problem on one page, with search and filters. Each row opens the problem in the practice page.
export default function ProblemsPage() {
  const [authOpen, setAuthOpen] = useState(() => !isLoggedIn())
  const [problems, setProblems] = useState(null)
  const [solved, setSolved] = useState(() => new Set())
  const [attempted, setAttempted] = useState(() => new Set())
  const [error, setError] = useState('')
  // Coding problems are free, but only a few companies work as a filter without Premium; the server says which ones.
  const [freeCompanies, setFreeCompanies] = useState(null)   // null until known: nothing is locked then
  const [toast, setToast] = useState('')
  const me = getUser()
  const isPremium = !!(me && (me.premium || me.admin))
  useEffect(() => { fetchCompanies().then(l => setFreeCompanies(new Set(l.filter(c => c.free).map(c => c.name)))).catch(() => {}) }, [])
  const isLocked = c => !isPremium && freeCompanies != null && freeCompanies.size > 0 && !freeCompanies.has(c)
  const pickCompany = c => { if (c && isLocked(c)) { setToast(`${c} is a Premium company filter. Go Premium to filter problems by any company; ${[...freeCompanies].join(', ')} stay free.`); return } setCompany(c) }
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('All')
  const [status, setStatus] = useState('all')
  const urlParams = new URLSearchParams(window.location.search)
  const [topic, setTopic] = useState(urlParams.get('topic') || '')   // '' = all topics
  const [company, setCompany] = useState(urlParams.get('company') || '')   // '' = all companies
  // Company type filter: group (product / service / gcc / startups / other) and optional sub-group (faang, big4, ...).
  const [group, setGroup] = useState(urlParams.get('group') || '')
  const [subgroup, setSubgroup] = useState(urlParams.get('sub') || '')
  const pickGroup = g => { setGroup(g); setSubgroup(''); setCompany('') }
  const pickSubgroup = sg => { setSubgroup(sg); setCompany('') }
  // Rows are drawn 50 at a time; a sentinel below the list loads the next batch as it nears the screen.
  const CHUNK = 50
  const [shownCount, setShownCount] = useState(CHUNK)
  const sentinel = useRef(null)
  const signedIn = isLoggedIn()

  useEffect(() => {
    fetchCodingProblems().then(setProblems).catch(e => setError(e.message))
    if (signedIn) {
      fetchSolvedIds().then(ids => setSolved(new Set(ids))).catch(() => {})
      fetchAttemptedIds().then(ids => setAttempted(new Set(ids))).catch(() => {})
    }
  }, [])

  // Rows are numbered by their position in the list (1, 2, 3...), not by database id.
  const numberOf = useMemo(() => new Map((problems || []).map((p, i) => [p.id, i + 1])), [problems])

  // Topics with how many problems each has, biggest first. A problem counts under every topic it has.
  const topicCounts = useMemo(() => {
    const m = new Map()
    for (const p of problems || []) for (const t of p.topics || []) m.set(t, (m.get(t) || 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [problems])

  const companyCounts = useMemo(() => {
    const m = new Map()
    for (const p of problems || []) for (const c of p.companies || []) m.set(c, (m.get(c) || 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [problems])

  // A problem matches a group/sub-group when any company that asked it belongs there.
  const inGroup = (p, key, id) => (p.companies || []).some(c => groupOf(c)[key] === id)

  // Groups and sub-groups that actually have problems, with problem counts; "Other" only if something lands there.
  const groupTabs = useMemo(() => {
    if (!problems) return []
    const tabs = [...COMPANY_GROUPS, { ...OTHER, subgroups: [] }].map(g => ({
      ...g,
      count: problems.filter(p => inGroup(p, 'group', g.id)).length,
      subgroups: g.subgroups
        .map(sg => ({ ...sg, count: problems.filter(p => inGroup(p, 'subgroup', sg.id)).length }))
        .filter(sg => sg.count > 0),
    }))
    return tabs.filter(g => g.count > 0)
  }, [problems])
  const activeGroup = groupTabs.find(g => g.id === group)

  // Company dropdown: only the companies in the chosen group / sub-group, under one heading per sub-group.
  const companyOptions = useMemo(() => {
    const counts = new Map(companyCounts)
    const sections = []
    for (const g of [...COMPANY_GROUPS, { ...OTHER, subgroups: [{ ...OTHER, label: 'Other' }] }]) {
      if (group && g.id !== group) continue
      for (const sg of g.subgroups) {
        if (subgroup && sg.id !== subgroup) continue
        const list = g.id === OTHER.id
          ? companyCounts.filter(([c]) => groupOf(c).group === OTHER.id)
          : sg.companies.filter(c => counts.has(c)).map(c => [c, counts.get(c)]).sort((a, b) => b[1] - a[1])
        if (list.length) sections.push({ label: group ? sg.label : `${g.label} · ${sg.label}`, list })
      }
    }
    // The free companies come first in their own section (when Premium is not active), so non-members see what they can open at the top.
    if (!isPremium && freeCompanies && freeCompanies.size) {
      const free = []
      for (const sec of sections) {
        sec.list = sec.list.filter(([c, n]) => { if (freeCompanies.has(c)) { free.push([c, n]); return false } return true })
      }
      free.sort((x, y) => y[1] - x[1])
      return [...(free.length ? [{ label: 'Free companies', list: free }] : []), ...sections.filter(sec => sec.list.length)]
    }
    return sections
  }, [companyCounts, group, subgroup, freeCompanies, isPremium])

  const rows = useMemo(() => {
    if (!problems) return []
    const q = query.trim().toLowerCase().replace(/^#/, '')
    return problems.filter(p => {
      if (difficulty !== 'All' && p.difficulty !== difficulty) return false
      if (topic && !(p.topics || []).includes(topic)) return false
      if (company && !(p.companies || []).includes(company)) return false
      if (!company && subgroup && !inGroup(p, 'subgroup', subgroup)) return false
      if (!company && !subgroup && group && !inGroup(p, 'group', group)) return false
      if (status === 'solved' && !solved.has(p.id)) return false
      if (status === 'todo' && solved.has(p.id)) return false
      if (!q) return true
      return p.title.toLowerCase().includes(q) || String(numberOf.get(p.id)) === q
    })
  }, [problems, query, difficulty, status, topic, company, group, subgroup, solved, numberOf])

  // Company and company-type views are their own landing pages ("Google coding interview questions"):
  // keep them in the URL so they can be shared and indexed, each with its own title and canonical.
  useEffect(() => {
    const p = new URLSearchParams()
    if (company) p.set('company', company)
    else if (group) { p.set('group', group); if (subgroup) p.set('sub', subgroup) }
    const qs = p.toString()
    const next = '/problems' + (qs ? `?${qs}` : '')
    if (next !== window.location.pathname + window.location.search) window.history.replaceState({}, '', next)

    const label = company
      || (subgroup && groupTabs.find(g => g.id === group)?.subgroups.find(sg => sg.id === subgroup)?.label)
      || (group && groupTabs.find(g => g.id === group)?.label)
    const n = problems ? rows.length : 0
    const title = label
      ? `${label} Coding Interview Questions${n ? ` (${n} problems)` : ''} | Interview Reader`
      : 'Coding Problems in 11 Languages | Interview Reader'
    const description = label
      ? `Practice ${n ? n.toLocaleString() + ' ' : ''}coding problems asked in ${label} interviews: arrays, strings, trees, graphs and DP. Run your solution online in Java, Python, C++, Go and more.`
      : 'Practice 2,500+ coding interview problems on arrays, strings, trees, graphs and DP. Write and run solutions online in Java, Python, C++, Go and more.'
    setPageSeo({ title, description, path: next, jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: next } })
  }, [company, group, subgroup, groupTabs, problems && rows.length])

  useEffect(() => { setShownCount(CHUNK) }, [query, difficulty, status, topic, company, group, subgroup])
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setShownCount(c => c + CHUNK) }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [rows.length, shownCount])

  const segment = (items, active, onPick, label) => (
    <div className="inline-flex flex-wrap rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800" role="group" aria-label={label}>
      {items.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(key)}
          aria-pressed={active === key}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active === key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )

  if (!isLoggedIn()) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
        <TopBar />
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              ✎
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sign in to View Problems</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Please sign in to access the coding problems list and practice coding.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Sign In or Register
              </button>
              <a
                href="/"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Back to Home
              </a>
            </div>
          </div>
        </div>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
        {toast && <PremiumToast message={toast} onClose={() => setToast('')} />}
      </div>
    )
  }

  return (
    <>
      <TopBar />
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-100">Problems</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {problems ? (rows.length === problems.length ? `${problems.length.toLocaleString()} coding problems` : `Showing ${rows.length.toLocaleString()} of ${problems.length.toLocaleString()} problems`) : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <OnlineCount />
            <a href="/practice" className="text-blue-600 hover:underline dark:text-blue-400">Practice coding</a>
            <a href="/" className="text-blue-600 hover:underline dark:text-blue-400">← Back to app</a>
          </div>
        </div>

        <div className="mb-4 space-y-3 rounded-2xl bg-white p-4 dark:bg-slate-950">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title or number, e.g. Two Sum or #1"
            aria-label="Search problems"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {topicCounts.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
              {topicCounts.map(([t, n]) => (
                <button
                  key={t} type="button" aria-pressed={topic === t}
                  onClick={() => setTopic(topic === t ? '' : t)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${topic === t ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-blue-300'}`}
                >
                  {t} <span className={topic === t ? 'text-blue-100' : 'text-slate-400'}>{n}</span>
                </button>
              ))}
            </div>
          )}
          {groupTabs.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Company type">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Company type</span>
                {[{ id: '', label: 'All', count: problems.length }, ...groupTabs].map(g => (
                  <button
                    key={g.id || 'all'} type="button" aria-pressed={group === g.id}
                    onClick={() => pickGroup(g.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${group === g.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                  >
                    {g.label} <span className={group === g.id ? 'text-blue-100' : 'text-slate-400'}>{g.count}</span>
                  </button>
                ))}
              </div>
              {activeGroup && activeGroup.subgroups.length > 1 && (
                <div className="flex flex-wrap gap-2 border-l-2 border-blue-200 pl-3 dark:border-blue-900" role="group" aria-label={`${activeGroup.label} tiers`}>
                  {[{ id: '', label: `All ${activeGroup.label}`, count: activeGroup.count }, ...activeGroup.subgroups].map(sg => (
                    <button
                      key={sg.id || 'all'} type="button" aria-pressed={subgroup === sg.id}
                      onClick={() => pickSubgroup(sg.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${subgroup === sg.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-blue-300'}`}
                    >
                      {sg.label} <span className={subgroup === sg.id ? 'text-blue-100' : 'text-slate-400'}>{sg.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {segment(DIFFICULTIES.map(d => [d, d]), difficulty, setDifficulty, 'Difficulty')}
            {signedIn && segment(STATUSES, status, setStatus, 'Status')}
            {companyCounts.length > 0 && (
              <select
                value={company} onChange={e => pickCompany(e.target.value)} aria-label="Company"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">{subgroup ? `All ${activeGroup?.subgroups.find(s => s.id === subgroup)?.label || ''} companies` : activeGroup ? `All ${activeGroup.label} companies` : 'All companies'}</option>
                {companyOptions.map(sec => (
                  <optgroup key={sec.label} label={sec.label}>
                    {sec.list.map(([c, n]) => <option key={c} value={c}>{isLocked(c) ? '🔒 ' : ''}{c} ({n})</option>)}
                  </optgroup>
                ))}
              </select>
            )}
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!problems && !error && <Loader label="Loading problems…" />}
        {problems && rows.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">No problems match these filters.</p>}

        {rows.length > 0 && (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white dark:divide-slate-800 dark:bg-slate-950">
            {rows.slice(0, shownCount).map(p => (
              <li key={p.id}>
                <a href={`/practice?id=${p.id}`} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span className="w-12 shrink-0 text-slate-400 dark:text-slate-500">#{numberOf.get(p.id)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">{p.title}</span>
                  {signedIn && solved.has(p.id) && <span aria-label="Solved" className="text-emerald-600 dark:text-emerald-400">✓</span>}
                  {signedIn && !solved.has(p.id) && attempted.has(p.id) && <span aria-label="Attempted" className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />}
                  <span className="hidden shrink-0 gap-1 md:flex">
                    {(p.topics || []).slice(0, 3).map(t => <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t}</span>)}
                  </span>
                  {p.difficulty && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${difficultyBadge(p.difficulty)}`}>{p.difficulty}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
        {rows.length > shownCount && <div ref={sentinel} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading more…</div>}
      </div>
    </div>
    {toast && <PremiumToast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
