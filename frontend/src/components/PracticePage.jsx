import { useEffect, useRef, useState } from 'react'
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
import { fetchQuestions } from '../lib/api.js'

const CUSTOM = 'custom'
const NAV_BTN = 'tip relative flex h-8 w-8 shrink-0 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'

// Practice coding: LeetCode-style problems on the left, plus a free code box for writing your own program.
export default function PracticePage() {
  useEffect(() => { setPageSeo({ title: 'Practice Coding Online in 11 Languages | Interview Reader', description: 'Solve coding interview problems in an online editor and run them against test cases in Java, Python, C++, Go, JavaScript and 6 more languages.', path: '/practice', jsonLd: undefined }) }, [])
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
  useEffect(() => {
    const t = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null
    setTab(t === 'analysis' ? 'analysis' : t === 'submissions' ? 'submissions' : 'description')
    setHistory([])
    setOpenRequest(null)
    if (detail) loadHistory()
  }, [detail?.id])
  // Previous, next and random move through the problem list. The Playground is not in the list, so these are off there.
  const currentIndex = problems ? problems.findIndex(p => p.id === selected) : -1
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

  return (
    <>
      <TopBar />
    <div className="min-h-[calc(100vh-5.4rem)] bg-slate-100 p-3 sm:p-4 xl:flex xl:h-[calc(100vh-5.4rem)] xl:flex-col xl:overflow-hidden xl:pb-8 dark:bg-slate-900">
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
      <div className="mx-auto w-full max-w-[1800px] xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
        {!isLoggedIn() && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <button type="button" onClick={() => setAuthOpen(true)} className="font-semibold underline hover:no-underline">Sign in</button> to run your code. You can still read the problems.
          </p>
        )}
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!problems && !error && <Loader label="Loading problems…" />}

        {problems && (
          <div className={`grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:min-h-0 xl:flex-1 xl:grid-rows-[minmax(0,1fr)] xl:items-stretch ${listOpen ? 'lg:grid-cols-[260px_minmax(0,1fr)]' : 'lg:grid-cols-1'}`}>
            {listOpen && <div className="space-y-2">
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

            <div className="min-w-0 space-y-4 xl:flex xl:min-h-0 xl:flex-col xl:space-y-0 xl:gap-4">
            {/* Top bar across the statement and the code box: home and problem navigation on the left, Run and Submit in the middle. */}
            <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 rounded-2xl bg-white p-3 dark:bg-slate-950 lg:grid-cols-[1fr_auto_1fr]">
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
            <div ref={splitRef} className="flex flex-col gap-4 xl:min-h-0 xl:flex-1 xl:flex-row xl:items-stretch" style={{ '--split': `${split}%` }}>
              {selected === CUSTOM && (
                <>
                  <div className="min-w-0 rounded-2xl bg-white p-5 dark:bg-slate-950 xl:w-[var(--split)] xl:shrink-0">
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Playground</h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Write any program, choose a language, and run it. No tests are checked here.</p>
                  </div>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize panels"
                    onMouseDown={startDrag}
                    className="hidden w-3 shrink-0 cursor-col-resize items-center justify-center xl:flex"
                  >
                    <span className="h-16 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  </div>
                  <div className="min-w-0 flex-1 xl:min-h-0 xl:overflow-y-auto">
                    <CodeRunner key={`custom-${getUser()?.email ?? 'guest'}`} actionsRef={codeRef} onBusyChange={setBusy} />
                  </div>
                </>
              )}
              {selected !== CUSTOM && detail && (
                <>
                  <div className="flex min-w-0 flex-col rounded-2xl bg-white p-5 pb-0 dark:bg-slate-950 xl:w-[var(--split)] xl:shrink-0 xl:overflow-y-auto">
                    <div role="tablist" className="mb-4 flex items-center justify-between gap-1 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex gap-1">
                        {[
                          ['description', 'Description'],
                          ['analysis', 'Question Analysis'],
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
                      <a
                        href={`/questions?search=${encodeURIComponent(detail.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Question Reader"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
                      >
                        <span>Reader ↗</span>
                      </a>
                    </div>
                    {tab === 'description' ? (
                      <>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {numberOf.has(detail.id) && <><span className="font-normal tabular-nums text-slate-400 dark:text-slate-500">#{numberOf.get(detail.id)}</span>{' '}</>}
                            {detail.title}
                          </h1>
                          <a
                            href={`/questions?search=${encodeURIComponent(detail.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
                          >
                            <span>Question Analysis ↗</span>
                          </a>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          <Markdown text={detail.statement} />
                        </div>
                      </>
                    ) : tab === 'analysis' ? (
                      <QuestionAnalysisTab title={detail.title} problemId={detail.id} />
                    ) : (
                      <SubmissionList items={history} signedIn={isLoggedIn()} onOpen={id => setOpenRequest({ id, at: Date.now() })} />
                    )}
                    {/* The panel has no bottom padding: a sticky footer stops at the padding edge, so padding here would
                        float it above the bottom. The spacer keeps text off the footer; mt-auto pins the footer
                        down when the statement is short, and sticky keeps it there when the statement scrolls. */}
                    <div aria-hidden="true" className="h-5 shrink-0" />
                    <div className="sticky bottom-0 -mx-5 mt-auto flex justify-end border-t border-slate-200 bg-white px-5 py-2 dark:border-slate-800 dark:bg-slate-950">
                      <OnlineCount />
                    </div>
                  </div>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize panels"
                    onMouseDown={startDrag}
                    className="hidden w-3 shrink-0 cursor-col-resize items-center justify-center xl:flex"
                  >
                    <span className="h-16 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  </div>
                  <div className="min-w-0 flex-1 xl:min-h-0 xl:overflow-y-auto">
                    <CodeRunner key={`${detail.id}-${getUser()?.email ?? 'guest'}`} problemId={detail.id} statement={detail.statement} starters={detail.starters || {}} history={history} onSubmitted={() => { loadHistory(); refreshProgress() }} openRequest={openRequest} actionsRef={codeRef} onBusyChange={setBusy} />
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
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

// Question Analysis tab: loads matching question analysis, approach, and code walkthrough from the questions library.
function QuestionAnalysisTab({ title, problemId }) {
  const [loading, setLoading] = useState(true)
  const [matched, setMatched] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchQuestions({ search: title, size: 5 })
      .then(res => {
        if (!active) return
        const list = res?.content || []
        const clean = t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const target = clean(title)
        const exact = list.find(q => clean(q.title).includes(target) || target.includes(clean(q.title)))
        setMatched(exact || list[0] || null)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [title])

  const readerUrl = `/questions?search=${encodeURIComponent(title)}`

  if (loading) return <div className="py-8"><Loader label="Loading question analysis…" /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Deep Dive Analysis</span>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        </div>
        <a
          href={matched ? `/questions/${matched.id}` : readerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 shadow-sm"
        >
          <span>Open Full Question in Reader</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>

      {matched ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {matched.tech?.toUpperCase()} · {matched.category}
            </span>
            {matched.difficulty && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${difficultyBadge(matched.difficulty)}`}>
                {matched.difficulty}
              </span>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 leading-relaxed">
            <Markdown text={matched.answer} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Algorithmic Approach & Analysis</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Read the theoretical breakdown, optimal data structure tradeoffs, and complexity analysis in the Questions Reader.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={readerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-400"
            >
              <span>Search Question Bank for "{title}" ↗</span>
            </a>
            <a
              href="/roadmaps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <span>View in Company Roadmaps ↗</span>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
