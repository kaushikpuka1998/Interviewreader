import { useState, useEffect, useMemo, useRef } from 'react'
import TopBar from './TopBar.jsx'
import { setPageSeo } from '../lib/seo.js'
import { fetchCodingProblems } from '../lib/codingProblems.js'
import { fetchRoadmaps } from '../lib/billing.js'
import PremiumPlans from './PremiumPlans.jsx'
import { getUser } from '../lib/auth.js'
import AuthModal from './AuthModal.jsx'
import Loader from './Loader.jsx'

const STORAGE_KEY = 'ir_roadmap_completed_topics'
const CUSTOM_PLAN_KEY = 'ir_roadmap_custom_plan'

// Small deterministic PRNG (mulberry32) seeded from a string, so a company's picks stay stable across reloads.
function seededRandom(key) {
  let a = [...key].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1779033703) >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function RoadmapsPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    const c = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('company') : null
    return c || 'google'
  })
  // Roadmap content comes from the API: full for Premium members, a teaser (titles only) for everyone else.
  const [roadmap, setRoadmap] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [celebrate, setCelebrate] = useState(false) // Premium just unlocked: show the welcome overlay
  const [justUnlocked, setJustUnlocked] = useState(false) // ease the unlocked roadmap into view once
  const loadRoadmap = () => fetchRoadmaps().then(r => { setRoadmap(r); setLoadError('') }).catch(e => setLoadError(e.message))
  useEffect(() => { loadRoadmap() }, [])
  const COMPANIES = roadmap?.companies || []
  const locked = roadmap ? !roadmap.premium : true

  // Upsell CTA: sign in first, then the pass picker; reload the roadmap once the payment is verified.
  const [plansOpen, setPlansOpen] = useState(false)
  const unlock = () => (getUser() ? setPlansOpen(true) : setAuthOpen(true))
  const onBought = async () => {
    await loadRoadmap()
    setPlansOpen(false)
    setCelebrate(true)
    setJustUnlocked(true)
  }
  const [track, setTrack] = useState('all') // 'all' | 'dsa' | 'system-design' | 'behavioral'
  const [level, setLevel] = useState('sde2') // 'sde1' | 'sde2' | 'sde3'
  const [duration, setDuration] = useState('8weeks') // '4weeks' | '8weeks' | '12weeks'
  const [search, setSearch] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [expandedTopic, setExpandedTopic] = useState(null)
  const [dbProblems, setDbProblems] = useState([])
  const [dbLoaded, setDbLoaded] = useState(false)
  const [shuffles, setShuffles] = useState({}) // patternId -> how many times the user asked for a new set
  const [copied, setCopied] = useState(null) // path whose link was just copied

  // Copy an absolute, shareable link for any in-app path.
  const copyLink = path => {
    navigator.clipboard?.writeText(window.location.origin + path).then(() => {
      setCopied(path)
      setTimeout(() => setCopied(c => (c === path ? null : c)), 1500)
    })
  }

  useEffect(() => {
    fetchCodingProblems().then(setDbProblems).catch(() => {}).finally(() => setDbLoaded(true))
  }, [])

  // Keep the selected company in the address bar so a roadmap can be shared / linked to.
  const selectCompany = id => {
    setSelectedCompanyId(id)
    setShuffles({})
    const u = new URL(window.location.href)
    u.searchParams.set('company', id)
    window.history.replaceState({}, '', u)
  }

  // Completed topics stored in localStorage so candidate progress persists across sessions
  const [completed, setCompleted] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Custom user plan preferences
  const [customPlan, setCustomPlan] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PLAN_KEY)
      return saved ? JSON.parse(saved) : { targetWeeks: 8, dailyHours: 2.5, targetDate: '' }
    } catch {
      return { targetWeeks: 8, dailyHours: 2.5, targetDate: '' }
    }
  })


  const company = useMemo(() => {
    return COMPANIES.find(c => c.id === selectedCompanyId) || COMPANIES[0] || null
  }, [selectedCompanyId, COMPANIES])

  // Each company roadmap is its own search landing page ("Amazon interview preparation roadmap").
  useEffect(() => {
    // Plain /roadmaps (no company in the URL) stays the general page, so its canonical doesn't point at Google's.
    if (!company || !new URLSearchParams(window.location.search).get('company')) {
      setPageSeo({
        title: 'Company Interview Roadmaps (DSA & System Design) | Interview Reader',
        description: 'Interactive company-tailored preparation roadmaps for Google, Amazon, Meta, Microsoft, Uber, Netflix & more. Track your progress across DSA and System Design.',
        path: '/roadmaps',
      })
      return
    }
    const path = `/roadmaps?company=${company.id}`
    const description = `${company.name} interview roadmap: all ${company.rounds.length} rounds explained, with ${company.name}-tagged DSA problems, system design prompts and behavioral questions. Focus: ${company.tagline}.`
    setPageSeo({
      title: `${company.name} Interview Roadmap: DSA, System Design & Behavioral | Interview Reader`,
      description: description.length > 160 ? description.slice(0, 157).replace(/\s\S*$/, '') + '…' : description,
      path,
      jsonLd: { '@context': 'https://schema.org', '@type': 'Course', name: `${company.name} Interview Preparation Roadmap`, description, provider: { '@type': 'Organization', name: 'Interview Reader' }, url: path },
    })
  }, [company])

  const toggleTopic = (id) => {
    setCompleted(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  const markPhaseAll = (phaseTopics, markCompleted = true) => {
    setCompleted(prev => {
      const next = new Set(prev)
      phaseTopics.forEach(t => {
        if (markCompleted) next.add(t.id)
        else next.delete(t.id)
      })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  const resetAllProgress = () => {
    if (window.confirm('Are you sure you want to reset your roadmap progress? This cannot be undone.')) {
      setCompleted(new Set())
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
  }

  // Every company gets its own roadmap: DSA topics are built from the problems tagged with that company in the
  // problem bank (so every Practice link resolves), design / behavioral topics come from COMPANY_TOPICS.
  const phases = useMemo(() => {
    if (!roadmap || !company) return []
    const { dsaPatterns: DSA_PATTERNS, dsaPhases: DSA_PHASES, companyTopics: COMPANY_TOPICS } = roadmap
    const rank = { Basic: 0, Intermediate: 1, Advanced: 2 }
    const label = ['Easy', 'Medium', 'Hard']
    // Companies with few tagged problems list similar companies in problemsFrom; their DSA comes from those.
    const mine = companyProblems(dbProblems, company)
    const source = company.problemsFrom ? 'commonly asked' : company.name
    const matches = pt => mine.filter(p => (p.topics || []).some(t => pt.tags.includes(t)))
    const used = new Set()
    const built = {}
    // Rarest patterns pick first so a broad tag like "Array" cannot swallow them.
    ;[...DSA_PATTERNS].sort((x, y) => matches(x).length - matches(y).length).forEach(pt => {
      // Seeded per company + topic + shuffle count: stable on reload, different for every company, new set on Shuffle.
      const rand = seededRandom(`${company.id}:${pt.id}:${shuffles[pt.id] || 0}`)
      const pool = matches(pt).filter(p => !used.has(p.id)).map(p => [rand(), p]).sort((x, y) => x[0] - y[0]).map(x => x[1])
      // Aim for 2 Basic, 2 Intermediate, 2 Advanced; top up from whatever is left.
      const picks = ['Basic', 'Intermediate', 'Advanced'].flatMap(d => pool.filter(p => p.difficulty === d).slice(0, 2))
      pool.forEach(p => { if (picks.length < 6 && !picks.includes(p)) picks.push(p) })
      if (!picks.length) return
      picks.forEach(p => used.add(p.id))
      picks.sort((x, y) => (rank[x.difficulty] ?? 1) - (rank[y.difficulty] ?? 1))
      const avg = Math.round(picks.reduce((n, p) => n + (rank[p.difficulty] ?? 1), 0) / picks.length)
      built[pt.id] = {
        id: `${company.id}:${pt.id}`, patternId: pt.id, poolSize: matches(pt).length, title: pt.title, track: 'dsa', category: pt.category, difficulty: label[avg],
        weightage: `${matches(pt).length} ${source} problems`, summary: pt.summary, concepts: pt.concepts, cheatSheet: pt.cheatSheet,
        // Teaser: the pattern's problem picks are part of the premium roadmap, so they stay hidden.
        practiceProblems: locked ? [] : picks.map(p => ({ id: p.id, title: p.title, difficulty: p.difficulty, hasAnalysis: !!p.hasAnalysis })),
      }
    })
    const out = DSA_PHASES.map(ph => ({
      id: `${company.id}-phase-${ph.number}`, ...ph, track: 'dsa',
      topics: DSA_PATTERNS.filter(pt => pt.phase === ph.number && built[pt.id]).map(pt => built[pt.id])
        .sort((x, y) => parseInt(y.weightage) - parseInt(x.weightage)),
    }))
    const extra = (COMPANY_TOPICS[company.id] || []).map(t => ({ ...t, id: `${company.id}:${t.id}` }))
    const design = extra.filter(t => t.track === 'system-design')
    out.push({ id: `${company.id}-design`, number: 4, track: 'system-design', timeline: 'Week 7 - 10', title: `${company.name} System Design & LLD`,
      description: `The design prompts ${company.name} is known for, with the trade-offs its interviewers probe.`,
      topics: level === 'sde1' ? design.slice(0, 3) : design })
    out.push({ id: `${company.id}-behavioral`, number: 5, track: 'behavioral', timeline: 'Week 11+', title: `${company.name} Behavioral & Culture`,
      description: 'Stories and values that decide offer level.', topics: extra.filter(t => t.track === 'behavioral') })
    return out.filter(p => p.topics.length)
  }, [roadmap, company, dbProblems, level, shuffles, locked])

  // Filter phases and topics based on Track, Search, and Experience Level
  const filteredPhases = useMemo(() => {
    const q = search.trim().toLowerCase()

    return phases.map(phase => {
      // Filter topics inside phase
      const topics = phase.topics.filter(t => {
        // Track filter
        if (track !== 'all') {
          if (track === 'dsa' && t.track !== 'dsa') return false
          if (track === 'system-design' && t.track !== 'system-design') return false
          if (track === 'behavioral' && t.track !== 'behavioral') return false
        }
        // Search filter
        if (q) {
          const matchTitle = t.title.toLowerCase().includes(q)
          const matchCategory = (t.category || '').toLowerCase().includes(q)
          const matchSummary = (t.summary || '').toLowerCase().includes(q)
          const matchProblems = (t.practiceProblems || []).some(p => p.title.toLowerCase().includes(q))
          const matchConcepts = (t.concepts || []).some(c => c.toLowerCase().includes(q))
          if (!matchTitle && !matchCategory && !matchSummary && !matchProblems && !matchConcepts) return false
        }
        return true
      })

      return {
        ...phase,
        filteredTopics: topics
      }
    }).filter(phase => phase.filteredTopics.length > 0)
  }, [phases, track, search])

  // Total topics count across all roadmap items
  const allTopics = useMemo(() => {
    return phases.flatMap(p => p.topics)
  }, [phases])

  const totalTopicsCount = allTopics.length
  const completedTopicsCount = useMemo(() => {
    return allTopics.filter(t => completed.has(t.id)).length
  }, [allTopics, completed])

  const readinessPercent = totalTopicsCount > 0 ? Math.round((completedTopicsCount / totalTopicsCount) * 100) : 0

  const readinessTier = useMemo(() => {
    if (readinessPercent >= 85) return { label: 'FAANG Ready', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500' }
    if (readinessPercent >= 50) return { label: 'Interview Ready', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500' }
    if (readinessPercent >= 25) return { label: 'Contender', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500' }
    return { label: 'Foundation Stage', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-400' }
  }, [readinessPercent])

  if (!roadmap || !company) {
    return (
      <>
        <TopBar />
        <div className="flex min-h-screen items-start justify-center bg-slate-50 pt-24 dark:bg-slate-950">
          {loadError ? (
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
              <button type="button" onClick={loadRoadmap} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Try again</button>
            </div>
          ) : <Loader />}
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {/* Hero Section */}
        <div className="border-b border-slate-200 bg-white px-4 py-8 dark:border-slate-800 dark:bg-slate-900/60 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  Targeted Company Interview Preparation
                </div>
                <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  DSA & System Design <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">Company Roadmaps</span>
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                  Customized, battle-tested learning paths tailored for top tech loops. Track your progress, solve company-frequency coding problems, and master architectural trade-offs.
                </p>
              </div>

              {/* Readiness Score Card */}
              <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center">
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-blue-600 transition-all duration-500 ease-out dark:text-blue-400"
                      strokeDasharray={`${readinessPercent}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{readinessPercent}%</span>
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Readiness Score</span>
                    <span className={`text-xs font-bold ${readinessTier.color}`}>{readinessTier.label}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-blue-600 dark:text-blue-400">{completedTopicsCount}</span> of {totalTopicsCount} topics mastered
                  </p>
                  <div className="mt-2 flex items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPlanModal(true)}
                      className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                    >
                      Customize plan ⚙
                    </button>
                    {completedTopicsCount > 0 && (
                      <button
                        type="button"
                        onClick={resetAllProgress}
                        className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-rose-500 dark:hover:text-rose-400"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Company Selection Bar */}
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Select Target Company</p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none sm:flex-wrap sm:overflow-visible">
                {COMPANIES.map(c => {
                  const active = c.id === selectedCompanyId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCompany(c.id)}
                      className={`flex flex-shrink-0 items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-500/20 dark:border-blue-500 dark:bg-blue-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      <CompanyLogo company={c} className={`h-6 w-6 rounded-md text-xs ${active ? 'bg-white text-pink-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`} />
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Company Strategy & Overview Card */}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {/* Side by side only when there is room; below xl the chips sit under the title instead of squeezing it. */}
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                {/* Badges wrap onto their own line on narrow widths instead of squeezing into two-line pills. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <CompanyLogo company={company} className="h-9 w-9 rounded-xl bg-white text-sm text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{company.name} Interview Playbook</h2>
                  {!locked && <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-2.5 py-0.5 text-[11px] font-bold text-white">★ Premium</span>}
                  <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${company.badgeTone}`}>
                    {company.roleLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{company.tagline}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:max-w-md xl:shrink-0 xl:justify-end">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span className="text-blue-500">⏱</span> ~{company.recommendedHoursPerDay} hrs/day recommended
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span className="text-amber-500">★</span> {company.rounds.length} Interview Rounds
                </span>
                <button type="button" onClick={() => copyLink(`/roadmaps?company=${company.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  {copied === `/roadmaps?company=${company.id}` ? '✓ Link copied' : '🔗 Share roadmap'}
                </button>
                {!company.problemsFrom && (
                  <a href={`/problems?company=${encodeURIComponent(company.tag || company.name)}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
                    {dbLoaded ? `All ${companyProblems(dbProblems, company).length} ${company.name} problems ↗` : 'Company problems ↗'}
                  </a>
                )}
              </div>
            </div>

            {/* Rounds Overview */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {company.rounds.map((round, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800/80 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Round {idx + 1}</span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{round.duration}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{round.name}</h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{round.desc}</p>
                </div>
              ))}
            </div>

            {/* Rubric & Gotchas */}
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  <span>⚠️</span> Critical Company Gotchas & Warnings
                </h4>
                <ul className="mt-2.5 space-y-2 text-xs text-amber-900/90 dark:text-amber-200/90">
                  {company.gotchas.map((g, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  <span>🎯</span> What {company.name} Evaluators Score On
                </h4>
                <div className="mt-2.5 space-y-2 text-xs text-blue-900/90 dark:text-blue-200/90">
                  <div><strong className="font-semibold text-blue-950 dark:text-blue-100">Coding:</strong> {company.rubric.coding}</div>
                  <div><strong className="font-semibold text-blue-950 dark:text-blue-100">System Design:</strong> {company.rubric.design}</div>
                  <div><strong className="font-semibold text-blue-950 dark:text-blue-100">Mindset:</strong> {company.rubric.mindset}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Filters & Controls Bar */}
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
            {/* Track Switcher */}
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {[
                { id: 'all', label: 'All Topics' },
                { id: 'dsa', label: 'DSA & Coding' },
                { id: 'system-design', label: 'System Design (HLD/LLD)' },
                { id: 'behavioral', label: 'Behavioral & Leadership' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTrack(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    track === t.id
                      ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Experience Level & Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium">Level:</span>
                <select
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="sde1">SDE-1 (0-2 Yrs: 70% DSA)</option>
                  <option value="sde2">SDE-2 (2-5 Yrs: Balanced)</option>
                  <option value="sde3">SDE-3 / Senior (5+ Yrs: 60% Design)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium">Duration:</span>
                <select
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="4weeks">4 Weeks (Fast Sprint)</option>
                  <option value="8weeks">8 Weeks (Standard)</option>
                  <option value="12weeks">12 Weeks (Zero to Hero)</option>
                </select>
              </div>

              {/* Search input */}
              <div className="relative min-w-[180px] flex-1 sm:w-56">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search pattern, algorithm, HLD..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Roadmap Phase Stepper */}
          {locked && (
            <PremiumUpsell
              company={company}
              plans={roadmap.premiumPlans}
              signedIn={Boolean(getUser())}
              onUnlock={unlock}
            />
          )}

          <div className={`mt-8 space-y-8 ${justUnlocked ? 'premium-reveal' : ''}`}>
            {filteredPhases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
                <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No topics match your filter</p>
                <p className="mt-1 text-sm text-slate-500">Try clearing your search query or selecting "All Topics".</p>
                <button
                  type="button"
                  onClick={() => { setSearch(''); setTrack('all'); }}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              filteredPhases.map((phase, pIdx) => {
                const phaseCompletedCount = phase.filteredTopics.filter(t => completed.has(t.id)).length
                const phaseTotalCount = phase.filteredTopics.length
                const phasePercent = phaseTotalCount > 0 ? Math.round((phaseCompletedCount / phaseTotalCount) * 100) : 0
                const isAllDone = phasePercent === 100

                return (
                  <div key={phase.id} className="relative">
                    {/* Connecting line between phases */}
                    {pIdx < filteredPhases.length - 1 && (
                      <div className="absolute left-6 top-16 -bottom-8 w-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />
                    )}

                    {/* Phase Header Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3.5">
                          <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-base font-bold shadow-sm ${
                            isAllDone
                              ? 'bg-emerald-500 text-white'
                              : 'bg-blue-600 text-white dark:bg-blue-500'
                          }`}>
                            {isAllDone ? '✓' : phase.number}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                Phase {phase.number} · {phase.timeline}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                phase.track === 'dsa'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                  : phase.track === 'system-design'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              }`}>
                                {roadmap.trackLabel?.[phase.track] || phase.track.toUpperCase()}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{phase.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{phase.description}</p>
                          </div>
                        </div>

                        {/* Phase Progress & Bulk Toggle */}
                        <div className="flex items-center gap-4 sm:flex-shrink-0">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {phaseCompletedCount}/{phaseTotalCount} Completed
                            </span>
                            <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${isAllDone ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                style={{ width: `${phasePercent}%` }}
                              />
                            </div>
                          </div>
                          {!locked && <button
                            type="button"
                            onClick={() => markPhaseAll(phase.filteredTopics, !isAllDone)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {isAllDone ? 'Clear all' : 'Mark all done'}
                          </button>}
                        </div>
                      </div>

                      {/* Topics Grid */}
                      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {phase.filteredTopics.map(topic => {
                          const isDone = completed.has(topic.id)
                          const isExpanded = expandedTopic === topic.id

                          return (
                            <div
                              key={topic.id}
                              className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                                isDone
                                  ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                                  : 'border-slate-200 bg-slate-50/50 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:border-blue-700'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Completion Checkbox */}
                                {locked ? (
                                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center text-sm" aria-label="Premium topic">🔒</span>
                                ) : <button
                                  type="button"
                                  onClick={() => toggleTopic(topic.id)}
                                  aria-label={`Mark ${topic.title} as ${isDone ? 'incomplete' : 'completed'}`}
                                  aria-pressed={isDone}
                                  // 44px tap area (touch screens force min-height on buttons) around a 20px box; the negative
                                  // margin keeps the box where it was so the card layout doesn't shift.
                                  className="group/check -m-3 flex h-11 w-11 flex-shrink-0 items-center justify-center"
                                >
                                  <span className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                                    isDone
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300 bg-white group-hover/check:border-blue-500 dark:border-slate-600 dark:bg-slate-800'
                                  }`}>
                                    {isDone && <span className="text-xs font-bold">✓</span>}
                                  </span>
                                </button>}

                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{topic.category}</span>
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                        topic.difficulty === 'Easy'
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                          : topic.difficulty === 'Medium'
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                      }`}>
                                        {topic.difficulty}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                      {topic.weightage}
                                    </span>
                                  </div>

                                  <h4 className={`mt-1 text-sm font-bold transition ${isDone ? 'text-slate-500 line-through dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                    {topic.title}
                                  </h4>
                                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{topic.summary}</p>

                                  {locked ? <LockedTopicBody onUnlock={unlock} /> : (<>
                                  {/* Key Concepts bullet tags */}
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {topic.concepts.slice(0, isExpanded ? topic.concepts.length : 2).map((c, idx) => (
                                      <span key={idx} className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-2xs dark:bg-slate-800 dark:text-slate-300">
                                        • {c}
                                      </span>
                                    ))}
                                    {topic.concepts.length > 2 && !isExpanded && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTopic(topic.id)}
                                        className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                                      >
                                        +{topic.concepts.length - 2} more
                                      </button>
                                    )}
                                  </div>

                                  {/* Expandable Details: Cheat Sheet & Practice Links */}
                                  {isExpanded && (
                                    <div className="mt-3.5 space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-900/60">
                                      {/* Cheat Sheet Box */}
                                      {topic.cheatSheet && (
                                        <div className="rounded-md bg-blue-50/70 p-2.5 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                                          <strong className="font-bold">💡 Pro Tip / Blueprint:</strong> {topic.cheatSheet}
                                        </div>
                                      )}

                                      {/* Practice Problems Links */}
                                      {topic.practiceProblems && topic.practiceProblems.length > 0 && (
                                        <div>
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                              Top Recommended Practice & Analysis
                                            </p>
                                            {topic.patternId && topic.poolSize > topic.practiceProblems.length && (
                                              <button
                                                type="button"
                                                onClick={() => setShuffles(s => ({ ...s, [topic.patternId]: (s[topic.patternId] || 0) + 1 }))}
                                                title={`Show another set from ${topic.poolSize} ${company.name} problems`}
                                                className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-blue-300"
                                              >
                                                ↻ Shuffle
                                              </button>
                                            )}
                                          </div>
                                          <div className="mt-2 space-y-2">
                                            {topic.practiceProblems.map((prob, pIdx) => {
                                              const linkCls = 'inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800'
                                              return (
                                                <div
                                                  key={pIdx}
                                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700"
                                                >
                                                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{prob.title}</span>
                                                    {prob.difficulty && (
                                                      <span className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">{prob.difficulty}</span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                    {prob.id ? (
                                                      <>
                                                        <a href={`/practice?id=${prob.id}`} target="_blank" rel="noopener noreferrer"
                                                          title={`Practice "${prob.title}" in the code runner`}
                                                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-700">
                                                          <span>Practice</span><span aria-hidden="true" className="text-[10px]">✎</span>
                                                        </a>
                                                        {prob.hasAnalysis && (
                                                          <a href={`/practice?id=${prob.id}&tab=analysis`} target="_blank" rel="noopener noreferrer"
                                                            title={`Analysis for "${prob.title}"`} className={linkCls}>
                                                            <span>Analysis</span><span aria-hidden="true" className="text-[10px]">↗</span>
                                                          </a>
                                                        )}
                                                      </>
                                                    ) : (
                                                      <a href={prob.path} target="_blank" rel="noopener noreferrer"
                                                        title={`Open "${prob.title}" in the reader`}
                                                        className={linkCls}>
                                                        <span>Open question</span><span aria-hidden="true" className="text-[10px]">↗</span>
                                                      </a>
                                                    )}
                                                    {(() => {
                                                      const link = prob.id ? `/practice?id=${prob.id}` : prob.path
                                                      return (
                                                        <button type="button" onClick={() => copyLink(link)} title="Copy shareable link"
                                                          className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400">
                                                          {copied === link ? '✓' : '🔗'}
                                                        </button>
                                                      )
                                                    })()}
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex justify-end pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setExpandedTopic(null)}
                                          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        >
                                          Collapse details ↑
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {!isExpanded && (
                                    <div className="mt-3 flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTopic(topic.id)}
                                        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                                      >
                                        View practice & tips ({topic.practiceProblems?.length || 0}) ↓
                                      </button>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setExpandedTopic(topic.id)}
                                          className="text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
                                        >
                                          Expand Details ↗
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  </>)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Customize Plan Modal */}
        {plansOpen && <PremiumPlans onBought={onBought} onClose={() => setPlansOpen(false)} />}
        {celebrate && <PremiumCelebration company={company} onClose={() => setCelebrate(false)} />}

        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => { setAuthOpen(false); loadRoadmap() }} />}

        {showPlanModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
            onClick={() => setShowPlanModal(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <h3 id="plan-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Customize Your {company.name} Prep Schedule
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Personalize your weekly cadence according to your interview timeline and daily commitment.
              </p>

              <div className="mt-5 space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Target Preparation Timeline</label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {[
                      { weeks: 4, label: '4 Weeks', sub: 'Fast Track' },
                      { weeks: 8, label: '8 Weeks', sub: 'Balanced' },
                      { weeks: 12, label: '12 Weeks', sub: 'Deep Dive' },
                    ].map(opt => (
                      <button
                        key={opt.weeks}
                        type="button"
                        onClick={() => setCustomPlan(p => ({ ...p, targetWeeks: opt.weeks }))}
                        className={`rounded-xl border p-2.5 text-center transition ${
                          customPlan.targetWeeks === opt.weeks
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500">{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Daily Study Hours</label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {[1.5, 2.5, 4].map(hrs => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setCustomPlan(p => ({ ...p, dailyHours: hrs }))}
                        className={`rounded-xl border p-2 text-center transition ${
                          customPlan.dailyHours === hrs
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="font-bold">{hrs} hrs/day</div>
                        <div className="text-[10px] text-slate-500">{hrs <= 2 ? 'Working Prof.' : hrs <= 3 ? 'Standard' : 'Full Time'}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Calculated Study Cadence:</h4>
                  <ul className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>• Target pace: <strong>~{Math.ceil(totalTopicsCount / customPlan.targetWeeks)} topics per week</strong></li>
                    <li>• Estimated total prep: <strong>{customPlan.targetWeeks * 7 * customPlan.dailyHours} hours</strong></li>
                    <li>• Weekly commitment: <strong>{customPlan.dailyHours * 7} hours/week</strong></li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(CUSTOM_PLAN_KEY, JSON.stringify(customPlan))
                    setShowPlanModal(false)
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Stand-in for a topic's premium details. Fake chips, so nothing of the real content reaches the page.
function LockedTopicBody({ onUnlock }) {
  return (
    <div className="relative mt-3">
      <div aria-hidden="true" className="pointer-events-none select-none blur-[3px]">
        <div className="flex flex-wrap gap-1.5">
          {['Core pattern walkthrough', 'Company-tagged problems', 'Interview cheat sheet'].map(t => (
            <span key={t} className="rounded-md bg-white px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">• {t}</span>
          ))}
        </div>
        <div className="mt-2 h-8 rounded-md bg-slate-200/70 dark:bg-slate-700/50" />
      </div>
      <button type="button" onClick={onUnlock}
        className="absolute inset-0 m-auto h-7 w-fit rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-3 text-[11px] font-bold text-white shadow-md">
        🔒 Unlock with Premium
      </button>
    </div>
  )
}

function PremiumUpsell({ company, plans, signedIn, onUnlock }) {
  const monthlyPlan = plans?.find(p => p.key === 'monthly')
  const from = monthlyPlan?.price
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-pink-50 p-5 shadow-sm dark:border-amber-500/30 dark:from-amber-950/30 dark:via-slate-900 dark:to-pink-950/30">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">★ Premium</span>
          <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">Unlock your personalized {company.name} roadmap</h3>
          <ul className="mt-2 grid gap-1 text-xs text-slate-700 dark:text-slate-300 sm:grid-cols-2">
            {[
              `${company.name}-tagged DSA problems for every pattern, with shuffle`,
              'Direct links to system design & LLD answers',
              'Behavioral question bank mapped to company values',
              'Cheat sheets, progress tracking & readiness score',
            ].map(b => <li key={b} className="flex gap-1.5"><span className="text-emerald-500">✓</span>{b}</li>)}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-1.5 md:items-end">
          {from && (
            <span className="text-sm text-slate-600 dark:text-slate-300">from{' '}
              {monthlyPlan.regular > from && <span className="mr-1 text-base text-slate-400 line-through">{rupees(monthlyPlan.regular)}</span>}
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{rupees(from)}</span>
            </span>
          )}
          <button type="button" onClick={onUnlock}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-60">
            {signedIn ? 'See plans' : 'Sign in to get Premium'}
          </button>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Monthly, yearly or lifetime · one-time payment</span>
        </div>
      </div>
    </div>
  )
}

// Problems tagged with the company (tag = its name in the problem bank when that differs, e.g. "Phonepe"),
// or with any company in problemsFrom.
const companyProblems = (problems, company) => {
  const tags = company.problemsFrom || [company.tag || company.name]
  return problems.filter(p => (p.companies || []).some(c => tags.includes(c)))
}

const rupees = n =>`₹${Number(n).toLocaleString('en-IN')}`

// Company logo, falling back to the letter badge if the image can't load (offline, blocked, ...).
function CompanyLogo({ company, className = '' }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={`flex flex-shrink-0 items-center justify-center overflow-hidden font-bold ${className}`}>
      {company.logo && !failed
        ? <img src={company.logo} alt="" loading="lazy" className="h-[70%] w-[70%] object-contain" onError={() => setFailed(true)} />
        : company.icon}
    </span>
  )
}

// Shown once right after a successful payment: check mark draws in, confetti bursts, then it closes itself.
const CELEBRATION_CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  color: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6'][i % 5],
  dx: Math.round(Math.cos((i / 28) * Math.PI * 2) * (140 + (i % 4) * 30)),
  delay: (i % 7) * 40,
}))

function PremiumCelebration({ company, onClose }) {
  // The parent passes a new function each render; read it through a ref so the auto-close timer isn't reset.
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const t = setTimeout(() => close.current(), 4200)
    const onKey = e => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [])
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="premium-welcome-title" onClick={onClose}
      className="premium-fade premium-celebrate fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      {CELEBRATION_CONFETTI.map((c, i) => (
        <span key={i} aria-hidden="true" className="confetti-piece" style={{ background: c.color, '--dx': `${c.dx}px`, animationDelay: `${c.delay}ms` }} />
      ))}
      <div onClick={e => e.stopPropagation()}
        className="result-pop relative w-full max-w-sm rounded-3xl border border-amber-300/60 bg-white p-7 text-center shadow-2xl dark:border-amber-500/30 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500 shadow-lg shadow-pink-500/30">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path className="premium-check" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">★ Premium unlocked</p>
        <h2 id="premium-welcome-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Welcome to Premium!</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Your personalized {company?.name} roadmap is ready: company-tagged problems, cheat sheets and direct question links.
        </p>
        <button type="button" onClick={onClose} autoFocus
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95">
          Start preparing →
        </button>
      </div>
    </div>
  )
}
