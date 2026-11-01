import { useEffect, useMemo, useRef, useState } from 'react'
import Loader from './Loader.jsx'
import { setPageSeo } from '../lib/seo.js'
import TopBar from './TopBar.jsx'
import { fetchCodingProblems, fetchCodingProblem, markPracticeSeen } from '../lib/codingProblems.js'
import { fetchSubmissions, fetchSolvedIds, fetchAttemptedIds } from '../lib/code.js'
import { getUser, isLoggedIn } from '../lib/auth.js'
import { difficultyBadge } from '../lib/badges.js'
import Markdown from './Markdown.jsx'
import AuthModal from './AuthModal.jsx'
import OnlineCount from './OnlineCount.jsx'
import CodeRunner, { languageLabel } from './CodeRunner.jsx'
import { byProminence } from '../lib/companyGroups.js'

const CUSTOM = 'custom'
const NAV_BTN = 'tip relative flex h-8 w-8 shrink-0 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'

// Practice coding: LeetCode-style problems on the left, plus a free code box for writing your own program.
export default function PracticePage() {
  const practiceSeo = () => setPageSeo({ title: 'Practice Coding Online in 11 Languages | Interview Reader', description: 'Solve coding interview problems in an online editor and run them against test cases in Java, Python, C++, Go, JavaScript and 6 more languages.', path: '/practice', jsonLd: undefined })
  useEffect(() => { practiceSeo() }, [])
  const [problems, setProblems] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const CHUNK = 50
  const [shownCount, setShownCount] = useState(CHUNK)
  const [selected, setSelected] = useState(null)   // CUSTOM, or a problem id
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  // The statement panel has three tabs: the problem, question analysis, and submissions.
  const [tab, setTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t === 'analysis' || t === 'submissions') return t
    }
    return 'description'
  })
  const [history, setHistory] = useState([])
  const [openRequest, setOpenRequest] = useState(null)
  // Progress for the signed-in member, and the list's search and filters.
  const [solvedIds, setSolvedIds] = useState(() => new Set())
  const [attemptedIds, setAttemptedIds] = useState(() => new Set())
  const [listQuery, setListQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      return p.get('search') || p.get('q') || ''
    }
    return ''
  })
  const [listDifficulty, setListDifficulty] = useState('All')
  const [listStatus, setListStatus] = useState('all')
  const [authOpen, setAuthOpen] = useState(false)
  // The top bar's Run and Submit call the code box through codeRef, and the code box reports whether it is busy.
  const codeRef = useRef(null)
  const selectedRef = useRef(null)
  const [busy, setBusy] = useState(false)
  // The problem list can be collapsed to give the statement and the code box more room. The choice is remembered.
  // Always starts collapsed; the member opens it when they want it. Not remembered between visits.
  const [listOpen, setListOpen] = useState(false)
  // Width of the statement panel, as a percent of the row. Drag the divider to change it; the choice is remembered.
  const [split, setSplit] = useState(() => Number(localStorage.getItem('ir_practice_split')) || 38)
  const splitRef = useRef(null)
  const startDrag = e => {
    e.preventDefault()
    const move = ev => {
      const rect = splitRef.current.getBoundingClientRect()
      setSplit(Math.min(70, Math.max(25, ((ev.clientX - rect.left) / rect.width) * 100)))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setSplit(value => { localStorage.setItem('ir_practice_split', String(Math.round(value))); return value })
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  const refreshProgress = () => {
    if (!isLoggedIn()) return
    fetchSolvedIds().then(ids => setSolvedIds(new Set(ids))).catch(() => {})
    fetchAttemptedIds().then(ids => setAttemptedIds(new Set(ids))).catch(() => {})
  }
  useEffect(refreshProgress, [])

  // solved beats attempted; everything else is not attempted yet.
  const statusOf = id => (solvedIds.has(id) ? 'solved' : attemptedIds.has(id) ? 'attempted' : 'todo')
  // Numbered by position in the full list, as on ProblemsPage, so a problem keeps one number on both pages.
  const numberOf = new Map((problems || []).map((p, i) => [p.id, i + 1]))
  const visibleProblems = (problems || []).filter(p => {
    const q = listQuery.trim().toLowerCase().replace(/^#/, '')
    if (listDifficulty !== 'All' && p.difficulty !== listDifficulty) return false
    if (listStatus !== 'all' && statusOf(p.id) !== listStatus) return false
    return !q || p.title.toLowerCase().includes(q) || String(numberOf.get(p.id)) === q
  })

  // Rows are drawn 50 at a time as the list is scrolled; filters start again from the top.
  useEffect(() => { setShownCount(CHUNK) }, [listQuery, listDifficulty, listStatus])
  const selectedIdx = visibleProblems.findIndex(p => p.id === selected)
  const renderCount = Math.max(shownCount, selectedIdx + 1)
  const onListScroll = e => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) setShownCount(c => (c < visibleProblems.length ? c + CHUNK : c))
  }

  const loadHistory = () => { if (detail && isLoggedIn()) fetchSubmissions(detail.id).then(setHistory).catch(() => {}) }
  // ?tab=... from the link the page was opened with. Read once: the URL is rewritten to /practice?id=N as soon as
  // a problem is selected, before its details load, so re-reading it later would always miss the tab.
  const requestedTab = useRef(typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null)
  useEffect(() => {
    const t = requestedTab.current
    if (detail) requestedTab.current = null   // only the first problem opened from the link gets it
    // ?tab=analysis only applies when this problem actually has an analysis.
    setTab(t === 'analysis' && detail?.analysis ? 'analysis' : t === 'submissions' ? 'submissions' : 'description')
    setHistory([])
    setOpenRequest(null)
    if (detail) loadHistory()
  }, [detail?.id])
  // Previous, next and random move through the problem list. The Playground is not in the list, so these are off there.
  const currentIndex = problems ? problems.findIndex(p => p.id === selected) : -1

  // "Solve next" after an accepted submission: a difficulty ladder inside the problem's most specific topic
  // (Tree rather than Array): one at the same level, one a level up, one a challenge. Solving an easy tree
  // problem suggests easy -> medium -> hard tree problems. Uses the list already loaded, so it costs no request.
  const topicSizes = useMemo(() => {
    const m = new Map()
    for (const p of problems || []) for (const t of p.topics || []) m.set(t, (m.get(t) || 0) + 1)
    return m
  }, [problems])
  const solveNext = useMemo(() => {
    const current = problems?.find(p => p.id === selected)
    if (!current || !(current.topics || []).length) return []
    const LEVELS = ['Basic', 'Intermediate', 'Advanced']
    const myLevel = Math.max(0, LEVELS.indexOf(current.difficulty))
    const focus = [...current.topics].sort((a, b) => (topicSizes.get(a) || 0) - (topicSizes.get(b) || 0))[0]
    const myTopics = new Set(current.topics)
    const myCompanies = new Set(current.companies || [])
    const pool = problems
      .filter(p => p.id !== current.id && !solvedIds.has(p.id))
      .map(p => ({
        p,
        level: Math.max(0, LEVELS.indexOf(p.difficulty)),
        inFocus: (p.topics || []).includes(focus),
        shared: (p.topics || []).filter(t => myTopics.has(t)).length,
        companies: (p.companies || []).filter(c => myCompanies.has(c)).sort(byProminence),
      }))
    const closeness = x => x.shared * 10 + Math.min(x.companies.length, 10)
    // [difficulty level, label] per slot: easy -> same / level up / challenge, medium -> same / level up / challenge
    // (both hard), hard -> same / challenge / a medium warm-up.
    const ladder = [
      [[0, 'Same level'], [1, 'Level up'], [2, 'Challenge']],
      [[1, 'Same level'], [2, 'Level up'], [2, 'Challenge']],
      [[2, 'Same level'], [2, 'Challenge'], [1, 'Warm-up']],
    ][myLevel]
    const picked = []
    for (const [lvl, label] of ladder) {
      const best = pool.filter(x => x.inFocus && x.level === lvl && !picked.some(y => y.p.id === x.p.id))
        .sort((a, b) => closeness(b) - closeness(a) || a.p.id - b.p.id)[0]
      if (best) picked.push({ ...best, label })
    }
    // A rung with nothing left unsolved: fill with the closest problem in the topic, then any related one.
    const rest = pool.filter(x => x.shared > 0).sort((a, b) => (b.inFocus - a.inFocus) || closeness(b) - closeness(a) || a.p.id - b.p.id)
    const fallbackLabel = x => (x.level > myLevel ? 'Level up' : x.level < myLevel ? 'Warm-up' : 'Same level')
    for (const x of rest) { if (picked.length >= 3) break; if (!picked.some(y => y.p.id === x.p.id)) picked.push({ ...x, label: fallbackLabel(x) }) }
    return picked.slice(0, 3).map(x => ({ ...x, focus }))
  }, [problems, selected, solvedIds, topicSizes])
  const canPrev = currentIndex > 0
  const canNext = currentIndex >= 0 && currentIndex < problems.length - 1
  const goToProblem = step => { if (currentIndex >= 0) setSelected(problems[currentIndex + step].id) }
  const goToRandom = () => {
    if (!problems || problems.length < 2) return
    const others = problems.filter(p => p.id !== selected)
    setSelected(others[Math.floor(Math.random() * others.length)].id)
  }
  const toggleList = () => setListOpen(open => !open)

  const resolveSelectionFromUrl = list => {
    const params = new URLSearchParams(window.location.search)
    const idParam = params.get('id')
    const mode = params.get('mode')
    const searchParam = params.get('search') || params.get('q')
    if (idParam === 'custom' || idParam === 'playground' || mode === 'playground') return CUSTOM
    if (idParam) {
      const wanted = Number(idParam)
      if (!Number.isNaN(wanted) && list.some(p => p.id === wanted)) return wanted
      // When the requested ID is missing in the database, stay in playground and do NOT redirect to Two Sum
      return CUSTOM
    }
    if (searchParam) {
      const clean = t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const target = clean(searchParam)
      const match = list.find(p => clean(p.title) === target) ||
                    list.find(p => {
                      const pk = clean(p.title)
                      return (pk.length >= 4 && target.includes(pk)) || (target.length >= 4 && pk.includes(target))
                    })
      if (match) return match.id
      const words = searchParam.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)
      if (words.length >= 2) {
        let best = null, maxMatches = 1
        for (const p of list) {
          const pWords = new Set(p.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2))
          const common = words.filter(w => pWords.has(w)).length
          if (common > maxMatches) {
            maxMatches = common
            best = p
          }
        }
        if (best) return best.id
      }
      // When the search query is missing in the database, stay in playground and do NOT redirect to Two Sum
      return CUSTOM
    }
    // When no specific problem is requested, open playground without forcing a redirect to Two Sum
    return CUSTOM
  }

  useEffect(() => {
    fetchCodingProblems()
      .then(list => {
        setProblems(list)
        setSelected(resolveSelectionFromUrl(list))
        markPracticeSeen()
      })
      .catch(e => { setError(e.message); setProblems([]); setSelected(CUSTOM) })
  }, [])

  useEffect(() => {
    if (!problems) return
    const onPop = () => setSelected(resolveSelectionFromUrl(problems))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [problems])

  // Sync selected state to URL query parameter so the address reflects whether you are in Playground or on a specific problem.
  useEffect(() => {
    if (selected == null) return
    const next = selected === CUSTOM ? '/practice' : `/practice?id=${selected}`
    const current = window.location.pathname + window.location.search
    if (next !== current) {
      window.history.pushState({}, '', next)
    }
  }, [selected])

  // Centre the selected problem in the list. Only the list scrolls: scrollIntoView would also scroll
  // the page to reach it, which made the whole layout jump on Next/Previous.
  useEffect(() => {
    const el = selectedRef.current
    const list = el?.closest('ul')
    if (!el || !list) return
    const offset = el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
    list.scrollTo({ top: offset - (list.clientHeight - el.offsetHeight) / 2, behavior: 'smooth' })
    el.focus({ preventScroll: true })
  }, [selected, problems, listOpen])

  useEffect(() => {
    if (selected == null || selected === CUSTOM) { setDetail(null); return }
    // Keep showing the current problem until the next one arrives, so moving between problems does
    // not blank the panel. A response for a problem the member has already moved past is dropped.
    let stale = false
    fetchCodingProblem(selected).then(d => { if (!stale) setDetail(d) }).catch(e => { if (!stale) setError(e.message) })
    return () => { stale = true }
  }, [selected])

  // Each problem is its own search result: title, companies and statement in the description, its own canonical URL.
  useEffect(() => {
    if (selected === CUSTOM) { practiceSeo(); return }
    if (!detail) return
    const companies = [...((problems || []).find(p => p.id === detail.id)?.companies || [])].sort(byProminence)
    const asked = companies.length ? `Asked at ${companies.slice(0, 4).join(', ')}${companies.length > 4 ? ` and ${companies.length - 4} more` : ''}. ` : ''
    const statement = String(detail.statement || '').replace(/[`*#>_]/g, '').replace(/\s+/g, ' ').trim()
    const description = (asked + statement).slice(0, 155).replace(/\s\S*$/, '') + '…'
    const title = `${detail.title}: ${detail.difficulty || ''} Coding Interview Problem | Interview Reader`.replace(/:\s+Coding/, ': Coding')
    setPageSeo({
      title,
      description,
      path: `/practice?id=${detail.id}`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'LearningResource', name: detail.title, description,
        learningResourceType: 'Coding exercise', educationalLevel: detail.difficulty, keywords: [...(detail.topics || []), ...companies.slice(0, 5)].join(', '),
        url: `/practice?id=${detail.id}`,
      },
    })
  }, [detail, problems, selected])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <div className="mx-auto flex w-full max-w-[1800px] min-h-0 flex-1 flex-col p-3 sm:p-4">
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
        {!isLoggedIn() && (
          <p className="mb-4 shrink-0 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <button type="button" onClick={() => setAuthOpen(true)} className="font-semibold underline hover:no-underline">Sign in</button> to run your code. You can still read the problems.
          </p>
        )}
        {error && <p className="mb-4 shrink-0 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!problems && !error && <Loader label="Loading problems…" />}

        {problems && (
          <div className={`grid grid-cols-[minmax(0,1fr)] min-h-0 flex-1 items-stretch gap-5 ${listOpen ? 'lg:grid-cols-[260px_minmax(0,1fr)]' : 'lg:grid-cols-1'}`}>
            {listOpen && <div className="space-y-2 min-h-0 overflow-y-auto">
            {listOpen && <>
            <ul className="overflow-hidden rounded-2xl bg-white dark:bg-slate-950">
              <li>
                <button
                  type="button"
                  onClick={() => setSelected(CUSTOM)}
                  aria-pressed={selected === CUSTOM}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors ${selected === CUSTOM ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'}`}
                >
                  <span>Playground</span>
                  <span aria-hidden="true">✎</span>
                </button>
              </li>
            </ul>
            <h2 className="px-1 pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Problems</h2>
            <div className="space-y-2 rounded-2xl bg-white p-3 dark:bg-slate-950">
              <input
                type="search"
                value={listQuery}
                onChange={e => setListQuery(e.target.value)}
                placeholder="Search by title or #number"
                aria-label="Search problems"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button type="button" onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen} className="flex w-full items-center justify-between rounded-lg px-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                <span>Filters{(listDifficulty !== 'All' || listStatus !== 'all') ? ' •' : ''}</span>
                <span aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
              </button>
              {filtersOpen && <div className="space-y-2">
                <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-1.5">
                  {['All', 'Basic', 'Intermediate', 'Advanced'].map(d => {
                    const n = d === 'All' ? problems.length : problems.filter(p => p.difficulty === d).length
                    const active = listDifficulty === d
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setListDifficulty(d)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                      >
                        <span>{d}</span>
                        <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'}`}>{n}</span>
                      </button>
                    )
                  })}
                </div>
                {isLoggedIn() && (
                  <select value={listStatus} onChange={e => setListStatus(e.target.value)} aria-label="Status" className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                    <option value="all">All</option>
                    <option value="solved">Solved</option>
                    <option value="attempted">Attempted</option>
                    <option value="todo">Not attempted</option>
                  </select>
                )}
              </div>}
            </div>
            <ul onScroll={onListScroll} className="h-[60vh] divide-y divide-slate-200 overflow-y-auto rounded-2xl bg-white dark:divide-slate-800 dark:bg-slate-950">
              {visibleProblems.slice(0, renderCount).map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    ref={p.id === selected ? selectedRef : null}
                    onClick={() => setSelected(p.id)}
                    aria-pressed={p.id === selected}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm transition-colors ${p.id === selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'}`}
                  >
                    {/* Fixed columns, each one line tall (h-5 / leading-5 = the title's first line): the status
                        slot is always there, empty when not started, so numbers and titles line up on every row. */}
                    <span className="flex min-w-0 items-start gap-1.5">
                      {isLoggedIn() && (
                        <span className="flex h-5 w-4 shrink-0 items-center justify-center">
                          {statusOf(p.id) === 'solved' && <span aria-label="Solved" className="text-sm leading-none text-emerald-500">✓</span>}
                          {statusOf(p.id) === 'attempted' && <span aria-label="Attempted" className="h-2 w-2 rounded-full bg-amber-400" />}
                        </span>
                      )}
                      <span className="w-11 shrink-0 text-xs leading-5 tabular-nums text-slate-400 dark:text-slate-500">#{numberOf.get(p.id)}</span>
                      <span className="min-w-0 leading-5">{p.title}</span>
                    </span>
                    {p.difficulty && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${difficultyBadge(p.difficulty)}`}>{p.difficulty}</span>}
                  </button>
                </li>
              ))}
              {problems.length === 0 && <li className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">No coding problems yet.</li>}
              {problems.length > 0 && visibleProblems.length === 0 && <li className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">No problems match.</li>}
            </ul>
            <p className="px-1 text-xs tabular-nums text-slate-500 dark:text-slate-400" aria-live="polite">
              Showing {visibleProblems.length} of {problems.length} problem{problems.length === 1 ? '' : 's'}
            </p>
            </>}
            </div>}

            <div className="min-w-0 flex min-h-0 flex-1 flex-col gap-4">
            {/* Top bar across the statement and the code box: home and problem navigation on the left, Run and Submit in the middle. */}
            <div className="shrink-0 grid grid-cols-[minmax(0,1fr)] items-center gap-3 rounded-2xl bg-white p-3 dark:bg-slate-950 lg:grid-cols-[1fr_auto_1fr]">
              <div className="flex min-w-0 items-center gap-2">
                <a
                  href="/"
                  aria-label="Home"
                  data-tip="Home"
                  className="tip relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" /></svg>
                </a>
                <div className="flex min-w-0 items-center rounded-lg border border-slate-200 dark:border-slate-700">
                  <button type="button" onClick={toggleList} aria-label={listOpen ? 'Collapse problem list' : 'Expand problem list'} data-tip={listOpen ? 'Collapse problem list' : 'Expand problem list'} className={NAV_BTN}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h16" /></svg>
                  </button>
                  <span className="min-w-0 truncate px-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{selected === CUSTOM ? 'Playground' : 'Problems'}</span>
                  <button type="button" onClick={() => goToProblem(-1)} disabled={!canPrev} aria-label="Previous problem" data-tip="Previous problem" className={NAV_BTN}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                  </button>
                  <button type="button" onClick={() => goToProblem(1)} disabled={!canNext} aria-label="Next problem" data-tip="Next problem" className={NAV_BTN}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                  <button type="button" onClick={goToRandom} disabled={!problems || problems.length < 2} aria-label="Random problem" data-tip="Random problem" className={NAV_BTN}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => codeRef.current?.run()}
                  disabled={!isLoggedIn() || busy}
                  data-track="code_run"
                  className="flex items-center gap-1.5 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  {busy
                    ? <svg className="spin-ring h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
                    : <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>}
                  {busy ? 'Running…' : 'Run'}
                </button>
                {selected !== CUSTOM && (
                  <button
                    type="button"
                    onClick={() => codeRef.current?.submit()}
                    disabled={!isLoggedIn() || busy}
                    data-track="code_submit"
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy && <svg className="spin-ring h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>}
                    Submit
                  </button>
                )}
              </div>

              <div className="flex items-center justify-start gap-2 lg:justify-end">
                {!isLoggedIn() && <button type="button" onClick={() => setAuthOpen(true)} className="text-xs font-semibold text-blue-600 underline hover:no-underline dark:text-blue-400">Sign in to run code.</button>}
              </div>
            </div>

            {/* Wide screens show the statement and the code box side by side, with a draggable divider. */}
            <div ref={splitRef} className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch" style={{ '--split': `${split}%` }}>
              {selected === CUSTOM && (
                <>
                  <div className="min-w-0 rounded-2xl bg-white p-5 dark:bg-slate-950 min-h-0 lg:w-[var(--split)] lg:shrink-0 overflow-y-auto">
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Playground</h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Write any program, choose a language, and run it. No tests are checked here.</p>
                  </div>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize panels"
                    onMouseDown={startDrag}
                    className="hidden w-3 shrink-0 cursor-col-resize items-center justify-center lg:flex"
                  >
                    <span className="h-16 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  </div>
                  <div className="min-w-0 flex-1 min-h-0 overflow-hidden">
                    <CodeRunner key={`custom-${getUser()?.email ?? 'guest'}`} actionsRef={codeRef} onBusyChange={setBusy} />
                  </div>
                </>
              )}
              {selected !== CUSTOM && detail && (
                <>
                  <div className="flex min-w-0 flex-col rounded-2xl bg-white p-5 pb-0 dark:bg-slate-950 min-h-0 lg:w-[var(--split)] lg:shrink-0">
                    <div role="tablist" className="mb-4 flex shrink-0 items-center justify-between gap-1 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex gap-1">
                        {[
                          ['description', 'Description'],
                          // Only problems with a written analysis get this tab.
                          ...(detail.analysis ? [['analysis', 'Question Analysis']] : []),
                          ['submissions', `Submissions${history.length ? ` (${history.length})` : ''}`]
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={tab === key}
                            onClick={() => setTab(key)}
                            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${tab === key ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pr-1 min-h-0 flex-1 overflow-y-auto">
                      {tab === 'description' ? (
                        <>
                          <div className="mb-3">
                            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                              {numberOf.has(detail.id) && <><span className="font-normal tabular-nums text-slate-400 dark:text-slate-500">#{numberOf.get(detail.id)}</span>{' '}</>}
                              {detail.title}
                            </h1>
                          </div>
                          <div className="pb-5 text-sm text-slate-700 dark:text-slate-300">
                            <Markdown text={detail.statement} />
                          </div>
                        </>
                      ) : tab === 'analysis' && detail.analysis ? (
                        <div className="pb-5 text-sm text-slate-700 dark:text-slate-300">
                          <Markdown text={detail.analysis} />
                        </div>
                      ) : (
                        <div className="pb-5">
                          <SubmissionList items={history} signedIn={isLoggedIn()} onOpen={id => setOpenRequest({ id, at: Date.now() })} />
                        </div>
                      )}
                    </div>
                    <div className="-mx-5 mt-auto flex shrink-0 justify-end border-t border-slate-200 bg-white px-5 py-2 dark:border-slate-800 dark:bg-slate-950">
                      <OnlineCount />
                    </div>
                  </div>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize panels"
                    onMouseDown={startDrag}
                    className="hidden w-3 shrink-0 cursor-col-resize items-center justify-center lg:flex"
                  >
                    <span className="h-16 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  </div>
                  <div className="min-w-0 flex-1 min-h-0 overflow-hidden">
                    <CodeRunner key={`${detail.id}-${getUser()?.email ?? 'guest'}`} problemId={detail.id} statement={detail.statement} starters={detail.starters || {}} history={history} onSubmitted={() => { loadHistory(); refreshProgress() }} openRequest={openRequest} actionsRef={codeRef} onBusyChange={setBusy}
                      afterAccepted={<SolveNext items={solveNext} onPick={id => setSelected(id)} onRandom={goToRandom} />} />
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// The member's saved submissions for this problem. Clicking one opens its code in the editor.
function SubmissionList({ items, signedIn, onOpen }) {
  if (!signedIn) return <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to see your submissions.</p>
  if (items.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">No submissions yet. Press Submit in the code box to save one.</p>
  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
      {items.map(h => (
        <li key={h.id}>
          <button
            type="button"
            onClick={() => onOpen(h.id)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <span className={h.status === 'Accepted' ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-rose-600 dark:text-rose-400'}>{h.status}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{h.passed}/{h.total} · {languageLabel(h.language)} · {new Date(h.createdAt).toLocaleString()}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// Shown under the test results once a submission is accepted: up to three related problems to keep the streak going.
function SolveNext({ items, onPick, onRandom }) {
  const why = x => [
    x.inFocus ? `More ${x.focus}` : 'Related topic',
    x.companies.length ? `Also asked at ${x.companies.slice(0, 2).join(', ')}` : null,
  ].filter(Boolean)
  return (
    <div className="result-pop rounded-2xl border border-emerald-200 bg-white bg-gradient-to-br from-emerald-50 to-white p-5 shadow-2xl dark:border-emerald-500/30 dark:bg-slate-900 dark:from-slate-900 dark:to-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">🎉 Solved! Climb the {items[0]?.focus || 'next'} ladder</h3>
        <button type="button" onClick={onRandom} className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">Surprise me →</button>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">You've solved everything related to this one. Try a random problem.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map(x => (
            <li key={x.p.id}>
              <button type="button" onClick={() => onPick(x.p.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{x.p.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{why(x).join(' · ')}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{x.label}</span>
                  {x.p.difficulty && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${difficultyBadge(x.p.difficulty)}`}>{x.p.difficulty}</span>}
                  <span aria-hidden="true" className="text-slate-400">→</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
