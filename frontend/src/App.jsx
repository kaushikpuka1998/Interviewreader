import { useState, useCallback, useRef, useEffect } from 'react'
import TopBar from './components/TopBar.jsx'
import { PAGE, fetchQuestions, fetchQuestion, fetchQuestionIndex, fetchCategories, fetchStats } from './lib/api.js'
import { saveAllQuestions, getLastSyncedAt, clearQuestionCache } from './lib/offlineStore.js'
import { initOfflineSync, sendOrQueue } from './lib/offlineSync.js'
import { slugify } from './lib/slug.js'
import Footer from './components/Footer.jsx'
import Sidebar from './components/Sidebar.jsx'
import ReaderPane from './components/ReaderPane.jsx'
import PremiumToast from './components/PremiumToast.jsx'
import PremiumPlans from './components/PremiumPlans.jsx'
import { MobileMenuButton, MobileSidebar } from './components/MobileSidebar.jsx'
import AuthModal from './components/AuthModal.jsx'
import ResumePromo from './components/ResumePromo.jsx'
import CodePracticePromo from './components/CodePracticePromo.jsx'
import { fetchFeatures } from './lib/features.js'
import SignupGate from './components/SignupGate.jsx'
import { techLabel } from './lib/badges.js'
import { getUser, isLoggedIn, logout as authLogout, fetchProgress, mergeProgress, markVisitedRemote, markReadRemote, toggleFlaggedRemote, toggleImportantRemote, searchCompanies } from './lib/auth.js'
import { trackView } from './lib/analytics.js'
import LocationPrompt from './components/LocationPrompt.jsx'
import { setQuestionSeo, setDefaultSeo } from './lib/seo.js'
import { withAnswer } from './lib/useFullQuestion.js'

function App({ path = '/', onPathChange = () => {} }) {
  const [questionsData, setQuestionsData] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      return p.get('search') || p.get('q') || ''
    }
    return ''
  })
  const [tech, setTech] = useState(() => new URLSearchParams(window.location.search).get('tech') || 'all')
  const [category, setCategory] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [status, setStatus] = useState('all')
  const [company, setCompany] = useState('all')
  const [plansOpen, setPlansOpen] = useState(false)   // the "Choose your Premium pass" modal, opened from locked answers and filters
  const [companies, setCompanies] = useState([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const theme = localStorage.getItem('theme')
      if (theme) return theme === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })
  const [sidebarWidth, setSidebarWidth] = useState(360)
  const [desktopQuestionListCollapsed, setDesktopQuestionListCollapsed] = useState(false)
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [stats, setStats] = useState(null)

  // Visited/read are per-user and server-authoritative. Empty until the account's
  // progress loads; guests (not logged in) have no persisted status.
  const [visited, setVisited] = useState(() => new Set())
  const [read, setRead] = useState(() => new Set())
  const [flagged, setFlagged] = useState(() => new Set())
  const [flagging, setFlagging] = useState(() => new Set())
  const [important, setImportant] = useState(() => new Set())
  const [marking, setMarking] = useState(() => new Set())

  // Auth state
  const [user, setUser] = useState(() => getUser())
  const [promoOpen, setPromoOpen] = useState(false)   // resume builder promo, shown after login
  const [practicePromoOpen, setPracticePromoOpen] = useState(false)   // code practice promo, after the resume promo
  const [practiceAllowed, setPracticeAllowed] = useState(false)       // code practice promo is on for this login
  const [authOpen, setAuthOpen] = useState(false)
  const [freeTechs, setFreeTechs] = useState([])
  const [gate, setGate] = useState(null)   // { message, tech } when a locked topic is requested

  // On login: merge any status the user clicked this session (pre-login) into the
  // account, then load the account's authoritative progress.
  const handleAuthSuccess = useCallback(async () => {
    // Read back the stored session rather than rebuilding it from the response:
    // hand-picking fields here previously dropped `admin`, so the admin controls
    // stayed hidden until the next page load.
    setUser(getUser())
    setAuthOpen(false)
    fetchFeatures().then(f => {
      const showResume = f.resume_promo !== false && f.resume_builder !== false
      const showPractice = f.code_practice !== false && f.code_practice_promo !== false
      setPracticeAllowed(showPractice)
      if (showResume) setPromoOpen(true)
      else if (showPractice) setPracticePromoOpen(true)
    })
    try {
      await mergeProgress({ visited: Array.from(visitedRef.current), read: Array.from(readRef.current) })
      const { visited: v, read: r, flagged: f = [], important: imp = [] } = await fetchProgress()
      setVisited(new Set(v)); setRead(new Set(r)); setFlagged(new Set(f)); setImportant(new Set(imp))
    } catch (e) { console.error('Failed to sync progress:', e) }
  }, [])

  const handleLogout = useCallback(() => {
    authLogout()
    setUser(null)
    setVisited(new Set()); setRead(new Set()); setFlagged(new Set()); setImportant(new Set())
  }, [])

  // If already logged in on load, pull the account's progress from the server.
  useEffect(() => {
    if (isLoggedIn()) {
      fetchProgress().then(({ visited: v, read: r, flagged: f = [], important: imp = [] }) => {
        setVisited(new Set(v)); setRead(new Set(r)); setFlagged(new Set(f)); setImportant(new Set(imp))
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refs for current visited/read to avoid re-fetching on click
  const visitedRef = useRef(visited)
  const readRef = useRef(read)
  visitedRef.current = visited
  readRef.current = read
  // Flags and important marks are read through refs too: toggling one must not refetch the list, which reset it to
  // page 1, pinned the open question to the top and broke Previous/Next. The next filter change picks them up.
  const flaggedRef = useRef(flagged)
  const importantRef = useRef(important)
  flaggedRef.current = flagged
  importantRef.current = important

  // Refs mirror pagination state so the scroll handler always reads fresh values
  // (avoids stale-closure double-loads of the same page)
  const pageRef = useRef(0)
  const hasMoreRef = useRef(false)
  const loadingRef = useRef(false)
  pageRef.current = page
  hasMoreRef.current = hasMore

  // Load questions from backend API
  const loadQuestionsFromAPI = useCallback(async (pageToLoad, append) => {
    loadingRef.current = true
    setIsLoading(true)
    setGate(null)
    try {
      const data = await fetchQuestions({
        tech: tech === 'all' ? undefined : tech,
        category: category === 'all' ? undefined : category,
        difficulty: difficulty === 'all' ? undefined : difficulty,
        company: company === 'all' ? undefined : company,
        search: query || undefined,
        status: status === 'all' ? undefined : status,
        visitedIds: Array.from(visitedRef.current),
        readIds: Array.from(readRef.current),
        flaggedIds: Array.from(flaggedRef.current),
        importantIds: Array.from(importantRef.current),
        page: pageToLoad,
        size: PAGE
      })
      setQuestionsData(prev => {
        let next = append ? [...prev, ...data.content] : data.content
        if (!append && initialId) {
          const existing = prev.find(q => q.id === initialId)
          if (existing && !next.some(q => q.id === initialId)) {
            const matchesTech = tech === 'all' || existing.tech === tech
            const matchesCategory = category === 'all' || existing.category === category
            const matchesDifficulty = difficulty === 'all' || existing.difficulty === difficulty
            
            if (matchesTech && matchesCategory && matchesDifficulty) {
              next = [existing, ...next]
            }
          }
        }
        return next
      })
      // Update refs synchronously so a scroll firing before re-render sees the new page
      pageRef.current = data.number
      hasMoreRef.current = data.totalPages > data.number + 1
      setPage(data.number)
      setTotalCount(data.totalElements)
      setHasMore(hasMoreRef.current)
    } catch (err) {
      if (err.signupRequired) {
        setGate({ message: err.message, tech: err.tech })
        setQuestionsData([]); setTotalCount(0); setHasMore(false)
      } else {
        console.error('Failed to load questions:', err)
      }
    } finally {
      loadingRef.current = false
      setIsLoading(false)
      setLoaded(true)
    }
  }, [tech, category, difficulty, company, query, status])

  // Load page 0 fresh whenever filters or per-user status change.
  useEffect(() => {
    loadQuestionsFromAPI(0, false)
  }, [loadQuestionsFromAPI])


  // Load categories when tech changes
  useEffect(() => {
    if (tech !== 'all') {
      fetchCategories(tech).then(setCategories).catch(() => setCategories([]))
    } else {
      setCategories([])
    }
  }, [tech])

  // Companies to filter by — the most-reported ones. Needs a login (like reporting).
  useEffect(() => {
    if (!user) { setCompanies([]); return }
    searchCompanies('').then(setCompanies).catch(() => setCompanies([]))
  }, [user])

  // Load stats
  useEffect(() => {
    fetchStats().then(stats => {
      setStats(stats)
      if (Array.isArray(stats?.freeTechs)) {
        setFreeTechs(stats.freeTechs)
        localStorage.setItem('ir_free_techs', JSON.stringify(stats.freeTechs))   // offline reads for signed-out callers
      }
    }).catch(() => {})
  }, [user])

  // Whole-dataset offline sync: quietly pull every accessible question into
  // IndexedDB (once every 6h) so browsing keeps working with the network off.
  // Techs the current user can't access (401) are just skipped, not an error.
  const TECHS = ['java', 'react', 'node', 'sql', 'hld', 'kafka', 'golang', 'microservices', 'design-patterns', 'misc', 'angular', 'rails', 'behavioral']
  useEffect(() => {
    if (!navigator.onLine) return
    const SIX_HOURS = 6 * 60 * 60 * 1000
    // Caches saved before the signed-out filter hold the full set. Wipe them once for signed-out browsers.
    const scrub = !localStorage.getItem('ir_cache_scoped') && !localStorage.getItem('ir_user')
      ? clearQuestionCache().then(() => localStorage.setItem('ir_cache_scoped', '1'))
      : Promise.resolve()
    // The whole-dataset download is the heaviest thing the app does, so it is polite: not on data-saver or slow connections, only once the
    // page is idle, and one topic at a time (not all at once) so it never competes with what the reader is looking at.
    const conn = navigator.connection
    if (conn && (conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || ''))) return
    let cancelled = false
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 4000))
    idle(() => {
      scrub.then(() => getLastSyncedAt()).then(async (last) => {
        if (cancelled || (last && Date.now() - last < SIX_HOURS)) return
        const all = []
        for (const t of TECHS) {
          if (cancelled) return
          try { all.push(...(await fetchQuestions({ tech: t, page: 0, size: 100000, full: true })).content) } catch { /* a topic this member can't read is skipped */ }
        }
        if (all.length && !cancelled) await saveAllQuestions(all)
      }).catch(() => {})
    }, { timeout: 10000 })
    return () => { cancelled = true }
  }, [user])

  // Surface an offline banner, and replay any visited/read/flag actions queued
  // while offline as soon as the connection (or just the tab) comes back.
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    initOfflineSync()
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Load more (pagination) — stable identity; reads fresh state from refs to avoid
  // stale-closure double-loads. Guards against concurrent loads.
  const handleLoadMore = useCallback(() => {
    if (loadingRef.current || !hasMoreRef.current) return
    loadQuestionsFromAPI(pageRef.current + 1, true)
  }, [loadQuestionsFromAPI])

  // Server handles all filtering/pagination — questionsData holds every loaded page
  const filtered = questionsData
  const effectiveHasMore = hasMore

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const initialId = searchParams.get('id')

  // Keep track of the very first ID we loaded with so we don't overwrite it while fetching
  const [pendingUrlId, setPendingUrlId] = useState(initialId)
  const [urlNotFound, setUrlNotFound] = useState(false)   // the id in the URL matches no question
  const [urlGate, setUrlGate] = useState(null)   // { id, tech, message } when the linked question needs an account
  const lastUrlId = useRef(initialId)

  // If the URL changes (e.g. popstate or pushState), update our tracking.
  if (initialId !== lastUrlId.current) {
    lastUrlId.current = initialId
    setUrlNotFound(false)
    setUrlGate(null)
    if (initialId && !questionsData.some(q => q.id === initialId)) {
      setPendingUrlId(initialId)
    }
  }

  // Back/forward: the URL is the truth again, so drop the last clicked question.
  useEffect(() => {
    const onPop = () => {
      setSelectedId(null); setUrlGate(null); setUrlNotFound(false)
      // Resolve the URL's question (fetching it if it isn't loaded) instead of falling back to the first one.
      setPendingUrlId(new URLSearchParams(window.location.search).get('id'))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!pendingUrlId) return
    
    // Check if it's already loaded
    if (questionsData.some(q => q.id === pendingUrlId)) {
      setPendingUrlId(null)
      return
    }

    fetchQuestion(pendingUrlId)
      .then(q => {
        if (!q.id) return
        setQuestionsData(prev => {
          if (prev.some(existing => existing.id === q.id)) return prev
          return [q, ...prev]
        })
        setTech(q.tech)
      })
      .catch(err => {
        if (err.notFound) setUrlNotFound(true)
        else if (err.signupRequired) setUrlGate({ id: pendingUrlId, tech: err.tech, message: err.message })
        else console.error(err)
      })
      .finally(() => {
        setPendingUrlId(null)
      })
    // Explicitly leaving questionsData out of dependencies so this doesn't re-run on filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUrlId])

  // URL routing: the path is a question slug. Resolve it against loaded questions.
  const slug = path === '/' ? '' : decodeURIComponent(path.replace(/^\/+/, ''))
  const byId = filtered.find(q => q.id === selectedId) || filtered.find(q => q.id === initialId)
  const bySlug = slug ? questionsData.find(q => slugify(q.question || q.title) === slug) : null
  
  // Prefer the current selection, then the URL slug, then default to the first result.
  // ONLY fallback to first result if we aren't waiting for the URL ID to load!
  const isPending = pendingUrlId && (initialId === pendingUrlId || !initialId) && !byId && !bySlug

  // A slug-only link (sitemap, canonical URL, an old share) whose question isn't in the loaded list:
  // look its id up in the question index, then load it like an ?id= link. No match means a real 404.
  const [slugLookup, setSlugLookup] = useState(() => (slug && !initialId ? 'pending' : 'done'))
  useEffect(() => {
    if (slugLookup !== 'pending' || !loaded) return
    if (bySlug) { setSlugLookup('done'); return }
    fetchQuestionIndex()
      .then(list => {
        const hit = list.find(e => e.slug === slug)
        if (hit) setPendingUrlId(hit.id)
        else setUrlNotFound(true)
      })
      .catch(() => setUrlNotFound(true))
      .finally(() => setSlugLookup('done'))
  }, [loaded, slugLookup, bySlug])

  // A locked or missing linked question must never silently fall back to another question.
  const selected = byId || bySlug || (isPending || slugLookup === 'pending' || urlNotFound || urlGate ? null : (filtered[0] || null))

  // After signing in, retry the locked question the visitor originally linked to.
  useEffect(() => {
    if (user && urlGate) {
      setPendingUrlId(urlGate.id)
      setUrlGate(null)
    }
  }, [user])
  // Reader shows a loading state until the first list load and any linked question have resolved.
  const readerLoading = !loaded || isPending || (slugLookup === 'pending' && !selected) || (isLoading && !selected)

  // Keep selectedId in sync with what's actually shown — covers deep links (slug) and
  // filter changes (stale id -> first result), so the sidebar highlights the right item.
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id)
  }, [selected?.id])

  // Sync (state -> URL bar): update the address on selection. pushState only — popstate
  // (in main.jsx) handles back/forward, so we never feed `path` back and loop.
  useEffect(() => {
    if (!selected) return
    const params = new URLSearchParams(window.location.search)
    const hasSearch = params.has('search') || params.has('q')
    // Don't wipe out search parameter from address bar unless user explicitly selected a question
    if (hasSearch && !selectedId && !initialId) return

    const next = `/${slugify(selected.question || selected.title)}?id=${selected.id}`
    const current = window.location.pathname + window.location.search
    if (next !== current) window.history.pushState({}, '', next)
    lastUrlId.current = selected.id   // we moved the URL ourselves; only back/forward should count as a URL change
    // Record the view for the admin analytics dashboard.
    trackView({ path: next, questionId: selected.id })
    // Per-question title/description/canonical + QAPage structured data.
    // Only claim paywalled when we actually know the free list; if the backend has
    // not reported it, fail open — marking free content as paywalled would suppress it.
    const gated = !user && freeTechs.length > 0 && !freeTechs.includes(selected.tech)
    const id = selected.id
    setQuestionSeo(selected, { gated })   // title and canonical now; the description and QAPage text need the answer, which the list leaves out
    withAnswer(selected).then(full => { if (full.answer && lastUrlId.current === id) setQuestionSeo(full, { gated }) })
  }, [selected?.id])

  const toggleDarkMode = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('theme', next ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }, [])

  const questionListRef = useRef(null)

  const scrollToSelected = useCallback(() => {
    if (questionListRef.current) {
      const active = questionListRef.current.querySelector('[data-selected="true"]')
      if (active) {
        // Scroll only the question list. scrollIntoView would also scroll the sidebar and push its header up.
        const list = questionListRef.current
        const lr = list.getBoundingClientRect()
        const ar = active.getBoundingClientRect()
        if (ar.top < lr.top) list.scrollBy({ top: ar.top - lr.top - 8, behavior: 'smooth' })
        else if (ar.bottom > lr.bottom) list.scrollBy({ top: ar.bottom - lr.bottom + 8, behavior: 'smooth' })
      }
    }
  }, [])

  useEffect(() => {
    scrollToSelected()
  }, [selectedId, scrollToSelected])

  // Select a question, mark it visited, and close the mobile menu.
  const selectQuestion = useCallback((id) => {
    setSelectedId(id)
    setUrlGate(null)   // picking a question replaces the locked link the page was opened with
    setVisited(prev => {
      if (!prev.has(id)) {
        const next = new Set(prev)
        next.add(id)
        if (isLoggedIn()) sendOrQueue('visited', id, () => markVisitedRemote(id)).catch(() => {})
        return next
      }
      return prev
    })
    setMobileMenuOpen(false)
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const handleSelect = selectQuestion
  const handleNavigate = selectQuestion

  // The daily question can be outside the visitor's current filters or page of
  // results. Load it before selecting so the reader always opens that exact QOTD.
  const handleDailySelect = useCallback(async (daily) => {
    if (!daily?.id) return
    if (questionsData.some(question => question.id === daily.id)) {
      selectQuestion(daily.id)
      return
    }
    try {
      const question = await fetchQuestion(daily.id)
      if (!question?.id) return
      setQuestionsData(prev => prev.some(item => item.id === question.id) ? prev : [question, ...prev])
      selectQuestion(question.id)
    } catch (err) {
      if (err.signupRequired) setGate({ message: err.message, tech: err.tech })
      else console.error('Failed to load the daily question:', err)
    }
  }, [questionsData, selectQuestion])

  const handleMarkRead = useCallback((id) => {
    setRead(prev => {
      const next = new Set(prev)
      next.add(id)
      if (isLoggedIn()) sendOrQueue('read', id, () => markReadRemote(id)).catch(() => {})
      return next
    })
    // Also mark as visited if not already (markRead on the server already implies visited)
    setVisited(prev => {
      if (!prev.has(id)) {
        const next = new Set(prev)
        next.add(id)
        return next
      }
      return prev
    })
  }, [])

  // Shared by Flag and Important: both are per-user server toggles with the same
  // offline-queue behaviour. `key` is the boolean field the endpoint returns.
  const toggleProgress = useCallback(async (id, { type, key, remote, setOn, setBusy, label }) => {
    const apply = (on) => setOn(prev => {
      const next = new Set(prev)
      if (on ?? !next.has(id)) next.add(id); else next.delete(id)
      return next
    })
    setBusy(prev => new Set(prev).add(id))
    try {
      if (!navigator.onLine) {
        // Can't know the server's resulting state without a round-trip — flip
        // locally and queue the same toggle call for when the connection returns.
        await sendOrQueue(type, id, () => remote(id))
        apply()
      } else {
        apply((await remote(id))[key])
      }
    } catch (error) {
      console.error(`Failed to update ${label}:`, error)
      window.alert(`The ${label} could not be saved. Please try again.`)
    } finally {
      setBusy(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const handleToggleFlag = useCallback((id) => {
    if (flagging.has(id)) return
    toggleProgress(id, { type: 'flag', key: 'flagged', remote: toggleFlaggedRemote, setOn: setFlagged, setBusy: setFlagging, label: 'flag' })
  }, [flagging, toggleProgress])

  const handleToggleImportant = useCallback((id) => {
    if (marking.has(id)) return
    toggleProgress(id, { type: 'important', key: 'important', remote: toggleImportantRemote, setOn: setImportant, setBusy: setMarking, label: 'important mark' })
  }, [marking, toggleProgress])

  const handleTechChange = useCallback((value) => {
    setTech(value)
    setCategory('all')
  }, [])

  // Resizable divider logic
  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.min(Math.max(startWidth + deltaX, 280), 600)
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  // Shared props for both the desktop and mobile sidebar instances.
  const [premiumNote, setPremiumNote] = useState('')
  const openPlans = () => (user ? setPlansOpen(true) : setAuthOpen(true))
  const sidebarProps = {
    questions: questionsData,
    filtered,
    hasMore: effectiveHasMore,
    onLoadMore: handleLoadMore,
    loading: isLoading,
    selectedId,
    query,
    setQuery,
    tech,
    setTech: handleTechChange,
    category,
    setCategory,
    difficulty,
    setDifficulty,
    status,
    setStatus,
    company,
    setCompany,
    companies,
    onSelect: handleSelect,
    onDailySelect: handleDailySelect,
    onToggleDark: toggleDarkMode,
    isDark,
    visited,
    read,
    categories,
    user,
    onLoginClick: () => setAuthOpen(true),
    onLogout: handleLogout,
    onAdminClick: () => { window.location.href = '/admin' },
    freeTechs,
    onLockedTech: () => setAuthOpen(true),
    onPremium: openPlans,
    onCompanyLocked: () => setPremiumNote('Company-wise questions are a Premium feature. Go Premium to filter every topic by the company that asked it.'),
    stats,
    totalCount,
  }

  return (
    <div className="app-shell h-screen overflow-hidden bg-slate-100 dark:bg-slate-900 flex flex-col">
      {!online && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-amber-950 text-xs font-semibold text-center py-1">
          You're offline — showing cached questions. Marking read/visited and flags are saved now and will sync automatically when you're back online. Suggestions and login still need a connection.
        </div>
      )}
      {/* Top bar on every screen size: on phones its ☰ menu reaches the other pages; the floating button opens the question list. */}
      <div className="flex-shrink-0">
        <TopBar user={user} isDark={isDark} onToggleDark={toggleDarkMode} onLogin={() => setAuthOpen(true)} onLogout={handleLogout} onAdmin={() => { window.location.href = '/admin' }} />
      </div>
      <div className="flex min-h-0 flex-1">
      {/* The desktop list stays mounted while collapsed so its search, filters, and scroll position are retained. */}
      <div className="relative hidden min-h-0 flex-shrink-0 lg:flex">
        <div
          id="desktop-question-list"
          className={`desktop-question-panel ${desktopQuestionListCollapsed ? 'desktop-question-panel--collapsed' : ''}`}
          style={{ '--question-panel-width': `${sidebarWidth}px` }}
        >
          <Sidebar {...sidebarProps} sidebarWidth={sidebarWidth} questionListRef={questionListRef} />
        </div>

        {/* Resizable divider — only available while the panel is visible. */}
        <div
          className={`desktop-question-panel-divider ${desktopQuestionListCollapsed ? 'desktop-question-panel-divider--hidden' : ''}`}
          onMouseDown={handleDividerMouseDown}
          role="separator"
          aria-label="Resize question list"
          aria-orientation="vertical"
          tabIndex={desktopQuestionListCollapsed ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              setSidebarWidth(prev => Math.max(prev - 20, 280))
            } else if (e.key === 'ArrowRight') {
              setSidebarWidth(prev => Math.min(prev + 20, 600))
            }
          }}
        />

        <button
          type="button"
          className="desktop-question-panel-toggle tip tip-below"
          onClick={() => setDesktopQuestionListCollapsed(prev => !prev)}
          aria-controls="desktop-question-list"
          aria-expanded={!desktopQuestionListCollapsed}
          aria-label={desktopQuestionListCollapsed ? 'Show question list' : 'Hide question list'}
          data-tip={desktopQuestionListCollapsed ? 'Show question list' : 'Hide question list'}
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="4" width="17" height="16" rx="2" />
            <path strokeLinecap="round" d="M9 4v16" />
            <path strokeLinecap="round" strokeLinejoin="round" d={desktopQuestionListCollapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'} />
          </svg>
        </button>
      </div>

      {/* Mobile sidebar spacer - pushes content when menu open */}
      {mobileMenuOpen && <div className="lg:hidden w-80 max-w-[85vw]" aria-hidden="true" />}

      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} {...sidebarProps} />

      <MobileMenuButton isOpen={mobileMenuOpen} onToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      {urlGate || gate ? (
        <SignupGate
          tech={(urlGate || gate).tech}
          message={urlGate ? `Sign in to read this ${techLabel(urlGate.tech) || ''} question. You'll land right back on it.` : gate.message}
          title={urlGate ? 'Sign in to read this question' : undefined}
          freeTechs={freeTechs}
          onSignup={() => setAuthOpen(true)}
          onBrowseFree={(t) => { setUrlGate(null); setTech(t) }}
        />
      ) : (
      <ReaderPane
        question={selected}
        loading={readerLoading}
        urlNotFound={urlNotFound}
        questions={filtered}
        onNavigate={handleNavigate}
        visited={visited}
        read={read}
        flagged={flagged}
        flagging={flagging}
        important={important}
        marking={marking}
        onMarkRead={handleMarkRead}
        onToggleFlag={handleToggleFlag}
        onToggleImportant={handleToggleImportant}
        onPremium={openPlans}
      />
      )}
      </div>
      <Footer />

      {premiumNote && <PremiumToast message={premiumNote} onClose={() => setPremiumNote('')} />}
      {plansOpen && <PremiumPlans onClose={() => setPlansOpen(false)} onBought={() => window.location.reload()} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} />}
      {promoOpen && <ResumePromo onClose={() => { setPromoOpen(false); if (practiceAllowed) setPracticePromoOpen(true) }} />}
      {practicePromoOpen && <CodePracticePromo onClose={() => setPracticePromoOpen(false)} />}
      {user && <LocationPrompt />}
    </div>
  )
}

export default App
