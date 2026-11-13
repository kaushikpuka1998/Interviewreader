import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { designBlueprintFor } from '../lib/designBlueprints.js'
import { nodeKind } from '../lib/designBlueprintCatalog.js'
import { useFeature } from '../lib/features.js'
import TopBar from './TopBar.jsx'
import Loader from './Loader.jsx'
import Markdown from './Markdown.jsx'
import AuthModal from './AuthModal.jsx'
import ShareLinkedIn from './ShareLinkedIn.jsx'
import PremiumPlans from './PremiumPlans.jsx'
import { getUser } from '../lib/auth.js'
import { setPageSeo } from '../lib/seo.js'
import { trackFunnel } from '../lib/analytics.js'
import { respond, newInterviewState, systemName } from '../lib/interviewer.js'
import { fetchDesignQuestions, fetchDesignQuestion, submitDesignAttempt, fetchDesignAttempts, fetchDesignAttempt, fetchPracticeQuota, probeDesignAnswer, simulateArchitecture, fetchLatestSimulation } from '../lib/designPractice.js'

// Solo system design practice: pick a "Design …" question, answer by voice or typing under a timer, and get a
// coverage score out of 10 with what was covered and missed. 3 free scored questions per member, then Premium unlocks continued practice.
const ROUND_SECONDS = 45 * 60

const card = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950'
const btnPrimary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50'
const btnSecondary = 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'

const MODE_LABEL = { voice: '🎙 voice', text: '⌨ typed', interview: '🗣 interview' }

const setUrl = params => {
  const qs = new URLSearchParams(params).toString()
  window.history.pushState({}, '', '/interview/practice' + (qs ? `?${qs}` : ''))
}

export default function DesignPracticePage() {
  const signedIn = Boolean(getUser())
  const simulationEnabled = useFeature('hld_simulation')
  const [authOpen, setAuthOpen] = useState(!signedIn)
  const [questions, setQuestions] = useState(null)
  const [quota, setQuota] = useState(null)
  const [history, setHistory] = useState([])
  const [current, setCurrent] = useState(null)     // question being answered
  const [result, setResult] = useState(null)       // a scored attempt
    const [premiumPlansOpen, setPremiumPlansOpen] = useState(false)
  const [showSimulationIntro, setShowSimulationIntro] = useState(() => localStorage.getItem('ir_hld_simulation_intro_seen') !== '1')
  const [error, setError] = useState('')

  useEffect(() => {
    setPageSeo({ title: 'System Design Interview Practice, Scored | Interview Reader', description: 'Practise system design interview questions alone, by voice or typing, and get a coverage score out of 10 with what you covered and missed.', path: '/interview/practice' })
  }, [])

  const refresh = useCallback(() => {
    if (!getUser()) return
    fetchDesignQuestions().then(setQuestions).catch(e => setError(e.message))
    fetchPracticeQuota().then(setQuota).catch(() => {})
    fetchDesignAttempts().then(setHistory).catch(() => {})
  }, [])

  // Open what the URL points at: ?q=<question id> starts a session, ?attempt=<id> shows a past result.
  const openFromUrl = useCallback(() => {
    const p = new URLSearchParams(window.location.search)
    setError('')
    if (p.get('attempt')) { setCurrent(null); fetchDesignAttempt(p.get('attempt')).then(setResult).catch(e => setError(e.message)); return }
    setResult(null)
    if (p.get('q')) fetchDesignQuestion(p.get('q')).then(q => { setQuota(q.quota); if (q.quota?.canAttempt === false) { setCurrent(null); setPremiumPlansOpen(true) } else setCurrent(q) }).catch(e => setError(e.message))
    else setCurrent(null)
  }, [])

  useEffect(() => {
    if (!signedIn) return
    refresh()
    openFromUrl()
    window.addEventListener('popstate', openFromUrl)
    return () => window.removeEventListener('popstate', openFromUrl)
  }, [signedIn, refresh, openFromUrl])

  const start = (id, mode) => { if (quota?.canAttempt === false) { setPremiumPlansOpen(true); return }; setUrl({ q: id, ...(mode ? { mode } : {}) }); openFromUrl(); window.scrollTo(0, 0) }
  const showAttempt = id => { setUrl({ attempt: id }); openFromUrl(); window.scrollTo(0, 0) }
  const backToList = () => { setUrl({}); openFromUrl(); refresh() }

  const onScored = attempt => {
    trackFunnel('first_answer')
    setQuota(attempt.quota)
    setResult(attempt)
    setCurrent(null)
    window.history.pushState({}, '', `/interview/practice?attempt=${attempt.id}`)
    window.scrollTo(0, 0)
    refresh()
  }

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-slate-100 px-3 py-6 sm:px-4 dark:bg-slate-900">
        <div className="mx-auto max-w-[1720px] space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <a href="/interview" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Mock interviews</a>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">System design practice</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Answer a design question on your own, by voice or typing, and get a score out of 10.</p>
            </div>
            {quota && <QuotaBar quota={quota} onMore={() => setPremiumPlansOpen(true)} />}
          </header>

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}

          {!signedIn ? (
            <div className={`${card} text-center`}>
              <p className="text-slate-700 dark:text-slate-300">Sign in to practise. Every member gets <strong>3 free system-design questions</strong>, then Premium unlocks more.</p>
              <button type="button" onClick={() => setAuthOpen(true)} className={`${btnPrimary} mt-4`}>Sign in or create a free account</button>
            </div>
          ) : result ? (
            <ResultView attempt={result} quota={quota} onUpgrade={() => setPremiumPlansOpen(true)} onRetry={() => start(result.questionId, result.mode === 'interview' ? 'interview' : undefined)} onBack={backToList} />
          ) : current ? (
            <Session question={current} quota={quota} onScored={onScored} onOutOfAttempts={q => { setQuota(q); setPremiumPlansOpen(true) }} onBack={backToList}
              onSimulationQuota={simQuota => setCurrent(q => q ? { ...q, simulationQuota: simQuota } : q)}
              onUpgradePremium={() => setPremiumPlansOpen(true)} />
          ) : !questions ? (
            <Loader label="Loading design questions…" />
          ) : (
            <>
            {simulationEnabled && showSimulationIntro && <HldSimulationIntro onDismiss={() => { localStorage.setItem('ir_hld_simulation_intro_seen', '1'); setShowSimulationIntro(false) }} />}
            <MockInterviewPromo questions={questions} quota={quota} onStart={id => start(id, 'interview')} />
            <div className="grid gap-5 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
              <QuestionList questions={questions} onStart={start} />
              <History items={history} onOpen={showAttempt} />
            </div>
            </>
          )}
        </div>
      </main>
      {premiumPlansOpen && <PremiumPlans onClose={() => setPremiumPlansOpen(false)} onBought={() => { setPremiumPlansOpen(false); window.location.reload() }} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
    </>
  )
}

function QuotaBar({ quota, onMore }) {
  if (quota.unlimited) return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Admin · unlimited HLD practice</span>
  if (quota.premium) return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Premium · HLD practice unlocked</span>
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
      {quota.freeLeft > 0
        ? <span className="text-slate-700 dark:text-slate-300"><strong>{quota.freeLeft}</strong> of {quota.freeTotal} free questions left</span>
        : <span className="font-semibold text-rose-600 dark:text-rose-400">3 free questions used</span>}
      {!quota.canAttempt && <button type="button" onClick={onMore} className="rounded-lg bg-gradient-to-r from-amber-500 to-pink-600 px-3 py-1 text-xs font-bold text-white">Unlock with Premium</button>}
    </div>
  )
}

// Promotes the voice mock interviewer: one click starts a full interview on a popular design question.
function MockInterviewPromo({ questions, quota, onStart }) {
  const pool = questions.filter(q => q.curated)
  const startRandom = () => {
    const fresh = pool.filter(q => !q.attempts)
    const list = fresh.length ? fresh : pool.length ? pool : questions
    if (list.length) onStart(list[Math.floor(Math.random() * list.length)].id)
  }
  const freeLeft = quota && !quota.unlimited && !quota.premium ? quota.freeLeft : null
  const hasPremiumAccess = Boolean(quota?.premium || quota?.unlimited)
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-6 text-white shadow-lg">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-amber-300/20 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">🗣 New · Voice mock interviewer</span>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">Walk into your system design round confident.</h2>
          <p className="mt-2 text-sm text-white/90 sm:text-base">
            An interviewer asks the question out loud, listens to your answer, answers your questions on scale (DAU, MAU), follows up on what you miss,
            and ends with a real hiring decision: <strong>Strong Hire</strong>, <strong>Hire</strong>, <strong>Weak Hire</strong>, <strong>No Hire</strong> or <strong>Rejected</strong>.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
            <li>✓ Speak or type</li><li>✓ Follow-up questions</li><li>✓ Rating out of 10 + written feedback</li>
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button type="button" onClick={startRandom}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow-md transition hover:scale-[1.02] hover:bg-violet-50">
            {freeLeft === 0 ? 'Unlock with Premium →' : 'Start a mock interview →'}
          </button>
          <span className="text-xs text-white/85">
            {!quota ? '3 free scored questions for every member' : hasPremiumAccess ? 'Premium · HLD practice unlocked' : freeLeft > 0 ? '3 free scored questions · ' + freeLeft + ' left' : '3 free questions used · Premium required'}
          </span>
          <span className="text-xs text-white/70">or pick any question below and press <em>Start interview</em></span>
        </div>
      </div>
    </section>
  )
}

function QuestionList({ questions, onStart }) {
  const [q, setQ] = useState('')
  const [onlyCurated, setOnlyCurated] = useState(false)
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return questions
      .filter(x => (!onlyCurated || x.curated) && (!needle || x.title.toLowerCase().includes(needle)))
      .sort((a, b) => (b.curated - a.curated))   // the most-asked designs (hand-written rubrics) first
  }, [questions, q, onlyCurated])
  return (
    <section className={card}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search, e.g. rate limiter, WhatsApp, Uber…" aria-label="Search design questions"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={onlyCurated} onChange={e => setOnlyCurated(e.target.checked)} /> Most asked only
        </label>
      </div>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{shown.length} questions</p>
      <ul className="max-h-[38rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {shown.map(x => (
          <li key={x.id}>
            <button type="button" onClick={() => onStart(x.id)} className="group flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">{x.title}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {x.curated && <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">MOST ASKED</span>}
                  {x.attempts ? `${x.attempts} attempt${x.attempts > 1 ? 's' : ''}` : 'Not tried yet'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {x.best != null && <ScoreChip score={x.best} />}
                <span aria-hidden="true" className="text-slate-300 group-hover:text-blue-500">→</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function History({ items, onOpen }) {
  return (
    <aside className={card}>
      <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Your attempts</h2>
      {!items.length ? <p className="text-sm text-slate-500">Your scored attempts will show up here.</p> : (
        <ul className="max-h-[36rem] space-y-1 overflow-y-auto">
          {items.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800 dark:text-slate-200">{a.title}</span>
                  <span className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })} · {MODE_LABEL[a.mode] || MODE_LABEL.text}{a.mode === 'interview' && INTERVIEWERS[a.difficulty] ? ` · ${INTERVIEWERS[a.difficulty].icon} ${INTERVIEWERS[a.difficulty].label}` : ''}</span>
                </span>
                <ScoreChip score={a.score} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function ScoreChip({ score }) {
  const tone = score >= 7.5 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : score >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${tone}`}>{Number(score).toFixed(1)}</span>
}

// Browser speech-to-text. Chrome ends recognition after a pause, so it restarts until the member presses Stop.
function useSpeech(onFinal) {
  const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const rec = useRef(null)
  const wanted = useRef(false)
  const finalRef = useRef(onFinal)
  finalRef.current = onFinal

  const stop = useCallback(() => { wanted.current = false; rec.current?.stop(); setListening(false); setInterim('') }, [])
  const start = useCallback(() => {
    if (!Recognition) return
    setError('')
    const r = new Recognition()
    r.continuous = true
    r.interimResults = true
    r.lang = navigator.language || 'en-US'
    r.onresult = e => {
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript
        if (e.results[i].isFinal) finalRef.current(text.trim())
        else pending += text
      }
      setInterim(pending)
    }
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wanted.current = false; setError('Microphone access was blocked. Allow it in the browser, or type your answer.') }
    }
    r.onend = () => { if (wanted.current) { try { r.start() } catch { /* already starting */ } } else setListening(false) }
    rec.current = r
    wanted.current = true
    r.start()
    setListening(true)
  }, [Recognition])
  useEffect(() => () => { wanted.current = false; rec.current?.stop() }, [])
  return { supported: Boolean(Recognition), listening, interim, error, start, stop }
}

function ArchitectureCanvas({ question, onSimulationQuota, onUpgradePremium }) {
  const simulationEnabled = useFeature('hld_simulation')
  const blueprint = designBlueprintFor(question)
  const fallbackPalette = ['Gateway', 'Load-balancer', 'Redis', 'Read-replica', 'Queue', 'CQRS', 'Sharding', 'Asset storage', 'Monitoring']
  const palette = [...new Set([...blueprint.components, ...fallbackPalette])]
  const starterNodes = [{ type: 'Client', x: 5, y: 47 }, { type: 'Gateway', x: 21, y: 47 }, { type: 'Service', x: 52, y: 47 }, { type: 'Database', x: 76, y: 47 }]
  const starterEdges = [['Client', 'Gateway'], ['Gateway', 'Service'], ['Service', 'Database']]
  const layout = blueprint.positions
  const formatRps = value => {
    const units = [[1_000_000_000, 'Billion'], [1_000_000, 'Million'], [1_000, 'Thousand']]
    const unit = units.find(([amount]) => value >= amount)
    return unit ? `${(value / unit[0]).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit[1]}` : value.toLocaleString()
  }
  const [nodes, setNodes] = useState(starterNodes)
  const [edges, setEdges] = useState(starterEdges)
  const [linkFrom, setLinkFrom] = useState(null)
  const [linkCursor, setLinkCursor] = useState(null)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [showReference, setShowReference] = useState(false)
  const requestTargets = [1_000, 10_000, 1_000_000, 100_000_000, 1_000_000_000]
  const [targetStep, setTargetStep] = useState(blueprint.defaultStep)
  const targetRps = requestTargets[targetStep]
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [tests, setTests] = useState([])
  const [restoredSimulation, setRestoredSimulation] = useState(false)
  const [simulationQuota, setSimulationQuota] = useState(question.simulationQuota || null)
  const [simulationError, setSimulationError] = useState('')
  const architecture = useRef({ nodes: starterNodes, edges: starterEdges })
  const history = useRef({ past: [], future: [] })
  const drag = useRef(null)
  const canvasRef = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ width: 128, height: 80 })
  const nodeWidthPct = (160 / canvasSize.width) * 100
  const nodeHeightPct = (80 / canvasSize.height) * 100
  // The canvas is never narrower or shorter than its widest column and tallest row need (cards are a fixed 160x80), so cards can't overlap.
  const lanes = (key, tol) => { const v = Object.values(layout).map(p => p[key]).sort((a, b) => a - b); return v.filter((x, i) => i === 0 || x - v[i - 1] > tol).length }
  const minCanvasW = Math.max(560, lanes('x', 4) * 178 + 24)
  const minCanvasH = Math.max(480, lanes('y', 8) * 108 + 40)
  useEffect(() => { setSimulationQuota(question.simulationQuota || null) }, [question.id, question.simulationQuota])
  useEffect(() => {
    let cancelled = false
    setNodes(starterNodes)
    setEdges(starterEdges)
    architecture.current = { nodes: starterNodes, edges: starterEdges }
    history.current = { past: [], future: [] }
    setHistoryVersion(version => version + 1)
    setShowReference(false)
    setTargetStep(blueprint.defaultStep)
    setResult(null)
    setTests([])
    setRestoredSimulation(false)
    fetchLatestSimulation(question.id).then(saved => {
      if (cancelled || !saved.nodes || !saved.edges) return
      const restored = { nodes: saved.nodes, edges: saved.edges }
      architecture.current = restored
      setNodes(restored.nodes)
      setEdges(restored.edges)
      const savedStep = requestTargets.indexOf(Number(saved.targetRps))
      if (savedStep >= 0) setTargetStep(savedStep)
      setResult(saved.result || null)
      setTests((saved.result?.tests || []).map(test => ({ ...test, status: test.passed ? 'passed' : 'failed' })))
      setRestoredSimulation(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [question.id])
  const sameArchitecture = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const snapshot = () => ({ nodes: architecture.current.nodes.map(n => ({ ...n })), edges: architecture.current.edges.map(e => [...e]) })
  const apply = next => { architecture.current = next; setNodes(next.nodes); setEdges(next.edges) }
  const commit = next => {
    const current = snapshot()
    if (sameArchitecture(current, next)) return
    history.current = { past: [...history.current.past.slice(-39), current], future: [] }
    apply(next)
    setHistoryVersion(v => v + 1)
  }
  const undo = () => {
    const previous = history.current.past.at(-1)
    if (!previous) return
    const current = snapshot()
    history.current = { past: history.current.past.slice(0, -1), future: [current, ...history.current.future] }
    apply(previous)
    setHistoryVersion(v => v + 1)
  }
  const redo = () => {
    const next = history.current.future[0]
    if (!next) return
    const current = snapshot()
    history.current = { past: [...history.current.past, current], future: history.current.future.slice(1) }
    apply(next)
    setHistoryVersion(v => v + 1)
  }
  useEffect(() => {
    const onKeyDown = event => {
      const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable
      if (editable || !(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo() }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const update = () => { const rect = canvas.getBoundingClientRect(); setCanvasSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) }) }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  const add = type => {
    const current = architecture.current
    if (current.nodes.some(x => x.type === type)) return
    commit({ nodes: [...current.nodes, { type, ...(layout[type] || { x: 10 + (current.nodes.length % 4) * 19, y: 18 + (current.nodes.length % 3) * 28 }) }], edges: current.edges })
  }
  const arrange = () => {
    const current = architecture.current
    commit({ nodes: current.nodes.map((node, index) => ({ ...node, ...(layout[node.type] || { x: 10 + (index % 4) * 19, y: 18 + (Math.floor(index / 4) % 3) * 28 }) })), edges: current.edges })
  }
  const pointerPosition = (e, rect) => ({ x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)) })
  const move = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (linkFrom) { setLinkCursor(pointerPosition(e, rect)); return }
    if (!drag.current) return
    const point = pointerPosition(e, rect)
    apply({ nodes: architecture.current.nodes.map(n => n.type === drag.current.type ? { ...n, x: Math.max(0, Math.min(100 - nodeWidthPct, point.x)), y: Math.max(0, Math.min(100 - nodeHeightPct, point.y)) } : n), edges: architecture.current.edges })
  }
  const finishDrag = () => {
    if (!drag.current) return
    const origin = drag.current.origin
    drag.current = null
    const current = snapshot()
    if (!sameArchitecture(origin, current)) {
      history.current = { past: [...history.current.past.slice(-39), origin], future: [] }
      setHistoryVersion(v => v + 1)
    }
  }
  const finishLink = target => {
    const current = architecture.current
    if (linkFrom && linkFrom !== target && !current.edges.some(([from, to]) => from === linkFrom && to === target)) commit({ nodes: current.nodes, edges: [...current.edges, [linkFrom, target]] })
    setLinkFrom(null)
    setLinkCursor(null)
  }
  const disconnectComponent = type => {
    const current = architecture.current
    commit({ nodes: current.nodes, edges: current.edges.filter(([from, to]) => from !== type && to !== type) })
    setLinkFrom(null)
    setLinkCursor(null)
  }
  const disconnectEdge = (from, to) => {
    const current = architecture.current
    commit({ nodes: current.nodes, edges: current.edges.filter(([source, target]) => source !== from || target !== to) })
  }
  const reset = () => commit({ nodes: starterNodes, edges: starterEdges })
  const referenceEdges = blueprint.edges
  const isRecommendedDesign = design => {
    const nodeTypes = design.nodes.map(node => node.type).sort().join('|')
    const expectedTypes = blueprint.components.slice().sort().join('|')
    const edgeList = design.edges.map(([from, to]) => `${from}->${to}`).sort().join('|')
    const expectedEdges = referenceEdges.map(([from, to]) => `${from}->${to}`).sort().join('|')
    return nodeTypes === expectedTypes && edgeList === expectedEdges
  }
  const loadReference = () => {
    const reference = { nodes: blueprint.components.map((type, index) => ({ type, ...(layout[type] || { x: 10 + (index % 4) * 19, y: 18 + (Math.floor(index / 4) % 3) * 28 }) })), edges: referenceEdges }
    commit(reference)
    setShowReference(true)
    run(reference)
  }
  const run = async (design = architecture.current) => {
    if (simulationQuota && !simulationQuota.canSimulate && !simulationQuota.premium) { onUpgradePremium?.(); return }
    setSimulationError('')
    setBusy(true); setResult(null); setTests([{ name: 'Test 1 · Request routing', status: 'running' }, { name: 'Test 2 · Database pressure', status: 'waiting' }, { name: 'Test 3 · Scale target', status: 'waiting' }])
    try {
      const response = await simulateArchitecture(question.id, design.nodes, design.edges, targetRps, isRecommendedDesign(design))
      if (response.simulationQuota) { setSimulationQuota(response.simulationQuota); onSimulationQuota?.(response.simulationQuota) }
      setRestoredSimulation(false)
      const checks = response.tests || []
      setTests(checks.map((t, i) => ({ ...t, status: i === 0 ? 'running' : 'waiting' })))
      for (let i = 0; i < checks.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 650))
        setTests(ts => ts.map((t, index) => index === i ? { ...t, status: t.passed ? 'passed' : 'failed' } : index === i + 1 ? { ...t, status: 'running' } : t))
      }
      setResult(response)
    } catch (error) {
      if (error.status === 402) {
        if (error.simulationQuota) { setSimulationQuota(error.simulationQuota); onSimulationQuota?.(error.simulationQuota) }
        onUpgradePremium?.()
      } else setSimulationError(error.message)
    } finally { setBusy(false) }
  }
  const beginLink = (event, type) => {
    event.stopPropagation()
    drag.current = null
    const rect = event.currentTarget.closest('.arch-canvas').getBoundingClientRect()
    setLinkFrom(type)
    setLinkCursor(pointerPosition(event, rect))
  }
  const toPx = path => { let i = 0; return path.replace(/-?\d*\.?\d+/g, n => (+n * (i++ % 2 ? canvasSize.height : canvasSize.width) / 100).toFixed(1)) }
  const connectionPath = (from, to) => toPx(pctPath(from, to))
  const pctPath = (from, to) => {
    const dx = (to.x - from.x) * canvasSize.width / 100
    const dy = (to.y - from.y) * canvasSize.height / 100
    if (Math.abs(dx) >= Math.abs(dy)) {
      const direction = dx >= 0 ? 1 : -1
      const sx = direction > 0 ? from.x + nodeWidthPct : from.x
      const ex = direction > 0 ? to.x : to.x + nodeWidthPct
      const sy = from.y + nodeHeightPct / 2
      const ey = to.y + nodeHeightPct / 2
      const bend = Math.max(6, Math.abs(ex - sx) * 0.42)
      return 'M ' + sx + ' ' + sy + ' C ' + (sx + direction * bend) + ' ' + sy + ', ' + (ex - direction * bend) + ' ' + ey + ', ' + ex + ' ' + ey
    }
    const direction = dy >= 0 ? 1 : -1
    const sx = from.x + nodeWidthPct / 2
    const ex = to.x + nodeWidthPct / 2
    const sy = direction > 0 ? from.y + nodeHeightPct : from.y
    const ey = direction > 0 ? to.y : to.y + nodeHeightPct
    const bend = Math.max(5, Math.abs(ey - sy) * 0.38)
    return 'M ' + sx + ' ' + sy + ' C ' + sx + ' ' + (sy + direction * bend) + ', ' + ex + ' ' + (ey - direction * bend) + ', ' + ex + ' ' + ey
  }
  if (!simulationEnabled) return null
  return <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-400/20 dark:bg-slate-950 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-600 dark:text-violet-300">Architecture canvas</p><h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Design for scale</h3><p className="mt-1 text-xs font-medium text-slate-500">{linkFrom ? `Connecting from ${linkFrom}: release on a component’s left input dot.` : 'Drag cards to position. Connect an output dot to an input dot; vertical flows attach at the top and bottom. Double-click a card to disconnect it; click a line to remove only that link.'}</p></div><div className="flex items-center gap-2"><button type="button" onClick={undo} disabled={!history.current.past.length} title="Undo (⌘/Ctrl + Z)" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200">↶ Undo</button><button type="button" onClick={redo} disabled={!history.current.future.length} title="Redo (⌘/Ctrl + Shift + Z)" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200">↷</button><button type="button" onClick={arrange} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-violet-400 dark:border-white/10 dark:text-slate-200">Auto arrange</button><button type="button" onClick={reset} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-violet-400 dark:border-white/10 dark:text-slate-200">Reset</button><button type="button" onClick={() => run()} disabled={busy} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-60">{busy ? 'Running tests…' : 'Submit architecture'}</button></div></div>
    {simulationQuota && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-800/20 bg-emerald-950/80 px-3 py-2 text-xs text-emerald-100"><span>{simulationQuota.premium ? 'Premium · unlimited simulations' : `${simulationQuota.freeLeft} of ${simulationQuota.freeTotal} free simulations left`}</span>{!simulationQuota.premium && simulationQuota.freeLeft <= 1 && <button type="button" onClick={onUpgradePremium} className="rounded-lg bg-emerald-300 px-3 py-1.5 font-bold text-emerald-950 transition hover:bg-emerald-200">Get unlimited with Premium</button>}</div>}
    {restoredSimulation && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Restored your last submitted design and simulation for this question.</p>}
    {simulationError && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{simulationError}</p>}
    <div className="mt-4 overflow-x-auto rounded-2xl"><div ref={canvasRef} style={{ minWidth: minCanvasW, minHeight: minCanvasH }} className="arch-canvas relative h-[30rem] touch-pan-x touch-pan-y overflow-hidden sm:touch-none rounded-2xl border border-slate-200 shadow-inner shadow-slate-200/40 md:h-[34rem] dark:border-white/10 dark:shadow-black/20" onPointerMove={move} onPointerUp={() => { finishDrag(); if (linkFrom) { setLinkFrom(null); setLinkCursor(null) } }} onPointerLeave={() => { finishDrag(); if (linkFrom) { setLinkFrom(null); setLinkCursor(null) } }}>
      <svg viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} className="pointer-events-none absolute inset-0 h-full w-full"><defs><marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" /></marker></defs>{edges.map(([from, to], edgeIndex) => { const a = nodes.find(n => n.type === from), b = nodes.find(n => n.type === to); if (!a || !b) return null; const d = connectionPath(a, b); return <g key={`${from}-${to}`} className="pointer-events-auto cursor-pointer" onClick={event => { event.stopPropagation(); disconnectEdge(from, to) }}><title>Click to remove this connection</title><path d={d} fill="none" stroke="transparent" strokeWidth="18" vectorEffect="non-scaling-stroke" /><path d={d} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeDasharray="7 8" vectorEffect="non-scaling-stroke" markerEnd="url(#arch-arrow)" className="pointer-events-none arch-flow" /><circle r="3.5" fill="#c4b5fd" className="arch-packet"><animateMotion dur={`${1.8 + (edgeIndex % 3) * .35}s`} repeatCount="indefinite" path={d} begin={`${edgeIndex * .22}s`} /></circle></g> })}{linkFrom && linkCursor && (() => { const source = nodes.find(n => n.type === linkFrom); if (!source) return null; const sx = source.x + nodeWidthPct, sy = source.y + nodeHeightPct / 2, ex = linkCursor.x, ey = linkCursor.y, bend = Math.max(8, Math.abs(ex - sx) * 0.46); return <path d={toPx(`M ${sx} ${sy} C ${sx + bend} ${sy}, ${ex - bend} ${ey}, ${ex} ${ey}`)} fill="none" stroke="#a78bfa" strokeWidth="3" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" markerEnd="url(#arch-arrow)" className="arch-link-preview" /> })()}</svg>
      {nodes.map((n, i) => {
        const kind = nodeKind(n.type)
        const isEntry = kind === 'entry'
        const isStorage = kind === 'storage'
        const isMessaging = kind === 'messaging'
        const isCollaboration = kind === 'coordination'
        const icon = isEntry ? '◉' : isStorage ? '▤' : isMessaging ? '⚡' : kind === 'balancer' ? '⇄' : n.type === 'Update Log' ? '≡' : isCollaboration ? '✦' : '◇'
        const category = isEntry ? 'Entry point' : isStorage ? 'Storage' : isMessaging ? 'Messaging' : isCollaboration ? 'Coordination' : kind === 'observability' ? 'Observability' : 'Compute'
        const accent = isEntry ? 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300' : isStorage ? 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300' : isMessaging ? 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300' : isCollaboration ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300'
        const border = isEntry ? 'border-sky-200' : isStorage ? 'border-amber-200' : isMessaging ? 'border-rose-200' : isCollaboration ? 'border-emerald-200' : kind === 'observability' ? 'border-cyan-200' : 'border-violet-200'
        return <button key={n.type} type="button" onPointerDown={e => { drag.current = { type: n.type, origin: snapshot() }; e.currentTarget.setPointerCapture(e.pointerId) }} onDoubleClick={() => disconnectComponent(n.type)} style={{ left: n.x + '%', top: n.y + '%' }} className={`arch-node touch-none absolute flex h-20 w-40 cursor-grab items-center rounded-2xl border bg-white/95 px-3 py-2 text-left shadow-[0_12px_32px_-18px_rgba(15,23,42,0.45)] transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-18px_rgba(91,33,182,0.45)] dark:bg-slate-900/95 ${linkFrom === n.type ? 'ring-4 ring-violet-400/40 border-violet-600' : border}`}>
          <span onPointerUp={e => { e.stopPropagation(); finishLink(n.type) }} title="Input: release a connection here" className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-violet-500 shadow-sm transition-transform hover:scale-125 dark:border-slate-900" aria-label="Input connection point" />
          <span onPointerUp={e => { e.stopPropagation(); finishLink(n.type) }} title="Top input connection point" className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-white bg-violet-500 shadow-sm transition-transform hover:scale-125 dark:border-slate-900" aria-label="Top input connection point" />
          <span onPointerDown={e => beginLink(e, n.type)} title="Output: drag to another input" className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-violet-500 shadow-sm transition-transform hover:scale-125 dark:border-slate-900" aria-label="Output connection point" />
          <span onPointerDown={e => beginLink(e, n.type)} title="Bottom output connection point" className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-white bg-violet-500 shadow-sm transition-transform hover:scale-125 dark:border-slate-900" aria-label="Bottom output connection point" />
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${accent}`}>{icon}</span>
          <span className="ml-2.5 min-w-0">
            <b title={n.type} className="block line-clamp-2 text-[13px] font-extrabold leading-[18px] text-slate-900 dark:text-white">{n.type.length > 24 ? (n.type.replace(/\s*\([^)]*\)/g, '').trim() || n.type) : n.type}</b>
            <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-slate-500 dark:bg-white/[.07] dark:text-slate-400">{category}</span>
          </span>
        </button>
      })}
    </div></div>
    <p className="mt-1.5 text-xs text-slate-500 lg:hidden">Scroll sideways on the diagram to see all of it. Drag a card to move it.</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 dark:border-violet-400/20 dark:bg-violet-400/10"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-violet-600 dark:text-violet-300">Question-aware blueprint</p><p className="mt-0.5 text-sm font-bold text-violet-950 dark:text-violet-100">{blueprint.name}</p><p className="mt-0.5 max-w-3xl text-xs text-violet-900/75 dark:text-violet-100/75">{blueprint.summary}</p></div><button type="button" onClick={loadReference} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700">Load recommended design</button></div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-semibold text-slate-500">Recommended building blocks:</span>{palette.map(type => <button key={type} type="button" onClick={() => add(type)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-violet-400 hover:text-violet-700 dark:border-white/10 dark:text-slate-300">+ {type}</button>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[.04]"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">Target RPS</label><div className="relative min-w-[16rem] flex-1 py-3"><input type="range" min="0" max="4" step="1" value={targetStep} onChange={e => setTargetStep(Number(e.target.value))} aria-label="Target requests per second" className="relative z-10 w-full cursor-pointer accent-violet-600" /><div className="pointer-events-none absolute z-20 inset-x-[9px] top-1/2 flex -translate-y-1/2 justify-between">{requestTargets.map((value, index) => <span key={value} className={`h-2.5 w-2.5 rounded-full ring-2 ring-slate-50 dark:ring-slate-900 ${index <= targetStep ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'}`} />)}</div><div className="absolute inset-x-0 top-full flex justify-between pt-1 text-[10px] font-bold text-slate-500"><span>1K</span><span>10K</span><span>1M</span><span>100M</span><span>1B</span></div></div><output className="min-w-36 text-right text-xs font-bold text-violet-700 dark:text-violet-300"><span className="block">{formatRps(targetRps)} RPS</span><span className="block font-mono text-[10px] font-medium text-violet-500">{targetRps.toLocaleString()} requests/sec</span></output></div>
    {tests.length > 0 && <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">{tests.map(t => <div key={t.name} className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-sm last:border-0 dark:border-white/5"><span><b className="block">{t.name}</b>{t.detail && <small className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t.detail}</small>}</span><span className={t.status === 'passed' ? 'text-emerald-600' : t.status === 'failed' ? 'text-rose-600' : t.status === 'running' ? 'animate-pulse text-violet-600' : 'text-slate-400'}>{t.status === 'passed' ? '✓ Passed' : t.status === 'failed' ? '✕ Failed' : t.status === 'running' ? 'Running…' : 'Waiting'}</span></div>)}</div>}
    {result && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/[.03]"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><p><b>{result.handlesTarget ? 'Ready' : 'Bottleneck'}</b><br/><span className="text-xs text-slate-500">target verdict</span></p><p><b>{result.cacheHitRate}%</b><br/><span className="text-xs text-slate-500">cache hit rate</span></p><p><b>{Number(result.estimatedDbReadsPerSecond).toLocaleString()}</b><br/><span className="text-xs text-slate-500">DB reads/sec</span></p><p><b>{Number(result.estimatedCapacityRps).toLocaleString()}</b><br/><span className="text-xs text-slate-500">capacity</span></p></div>{result.tests?.some(test => !test.passed) ? <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">{result.findings.map(x => <li key={x}>{x}</li>)}</ul> : <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">All architecture checks passed at this request rate.</p>}{!result.handlesTarget && <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-3"><div><b className="text-slate-900 dark:text-white">Need a model answer?</b><p className="mt-0.5 text-xs text-slate-500">Compare your design with a scalable reference topology.</p></div><button type="button" onClick={() => setShowReference(value => !value)} className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50 dark:text-violet-200">{showReference ? 'Hide reference' : 'View reference solution'}</button></div>{showReference && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-400/20 dark:bg-violet-400/10"><p className="font-bold text-violet-950 dark:text-violet-100">{blueprint.name} reference flow</p><p className="mt-1 text-xs leading-5 text-violet-900/80 dark:text-violet-100/80">{blueprint.summary}</p><button type="button" onClick={loadReference} className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700">Load recommended design</button></div>}</div>}</div>}
  </section>
}

function HldSimulationIntro({ onDismiss }) {
  return <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-5 shadow-sm dark:border-emerald-800/70 dark:from-emerald-950/50 dark:via-slate-950 dark:to-teal-950/40 sm:p-6">
    <div className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
      <div>
        <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-white">Interactive HLD simulator</span>
        <h2 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">Build it. Connect it. Test the scale.</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Choose a design question to open its canvas. Add architecture blocks, connect the dots, then run traffic tests from 1K to 1B requests per second.</p>
        <p className="mt-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">3 free system-design questions per member · Premium unlocks continued answer practice</p>
      </div>
      <div className="hld-intro-flow flex items-center justify-center gap-2" aria-label="Client connects to service, which connects to database">
        <span className="hld-intro-node">Client</span><span className="hld-intro-line" aria-hidden="true" /><span className="hld-intro-node hld-intro-delay-1">Service</span><span className="hld-intro-line hld-intro-line-delay" aria-hidden="true" /><span className="hld-intro-node">Database</span>
      </div>
    </div>
    <button type="button" onClick={onDismiss} className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-white/10">Got it</button>
  </section>
}

function Session(props) {
  // ?mode=interview (from the mock interview promo) opens straight into interview mode.
  const [interview, setInterview] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'interview')
  return interview
    ? <InterviewSession {...props} onExit={() => setInterview(false)} />
    : <FreeSession {...props} onInterview={() => setInterview(true)} />
}

function FreeSession({ question, quota, onScored, onOutOfAttempts, onBack, onInterview, onSimulationQuota, onUpgradePremium }) {
  const draftKey = `ir_design_draft_${question.id}`
  const [answer, setAnswer] = useState(() => localStorage.getItem(draftKey) || '')
  const [usedVoice, setUsedVoice] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const speech = useSpeech(text => {
    setUsedVoice(true)
    setAnswer(a => (a && !/\s$/.test(a) ? a + ' ' : a) + text + (/[.!?]$/.test(text) ? ' ' : '. '))
  })

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { localStorage.setItem(draftKey, answer) }, [answer, draftKey])   // a refresh doesn't lose the answer

  const elapsed = Math.floor((now - startedAt) / 1000)
  const left = ROUND_SECONDS - elapsed
  const clock = s => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0

  const submit = async () => {
    speech.stop()
    setBusy(true); setError('')
    try {
      const attempt = await submitDesignAttempt(question.id, answer, usedVoice ? 'voice' : 'text', elapsed)
      localStorage.removeItem(draftKey)
      onScored(attempt)
    } catch (e) {
      if (e.status === 402) onOutOfAttempts(e.quota)
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_1fr]">
      <section className={`${card} space-y-4 lg:col-span-2`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:underline dark:text-blue-400">← All questions</button>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{question.title}</h2>
          </div>
          <span className={`rounded-xl px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${left > 300 ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' : left > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}
            title="A real round is about 45 minutes. The timer is a guide; you can submit any time.">
            {left >= 0 ? clock(left) : `+${clock(left)}`}
          </span>
        </div>
        {left < 0 && <p className="text-sm text-rose-600 dark:text-rose-400">Time's up for a real round. Wrap up and submit when ready.</p>}
        <ArchitectureCanvas question={question} onSimulationQuota={onSimulationQuota} onUpgradePremium={onUpgradePremium} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3 dark:border-violet-900/50 dark:from-violet-950/40 dark:to-pink-950/30">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <strong className="text-violet-700 dark:text-violet-300">🗣 Interview mode:</strong> an interviewer asks you out loud, listens, and follows up on what you missed.
          </p>
          <button type="button" onClick={onInterview} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700">Start interview</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {speech.supported ? (
            <button type="button" onClick={speech.listening ? speech.stop : speech.start}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${speech.listening ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900'}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${speech.listening ? 'animate-pulse bg-white' : 'bg-rose-500'}`} />
              {speech.listening ? 'Stop speaking' : '🎙 Speak your answer'}
            </button>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">Voice answers need Chrome, Edge or Safari. You can type your answer here.</span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">Talk it through like a real interview; your words appear below and you can edit them.</span>
        </div>
        {speech.error && <p className="text-sm text-rose-600 dark:text-rose-400">{speech.error}</p>}

        <div>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={18}
            placeholder={'Start with requirements and scale, estimate the load, then the API, data model, high-level design, scaling, failure handling and trade-offs.'}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          {speech.listening && speech.interim && <p className="mt-1 text-sm italic text-slate-500">{speech.interim}…</p>}
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">{words} words · counts as 1 scored question{quota && !quota.unlimited && !quota.premium ? ` · ${quota.freeLeft} free questions left before this` : ''}</span>
          <button type="button" onClick={submit} disabled={busy || words < 5} className={btnPrimary}>{busy ? 'Scoring…' : 'Submit for scoring'}</button>
        </div>
      </section>

      <aside className={`${card} h-fit space-y-2 lg:col-span-2`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cover these stages</h3>
        <ol className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          {question.stages.map((s, i) => <li key={s.key} className="flex gap-2"><span className="text-slate-400">{i + 1}.</span>{s.label}</li>)}
        </ol>
        <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
          Scoring checks how much of a strong design you cover, stage by stage. Explain in full sentences: lists of keywords don't count.
        </p>
      </aside>
    </div>
  )
}

// Interview mode: no AI. The browser speaks each question (speechSynthesis) and listens (speech recognition).
// After every reply the answer so far is checked against the rubric (free probe), and lib/interviewer.js picks the next
// question: a technology the candidate just named, the first thin stage, this design's known challenges, what-ifs.
// Interviewer styles. Friendly gives hints and stops probing once a stage is roughly there; Hard (a bar raiser) keeps
// pushing until each stage is solid, challenges choices, and is judged against a higher hiring bar on the result.
const INTERVIEWERS = {
  soft: {
    label: 'Friendly', icon: '🙂', blurb: 'Warm, gives hints, lighter follow-ups. Good for a first run.',
    threshold: 0.4, perStage: 1, maxFollowUps: 6,
    acks: ['Nice, that makes sense.', 'Great, thanks.', 'Good thinking.', 'Okay, I like that.', 'Lovely, that works.'],
    opening: d => `Take your time, there's no rush, and feel free to ask me anything. To start, how would you approach ${d}?`,
    clarify: "Good question! Keep it simple: make a reasonable assumption, say it out loud, and carry on.",
    end: "Great job, I think you've covered the important parts. Thanks for the lovely discussion. Let me put your feedback together.",
  },
  moderate: {
    label: 'Moderate', icon: '🤝', blurb: 'A typical interviewer: fair follow-ups on whatever you miss.',
    threshold: 0.5, perStage: 2, maxFollowUps: 10,
    acks: ['Okay, that makes sense.', 'Got it, thanks.', 'Right, good.', 'Alright.', 'Mm-hmm, okay.', 'Nice, that works.', 'Sure, fair enough.'],
    opening: d => `Take a moment to think, and then walk me through how you'd approach ${d}. Start wherever you like.`,
    clarify: "Good question. That's your call: state the assumption you'd make out loud, and carry on from there.",
    end: "Great, I think we've covered the design well. Thanks, that's all from my side. Let me put your score together.",
  },
  hard: {
    label: 'Hard', icon: '🔥', blurb: 'Bar raiser: probes every gap, challenges your choices, higher hiring bar.',
    threshold: 0.75, perStage: 3, maxFollowUps: 14,
    acks: ['Okay.', 'Go on.', 'Hmm.', 'Right.', 'Noted.', "Okay, but I'm not fully convinced."],
    opening: d => `Let's get started. Design ${d}. Drive the discussion; I'll interrupt where I need more depth.`,
    clarify: "What would you assume? Pick a number or a constraint, justify it, and move on.",
    end: "Okay, we'll stop here. Thank you. You'll get the feedback now.",
  },
}
const QUIET_MS = 4000   // auto-send the reply after this long without speech
const pick = list => list[Math.floor(Math.random() * list.length)]

// Spotting when the candidate asks the interviewer something ("what's the DAU?", "can you just tell me the daily active
// users", "I wanted to know the QPS", "this should be given by your side") instead of answering. Speech-to-text has no
// question marks and spells things out, so this matches phrasing, checked sentence by sentence.
const SCALE_WORDS = 'dau|mau|daily active|monthly active|active users?|users?|traffic|qps|rps|tps|requests?|load|scale|storage|read|write|ratio|numbers?|throughput|latency|sla|data size|volume'
const ASKING = new RegExp([
  '\\?\\s*$',                                                                                        // typed question mark
  '\\b(want(ed)?|wanna|would like|\'d like|need(ed)?|wish) to (know|ask|understand|clarify|check|confirm)\\b',  // "I wanted to know…"
  '\\b(can|could|would|will) you (just |please |kindly |also )*(tell|give|share|say|let me know|confirm|provide|clarify)\\b',
  '\\b(tell|give|share) me\\b|\\blet me know\\b|\\b(given|provided|decided|told|shared) (by|from) (you|your (side|end))\\b|\\b(from|by) your (side|end)\\b',
  '\\b(my|a|one|quick) question\\b|\\bany (assumptions?|numbers|constraints|estimates?)\\b|\\bcan i assume\\b|\\bshould i assume\\b',
].join('|'), 'i')
// "what will be the daily active user": a wh-word near a scale word, unless it reads as the candidate's own statement
// ("what we need is…", "how much traffic we get decides…") or already carries their numbers.
const WH_SCALE = new RegExp(`\\b(what|how (many|much|big))\\b(?! (i|we|they|it|you) )(?!'s)?.{0,50}\\b(${SCALE_WORDS})\\b`, 'i')
// Starts like a question, but "what I would do is…" doesn't.
const STARTS_LIKE_Q = /^(so |okay |ok |and |but |um |uh |well |also |sorry )*(what|how (many|much|big)|can you|could you|would you|do we|does it|is there|are there|are we|should i|shall i|will we|is it)\b(?! (i|we|they|you|it)\b)/i
// The candidate stating their own design or numbers; "do we have…?" (inverted) is still a question.
const OWN_STATEMENT = /(?<!\b(do|does|did|should|can|could|will|would|shall) )\b(i|we)('d| would| will|'ll| can| should| need| get| have| expect)\b|\d/i
const SCALE_TOPIC = new RegExp(`\\b(${SCALE_WORDS}|daily|monthly|estimat\\w*|size)\\b`, 'i')
// Mentioning DAU / MAU / active users without giving a figure means asking for it: candidates stating their own
// numbers always say one ("200 million daily active users").
const USERS_TERM = /\b(dau|mau|d a u|m a u|daily active|monthly active|active users?)\b/i
const HAS_FIGURE = /\d|\b(hundred|thousand|lakh|lakhs|crore|million|billion|trillion|[mbk])\b/i
// "you have been given to me", "I need that what is the…": asking the interviewer to provide something.
const NEEDS_FROM_YOU = /\byou (have |had )?(been )?give(n)? (to )?me\b|\bi (need|want) (that|the|to have)\b/i
const isAsking = sentence => sentence.split(/\s+/).length <= 60 && (
  ASKING.test(sentence)
  || (USERS_TERM.test(sentence) && !HAS_FIGURE.test(sentence))
  || (NEEDS_FROM_YOU.test(sentence) && SCALE_TOPIC.test(sentence) && !HAS_FIGURE.test(sentence))
  || ((STARTS_LIKE_Q.test(sentence) || WH_SCALE.test(sentence)) && !OWN_STATEMENT.test(sentence)))
// Splits a reply into the part that answers (scored) and the questions put to the interviewer (answered, not scored).
const splitReply = text => {
  const sentences = text.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean)
  return {
    questions: sentences.filter(isAsking).join(' '),
    answer: sentences.filter(x => !isAsking(x)).join(' '),
  }
}
// The interviewer gives only the inputs the candidate asked for (DAU, MAU, registered users, read:write), like a real
// interviewer; QPS and storage are the candidate's job, so those get a nudge to derive them from the DAU.
const asNumber = n => n >= 1e9 ? `${+(n / 1e9).toFixed(1)} billion` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)} million` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)} thousand` : String(n)
function scaleAnswer(text, scale) {
  const { dau, mau, users, readWrite } = scale
  const wantsDau = /\b(dau|d a u|daily|how many (people|users))\b/i.test(text)
  const wantsMau = /\b(mau|m a u|monthly)\b/i.test(text)
  const wantsTotal = /\b(registered|total (number of )?users|overall users|user base)\b/i.test(text)
  const wantsRatio = /\bread.{0,15}write|write.{0,15}read|\bratio\b/i.test(text)
  const wantsDerived = /\b(qps|rps|tps|requests? per (second|sec)|traffic|throughput|storage|bandwidth|data size|how much data|peak)\b/i.test(text)
  const parts = []
  if (wantsDau && wantsMau) parts.push(`About ${asNumber(mau)} monthly active users, and around ${asNumber(dau)} of them use it on a given day.`)
  else if (wantsMau) parts.push(`About ${asNumber(mau)} monthly active users.`)
  else if (wantsDau) parts.push(`Let's say about ${asNumber(dau)} daily active users.`)
  if (wantsTotal) parts.push(`There are about ${asNumber(users)} registered users in total.`)
  if (wantsRatio) parts.push(`Reads outnumber writes roughly ${(readWrite || '10:1').replace(':1', ' to 1')}.`)
  if (wantsDerived) {
    parts.push(parts.length
      ? 'The QPS and storage are yours to work out from that.'
      : `That's what I'd like you to estimate. Start from about ${asNumber(dau)} daily active users, and make your own assumptions about how often each one reads and writes.`)
  }
  if (!parts.length) parts.push(`Let's say about ${asNumber(dau)} daily active users.`)   // "give me the numbers", "from your side"
  if (!wantsDerived) parts.push('Take it from there.')
  return `${pick(['Sure.', 'Good question.', 'Okay.'])} ${parts.join(' ')}`
}

// Browser voices range from robotic to near-human. Rank them so the interviewer gets the most natural one available:
// Edge's "Natural" (neural) voices, Apple's Premium/Enhanced voices, then Google's; novelty voices never.
const NOVELTY_VOICES = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i
const LIKED_VOICES = /ava|samantha|daniel|karen|moira|rishi|aria|jenny|guy|neerja|prabhat|libby|sonia|ryan|serena|tom|allison|zoe|evan|nathan|noelle/i
function voiceScore(v) {
  if (!/^en[-_]/i.test(v.lang) || NOVELTY_VOICES.test(v.name)) return -1
  let s = 0
  if (/natural|neural/i.test(v.name)) s += 60
  if (/premium/i.test(v.name)) s += 50
  if (/enhanced/i.test(v.name)) s += 40
  if (/online/i.test(v.name)) s += 10
  if (/google/i.test(v.name)) s += 25
  if (LIKED_VOICES.test(v.name)) s += 10
  if (/^en[-_](IN|GB|US)/i.test(v.lang)) s += 3
  if (!v.localService) s += 5
  return s
}
const voiceLabel = v => `${v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+-\s+English.*$/i, '').trim()} · ${v.lang.replace('_', '-')}${/natural|neural|premium|enhanced/i.test(v.name) ? ' ★' : ''}`

// Speaks text sentence by sentence, with a short "thinking" beat first, like a person rather than one long robotic run.
// (Per-sentence utterances also dodge Chrome cutting long utterances off after ~15 seconds.) Resolves when finished or skipped.
function useVoice() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState([])
  const [voiceURI, setVoiceURI] = useState(() => localStorage.getItem('ir_interviewer_voice') || '')
  const run = useRef(0)            // bumped on skip, so a pending say() resolves instead of carrying on
  const live = useRef([])          // Chrome drops onend for utterances that get garbage-collected; keep references

  useEffect(() => {
    if (!supported) return
    // Chrome fills the list asynchronously; it is empty on first call.
    const load = () => setVoices(window.speechSynthesis.getVoices().filter(v => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a)))
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', load); window.speechSynthesis.cancel() }
  }, [supported])
  const voice = voices.find(v => v.voiceURI === voiceURI) || voices[0] || null
  const chooseVoice = uri => { setVoiceURI(uri); localStorage.setItem('ir_interviewer_voice', uri) }

  const say = useCallback(async (text, { beat = 450 } = {}) => {
    if (!supported || muted) return
    const id = ++run.current
    window.speechSynthesis.cancel()
    setSpeaking(true)
    await new Promise(r => setTimeout(r, beat))
    const sentences = text.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean)
    for (const [i, sentence] of sentences.entries()) {
      if (run.current !== id) break
      await new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(sentence)
        if (voice) { u.voice = voice; u.lang = voice.lang }
        // Small natural variation: questions lift a touch at the end, statements settle; pace just under default.
        u.rate = 0.96 + Math.random() * 0.04
        u.pitch = sentence.endsWith('?') ? 1.05 : 0.98 + Math.random() * 0.04
        const end = () => { live.current = live.current.filter(x => x !== u); resolve() }
        u.onend = end
        u.onerror = end
        live.current.push(u)
        window.speechSynthesis.speak(u)
      })
      // A breath between sentences, a little longer after a question or a list.
      if (run.current === id && i < sentences.length - 1) await new Promise(r => setTimeout(r, /[?:]$/.test(sentence) ? 260 : 140))
    }
    if (run.current === id) setSpeaking(false)
  }, [supported, muted, voice])

  const hush = useCallback(() => { run.current++; if (supported) window.speechSynthesis.cancel(); setSpeaking(false) }, [supported])
  return { supported, muted, setMuted, speaking, say, hush, voices, voice, chooseVoice }
}

function InterviewSession({ question, quota, onScored, onOutOfAttempts, onBack, onExit }) {
  const [turns, setTurns] = useState([])          // { who: 'interviewer' | 'you', text }
  const [reply, setReply] = useState('')
  const [phase, setPhase] = useState('ready')     // ready | asking | answering | thinking | wrapping
  const [error, setError] = useState('')
  const [startedAt, setStartedAt] = useState(null)
  const plan = useRef(newInterviewState())       // what has been asked, pushback in flight, what they said earlier
  const [style, setStyle] = useState(() => (INTERVIEWERS[localStorage.getItem('ir_interviewer_style')] ? localStorage.getItem('ir_interviewer_style') : 'moderate'))
  const chooseStyle = k => { setStyle(k); localStorage.setItem('ir_interviewer_style', k) }
  const persona = INTERVIEWERS[style]
  const voice = useVoice()
  const speech = useSpeech(text => setReply(r => (r && !/\s$/.test(r) ? r + ' ' : r) + text + (/[.!?]$/.test(text) ? ' ' : '. ')))
  const bottom = useRef(null)
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [turns, phase])

  const myAnswer = list => list.filter(t => t.who === 'you').map(t => (t.asking ? t.scored : t.text)).filter(Boolean).join('\n\n')
  const lastStage = useRef(null)   // the stage the interviewer last asked about

  // Interviewer speaks, then the mic opens for the reply.
  // `beat` is a thinking pause before speaking, longer after a longer answer.
  const ask = async (text, beat) => {
    speech.stop()
    setTurns(t => [...t, { who: 'interviewer', text }])
    setPhase('asking')
    await voice.say(text, beat ? { beat } : undefined)
    setPhase('answering')
    if (speech.supported) speech.start()
  }

  const begin = () => {
    setStartedAt(Date.now())
    const name = getUser()?.name?.split(' ')[0]
    const design = question.title.replace(/^design\s+/i, '').replace(/[.?]$/, '')
    ask(`Hi${name ? ` ${name}` : ''}, thanks for joining. ${persona.opening(design)}`)
  }

  const finish = async (list, closing) => {
    speech.stop()
    setPhase('wrapping')
    if (closing) { setTurns(t => [...t, { who: 'interviewer', text: closing }]); await voice.say(closing) }
    const answer = myAnswer(list)
    if (answer.trim().split(/\s+/).length < 5) { setError('Say a little more before ending, so there is something to score.'); setPhase('answering'); return }
    try {
      onScored(await submitDesignAttempt(question.id, answer, 'interview', Math.round((Date.now() - (startedAt || Date.now())) / 1000), style, plan.current.signals))
    } catch (e) {
      if (e.status === 402) onOutOfAttempts(e.quota)
      setError(e.message)
      setPhase('answering')
    }
  }

  // The candidate asked something: answer it like an interviewer would, then wait for their answer to the same question.
  const answerQuestion = text => {
    const aboutScale = SCALE_TOPIC.test(text) || lastStage.current === 'estimation'
    if (aboutScale) return ask(scaleAnswer(text, question.scale || { dau: 10_000_000, mau: 20_000_000, users: 100_000_000 }))
    // "Should I support video?": answer from this design's real scope when its bank has one.
    return ask(question.bank?.scope ? `${pick(['Good question.', 'Sure.', 'Fair question.'])} ${question.bank.scope}` : persona.clarify)
  }

  const done = async () => {
    const text = reply.trim()
    if (!text) return
    speech.stop()
    const { questions, answer } = splitReply(text)
    const asking = Boolean(questions)
    const list = [...turns, { who: 'you', text, asking, scored: asking ? answer : undefined }]
    setTurns(list)
    setReply('')
    setError('')
    if (asking) return answerQuestion(questions)
    setPhase('thinking')
    try {
      const { stages } = await probeDesignAnswer(question.id, myAnswer(list))
      // Time left decides how long the interviewer keeps going: the whole 45 or 60 minutes, with a wrap-up at the end.
      const timeLeftSec = startedAt ? minutes * 60 - Math.floor((Date.now() - startedAt) / 1000) : Infinity
      const next = respond({ style, persona, stages, system: systemName(question.title), reply: answer || text, challenges: question.challenges || [], bank: question.bank, followUps: question.followUps || [], state: plan.current, acks: persona.acks, timeLeftSec })
      if (next.end) return finish(list, `${next.text ? `${next.text} ` : ''}${persona.end}`)
      if (next.stageKey) lastStage.current = next.stageKey
      ask(next.text, next.beat)
    } catch (e) {
      setError(e.message)
      setPhase('answering')
    }
  }

  // Auto-send: while listening, once the candidate has said something and then stays quiet for QUIET_MS, send the reply.
  // Any new speech (interim or final) restarts the wait.
  const [autoSend, setAutoSend] = useState(() => localStorage.getItem('ir_interview_autosend') !== 'off')
  useEffect(() => { localStorage.setItem('ir_interview_autosend', autoSend ? 'on' : 'off') }, [autoSend])
  const doneRef = useRef(done)
  doneRef.current = done
  const quiet = autoSend && phase === 'answering' && speech.listening && reply.trim() !== '' && !speech.interim
  // The Hard interviewer cuts a very long answer short, like a real bar raiser keeping time.
  const rambling = style === 'hard' && phase === 'answering' && speech.listening && reply.trim().split(/\s+/).length > 250
  useEffect(() => { if (rambling) doneRef.current() }, [rambling])
  useEffect(() => {
    if (!quiet) return
    const t = setTimeout(() => doneRef.current(), QUIET_MS)
    return () => clearTimeout(t)
  }, [quiet, reply])

  // Round length: 45 or 60 minutes, counting down from "Start the interview". At zero the interviewer calls time
  // and the interview is scored with whatever has been said, like a real round.
  const [minutes, setMinutes] = useState(() => (localStorage.getItem('ir_interview_minutes') === '60' ? 60 : 45))
  const chooseMinutes = m => { setMinutes(m); localStorage.setItem('ir_interview_minutes', String(m)) }
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0
  const left = minutes * 60 - elapsed
  const clock = sec => `${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, '0')}`
  const latest = useRef({})
  latest.current = { turns, reply, phase }
  const timeUp = useRef(false)
  useEffect(() => {
    if (!startedAt || left > 0 || timeUp.current) return
    const { turns: t, reply: r, phase: p } = latest.current
    if (p === 'wrapping' || p === 'ready') return
    timeUp.current = true
    voice.hush()
    finish([...t, ...(r.trim() ? [{ who: 'you', text: r.trim() }] : [])], "We're at time, so let's stop here. Thanks, that was a good discussion. Let me put your feedback together.")
  }, [left, startedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_1fr]">
      <section className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:underline dark:text-blue-400">← All questions</button>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{question.title}</h2>
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">🗣 Interview mode{phase !== 'ready' ? ` · ${persona.icon} ${persona.label} interviewer` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {startedAt && (
              <span role="timer" aria-label={`${clock(left)} ${left >= 0 ? 'left' : 'over time'}`}
                title={`${minutes}-minute round`}
                className={`rounded-xl px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${left > 300 ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' : left > 0 ? 'animate-pulse bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                ⏱ {left >= 0 ? clock(left) : `+${clock(left)}`}
              </span>
            )}
            {voice.supported && !voice.muted && voice.voices.length > 0 && (
              <select value={voice.voice?.voiceURI || ''} aria-label="Interviewer voice" title="Interviewer voice (★ = most natural)"
                onChange={e => { voice.chooseVoice(e.target.value); setTimeout(() => voice.say("Hi, I'll be your interviewer today. Shall we begin?", { beat: 0 }), 0) }}
                className="max-w-[13rem] rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {voice.voices.slice(0, 12).map(v => <option key={v.voiceURI} value={v.voiceURI}>{voiceLabel(v)}</option>)}
              </select>
            )}
            {voice.supported && (
              <button type="button" onClick={() => { voice.hush(); voice.setMuted(m => !m) }} title={voice.muted ? 'Interviewer voice off: read the questions instead' : 'Mute the interviewer voice'}
                className={btnSecondary + ' !px-3 !py-1.5'}>{voice.muted ? '🔇 Voice off' : '🔊 Voice on'}</button>
            )}
            <button type="button" onClick={() => { voice.hush(); speech.stop(); onExit() }} disabled={phase !== 'ready'} title={phase !== 'ready' ? 'Finish or end the interview first' : ''} className={btnSecondary + ' !px-3 !py-1.5'}>Free answer instead</button>
          </div>
        </div>

        {phase === 'ready' ? (
          <div className="rounded-2xl border border-dashed border-violet-300 p-6 text-center dark:border-violet-800">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-3xl text-white shadow-lg">🧑‍💼</div>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">The interviewer reads the question aloud, listens to your answer, then asks follow-ups about anything you haven't covered, like a real round.</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {speech.supported ? 'Allow the microphone when asked. Use headphones so the mic doesn\'t pick up the interviewer.' : 'Your browser can\'t listen; type your replies instead (Chrome, Edge or Safari support voice).'}
              {' '}Scoring uses 1 attempt at the end.
            </p>
            <div className="mt-4 flex flex-col items-center gap-3">
              <div role="radiogroup" aria-label="Interviewer style" className="grid w-full max-w-xl gap-2 sm:grid-cols-3">
                {Object.entries(INTERVIEWERS).map(([k, v]) => (
                  <button key={k} type="button" role="radio" aria-checked={style === k} onClick={() => chooseStyle(k)}
                    className={`rounded-xl border p-3 text-left transition ${style === k
                      ? k === 'hard' ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/40 dark:bg-rose-950/40' : k === 'soft' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/40 dark:bg-emerald-950/40' : 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/40 dark:bg-violet-950/40'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}`}>
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{v.icon} {v.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{v.blurb}</span>
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label="Interview length" className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {[45, 60].map(m => (
                  <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => chooseMinutes(m)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${minutes === m ? 'bg-white text-violet-700 shadow dark:bg-slate-950 dark:text-violet-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                    ⏱ {m} min
                  </button>
                ))}
              </div>
              <button type="button" onClick={begin} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700">Start the {minutes}-minute interview</button>
              <p className="text-xs text-slate-500 dark:text-slate-400">The clock counts down from {minutes}:00. At zero the interviewer calls time and scores what you've covered.{style === 'hard' ? ' The Hard interviewer judges you against a higher hiring bar.' : style === 'soft' ? ' The Friendly interviewer uses a gentler hiring bar.' : ''}</p>
            </div>
          </div>
        ) : (
          <>
            <ol className="max-h-[28rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">
              {turns.map((t, i) => (
                <li key={i} className={`flex ${t.who === 'you' ? 'justify-end' : 'justify-start'}`}>
                  <div title={t.asking ? 'Questions you ask the interviewer are answered, not scored' : undefined} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${t.who === 'you' && t.asking ? 'rounded-br-sm bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100' : t.who === 'you'
                    ? 'rounded-br-sm bg-blue-600 text-white'
                    : 'rounded-bl-sm bg-violet-50 text-slate-800 dark:bg-violet-950/50 dark:text-slate-100'}`}>
                    {t.asking && <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide opacity-70">{t.scored ? 'Your answer + a question' : 'Your question'}</span>}
                    {t.who === 'interviewer' && <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">Interviewer</span>}
                    {t.text}
                  </div>
                </li>
              ))}
              {phase === 'thinking' && <li className="text-sm italic text-slate-500">Interviewer is thinking…</li>}
              <li ref={bottom} />
            </ol>

            {phase !== 'wrapping' && left > 0 && left <= 300 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">⏳ About {Math.ceil(left / 60)} minute{left > 60 ? 's' : ''} left. Start wrapping up: summarise your design and its trade-offs.</p>
            )}
            {phase !== 'wrapping' && (
              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {phase === 'asking' && <span className="font-semibold text-violet-600 dark:text-violet-300">🔊 Interviewer speaking… <button type="button" onClick={voice.hush} className="ml-1 underline">skip</button></span>}
                  {phase === 'answering' && speech.supported && (
                    <button type="button" onClick={speech.listening ? speech.stop : speech.start}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold ${speech.listening ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}>
                      <span className={`h-2 w-2 rounded-full ${speech.listening ? 'animate-pulse bg-white' : 'bg-rose-500'}`} />
                      {speech.listening ? 'Listening… (tap to pause)' : '🎙 Speak'}
                    </button>
                  )}
                  {speech.supported && (
                    <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} /> Send automatically when I pause
                    </label>
                  )}
                  <span className="text-slate-500 dark:text-slate-400">{autoSend && speech.supported ? 'Or edit / type and press Done.' : 'Your reply appears below; edit it or type before pressing Done.'}</span>
                </div>
                {quiet && (
                  <div className="space-y-1" aria-live="polite">
                    <p className="text-xs text-violet-600 dark:text-violet-300">Sending your reply… keep talking to continue.</p>
                    <div className="h-1 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950">
                      <div key={reply} className="quiet-drain h-full rounded-full bg-violet-500" style={{ '--quiet-ms': `${QUIET_MS}ms` }} />
                    </div>
                  </div>
                )}
                {speech.error && <p className="text-sm text-rose-600 dark:text-rose-400">{speech.error}</p>}
                <textarea value={reply} onChange={e => setReply(e.target.value)} rows={4} disabled={phase !== 'answering'}
                  placeholder={phase === 'answering' ? 'Speak or type your reply…' : ''}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                {speech.listening && speech.interim && <p className="text-sm italic text-slate-500">{speech.interim}…</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => finish([...turns, ...(reply.trim() ? [{ who: 'you', text: reply.trim() }] : [])], "Okay, let's stop here. Thanks for your time.")}
                    disabled={phase !== 'answering'} className={btnSecondary}>End interview & score</button>
                  <button type="button" onClick={done} disabled={phase !== 'answering' || !reply.trim()} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50">Done answering</button>
                </div>
              </div>
            )}
            {phase === 'wrapping' && !error && <p className="text-sm text-slate-500">Scoring your interview…</p>}
          </>
        )}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      <aside className={`${card} h-fit space-y-2`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">How it works</h3>
        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          <li>• Answer each question out loud. When you pause for {QUIET_MS / 1000} seconds your reply is sent (or press <strong>Done answering</strong>).</li>
          <li>• Ask for numbers ("what's the DAU?") or clarifications any time, like in a real round.</li>
          <li>• The interviewer follows up on stages you haven't covered yet.</li>
          <li>• It ends when you've covered the design, or press <strong>End interview & score</strong>.</li>
        </ul>
        <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
          {startedAt ? `${minutes}-minute round · ` : ''}{quota && !quota.unlimited && !quota.premium ? `Uses 1 of your 3 free questions (${quota.freeLeft} left before this).` : 'Your answer will be scored when you finish.'}
        </p>
      </aside>
    </div>
  )
}

// Hiring decision, like the debrief a real interviewer writes. Score bands, then two guards real panels apply:
// Strong Hire needs no weak stage, and missing the core high-level design caps the decision at No Hire.
const VERDICTS = [
  { key: 'reject', label: 'Rejected', min: 0, tone: 'bg-rose-600 text-white', soft: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    summary: "Not ready for this round yet. The answer didn't cover enough of a working design for an interviewer to judge it." },
  { key: 'nohire', label: 'No Hire', min: 4, tone: 'bg-orange-500 text-white', soft: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    summary: 'Some good parts, but too many gaps for this level. An interviewer would not be confident you could own this design.' },
  { key: 'weak', label: 'Weak Hire', min: 5.5, tone: 'bg-amber-500 text-white', soft: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    summary: 'A workable design with gaps. Some panels would pass this, others would want more depth before saying yes.' },
  { key: 'hire', label: 'Hire', min: 7, tone: 'bg-emerald-500 text-white', soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    summary: 'A solid, well-structured design that covers most of what this round looks for.' },
  { key: 'strong', label: 'Strong Hire', min: 8.5, tone: 'bg-emerald-700 text-white', soft: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    summary: 'Excellent. Complete, well-reasoned and balanced across every stage: the kind of answer that stands out in a debrief.' },
]
// Where each verdict starts (No Hire, Weak Hire, Hire, Strong Hire) at each interviewer's bar.
const HIRING_BARS = {
  soft: { label: 'Friendly', mins: [0, 3, 4.5, 6, 7.5], strongNeeds: 0.5 },
  moderate: { label: 'Moderate', mins: [0, 4, 5.5, 7, 8.5], strongNeeds: 0.5 },
  hard: { label: 'Hard', mins: [0, 5, 6.5, 8, 9], strongNeeds: 0.75, hireNeeds: 0.4 },
}
function hiringDecision(score, stages, difficulty = 'moderate', signals = []) {
  const bar = HIRING_BARS[difficulty] || HIRING_BARS.moderate
  const verdicts = VERDICTS.map((v, k) => ({ ...v, min: bar.mins[k] }))
  let i = verdicts.findLastIndex(v => score >= v.min)
  const notes = []
  const weak = stages.filter(s => s.score < bar.strongNeeds)
  if (verdicts[i].key === 'strong' && weak.length) { i--; notes.push(`Held back from Strong Hire by ${bar.strongNeeds >= 0.75 ? 'a stage that isn\'t solid' : 'a weak stage'}: ${weak.map(s => s.label.toLowerCase()).join(', ')}.`) }
  const shaky = bar.hireNeeds ? stages.filter(s => s.score < bar.hireNeeds) : []
  if (verdicts[i].key === 'hire' && shaky.length) { i--; notes.push(`The Hard bar doesn't pass a Hire with a weak stage: ${shaky.map(s => s.label.toLowerCase()).join(', ')}.`) }
  const core = stages.find(s => s.key === 'highlevel')
  if (core && core.score < 0.3 && i > 1) { i = 1; notes.push('Capped at No Hire: the core high-level design was missing, and no panel passes a design round without it.') }
  // How they held up when the interviewer pushed back: giving in or guessing costs a level at the Hard bar (three times
  // at Moderate); defending well twice lifts a borderline answer.
  const shaken = signals.filter(s => s.outcome === 'caved' || s.outcome === 'unsure')
  const solid = signals.filter(s => s.outcome === 'strong')
  const shakeLimit = difficulty === 'hard' ? 2 : difficulty === 'moderate' ? 3 : 99
  if (shaken.length >= shakeLimit && i > 0) { i--; notes.push(`Marked down a level: gave way under pushback on ${shaken.map(s => s.topic).join(', ')}.`) }
  else if (difficulty !== 'soft' && solid.length >= 2 && !shaken.length && verdicts[i + 1] && score >= verdicts[i + 1].min - 0.5) {
    i++; notes.push(`Nudged up a level: defended ${solid.map(s => s.topic).join(' and ')} convincingly under pushback.`)
  }
  return { verdict: verdicts[i], next: verdicts[i + 1], verdicts, bar, notes }
}
const stageSignal = s => s >= 0.75 ? { label: 'Strong signal', cls: 'text-emerald-600 dark:text-emerald-400' } : s >= 0.4 ? { label: 'Mixed signal', cls: 'text-amber-600 dark:text-amber-400' } : { label: 'Weak signal', cls: 'text-rose-600 dark:text-rose-400' }

function HiringDecision({ attempt }) {
  const stages = attempt.result?.stages || []
  const score = Number(attempt.score) || 0
  const difficulty = attempt.difficulty || 'moderate'
  const signals = Array.isArray(attempt.signals) ? attempt.signals : []
  const { verdict, next, verdicts, bar, notes } = hiringDecision(score, stages, difficulty, signals)
  // The same answer at the other bars, so the candidate sees how much the interviewer changes the outcome.
  const elsewhere = Object.keys(HIRING_BARS).filter(k => k !== difficulty).map(k => ({ k, label: HIRING_BARS[k].label, verdict: hiringDecision(score, stages, k, signals).verdict }))
  const strengths = stages.filter(s => s.score >= 0.75)
  const concerns = [...stages].filter(s => s.score < 0.5).sort((a, b) => b.weight - a.weight)
  const focus = [...stages].sort((a, b) => (a.score - b.score) || (b.weight - a.weight)).slice(0, 2)
  return (
    <section className={`${card} premium-reveal`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Interviewer's decision · {INTERVIEWERS[difficulty]?.icon} {bar.label} bar
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className={`rounded-xl px-4 py-1.5 text-2xl font-extrabold shadow-sm ${verdict.tone}`}>{verdict.label}</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">Rating <strong className="text-lg tabular-nums text-slate-900 dark:text-white">{score.toFixed(1)}</strong> / 10</span>
          </p>
        </div>
      </div>

      {/* Every outcome on one scale, so it's clear where this answer landed and what the next level needs. */}
      <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Hiring scale">
        {verdicts.map((v, i) => {
          const on = v.key === verdict.key
          return (
            <li key={v.key} aria-current={on ? 'true' : undefined}
              className={`rounded-lg px-1.5 py-2 text-center transition ${on ? `${v.tone} scale-105 shadow-md ring-2 ring-slate-900/70 ring-offset-2 ring-offset-white dark:ring-white/80 dark:ring-offset-slate-950` : `${v.soft} opacity-60`}`}>
              <span className="block text-[11px] font-bold leading-tight sm:text-sm">{v.label}</span>
              <span className="block text-[10px] tabular-nums opacity-80 sm:text-xs">{v.min.toFixed(1)}{verdicts[i + 1] ? `–${(verdicts[i + 1].min - 0.1).toFixed(1)}` : '–10'}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-5 space-y-4 text-sm text-slate-700 dark:text-slate-300">
        <p>{verdict.summary}</p>
        {notes.map(n => <p key={n} className="rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-900">{n}</p>)}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Same answer with a different interviewer: {elsewhere.map((e, i) => <span key={e.k}>{i ? ' · ' : ''}{INTERVIEWERS[e.k].icon} {e.label}: <strong className="text-slate-700 dark:text-slate-200">{e.verdict.label}</strong></span>)}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-1.5 font-semibold text-emerald-700 dark:text-emerald-400">What went well</h4>
            {strengths.length ? (
              <ul className="space-y-1">
                {strengths.map(s => <li key={s.key} className="flex gap-2"><span className="text-emerald-500">✓</span><span><strong>{s.label}:</strong> {s.covered.slice(0, 3).join(', ').toLowerCase() || 'well covered'}.</span></li>)}
              </ul>
            ) : <p className="text-slate-500">No stage was strong enough yet to stand out.</p>}
          </div>
          <div>
            <h4 className="mb-1.5 font-semibold text-rose-700 dark:text-rose-400">Concerns</h4>
            {concerns.length ? (
              <ul className="space-y-1">
                {concerns.map(s => <li key={s.key} className="flex gap-2"><span className="text-rose-500">✗</span><span><strong>{s.label}:</strong> {s.missed.length ? `didn't cover ${s.missed.slice(0, 3).join(', ').toLowerCase()}` : 'too thin'}.</span></li>)}
              </ul>
            ) : <p className="text-slate-500">No major gaps.</p>}
          </div>
        </div>
        {signals.length > 0 && (
          <div>
            <h4 className="mb-1.5 font-semibold text-slate-900 dark:text-slate-100">Under pressure</h4>
            <ul className="space-y-1">
              {signals.map((s, k) => {
                const line = {
                  strong: ['💪', 'text-emerald-600 dark:text-emerald-400', `Defended ${s.topic} with solid reasoning${s.terms?.length ? ` (${s.terms.join(', ')})` : ''}.`],
                  ok: ['👍', 'text-slate-600 dark:text-slate-300', `Gave a reasonable defence of ${s.topic}, though it could be sharper.`],
                  caved: ['⚠️', 'text-rose-600 dark:text-rose-400', `Gave in on ${s.topic} without a reason. Interviewers push back to see if you can defend a choice: explain the trade-off instead.`],
                  unsure: ['❓', 'text-amber-600 dark:text-amber-400', `Wasn't sure how to defend ${s.topic}. Worth reading up on before a real round.`],
                }[s.outcome] || ['•', '', s.topic]
                return <li key={k} className={`flex gap-2 ${line[1]}`}><span aria-hidden="true">{line[0]}</span><span>{line[2]}</span></li>
              })}
            </ul>
          </div>
        )}
        {next && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
            <strong>To move up to {next.label}</strong> ({next.min.toFixed(1)}+): spend more time on {focus.map(s => s.label.toLowerCase()).join(' and ')}
            {focus[0]?.missed?.length ? `, e.g. ${focus[0].missed.slice(0, 2).join(' and ').toLowerCase()}` : ''}.
          </p>
        )}
      </div>
    </section>
  )
}

function ResultView({ attempt, quota, onUpgrade, onRetry, onBack }) {
  const r = attempt.result || {}
  const stages = r.stages || []
  // A free member who just used their last scored question: show what the result is worth before asking for money.
  const spent = !!quota && !quota.premium && !quota.unlimited && quota.canAttempt === false
  const missedAll = stages.flatMap(s => (s.missed || []).map(m => ({ stage: s.label, item: m })))
  useEffect(() => { if (spent) { trackFunnel('free_limit_hit'); trackFunnel('paywall_seen') } }, [spent])
  const [showModel, setShowModel] = useState(false)
  const pct = Math.max(0, Math.min(100, (attempt.score || 0) * 10))
  return (
    <div className="space-y-5">
      <section className={`${card} premium-reveal`}>
        <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:underline dark:text-blue-400">← All questions</button>
        <div className="mt-2 flex flex-wrap items-center gap-6">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3" className="stroke-slate-200 dark:stroke-slate-800" />
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray={`${pct} 100`}
                className={attempt.score >= 7.5 ? 'stroke-emerald-500' : attempt.score >= 5 ? 'stroke-amber-500' : 'stroke-rose-500'} />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">{Number(attempt.score).toFixed(1)}</span>
              <span className="text-xs text-slate-500">out of 10</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{attempt.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(attempt.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.words ?? '—'} words · {MODE_LABEL[attempt.mode] || MODE_LABEL.text}
              {attempt.durationSec ? ` · ${Math.round(attempt.durationSec / 60)} min` : ''}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {(r.feedback || []).map((f, i) => <li key={i} className="flex gap-2"><span className="text-blue-500">•</span>{f}</li>)}
            </ul>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          This is a <strong>coverage score</strong>: it measures how much of a strong design you covered, not whether every statement is correct.
          Compare with the model answer below to judge the details.
        </p>
      </section>

      {spent && (
        <section className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-pink-50 p-5 dark:border-amber-500/30 dark:from-amber-950/30 dark:to-pink-950/20">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-amber-700 dark:text-amber-300">You've used your {quota.freeTotal || 3} free scored questions</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            You scored {Number(attempt.score).toFixed(1)}/10{missedAll.length ? ` and left ${missedAll.length} things out` : ''}. Close the gap before your interview.
          </h3>
          {missedAll.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {missedAll.slice(0, 2).map((m, i) => <li key={i} className="flex gap-2"><span className="text-rose-500">✗</span><span><strong>{m.stage}:</strong> {m.item}</span></li>)}
              {missedAll.length > 2 && <li className="flex gap-2 text-slate-500 dark:text-slate-400"><span aria-hidden="true">🔒</span>{missedAll.length - 2} more gaps to review on your next attempts</li>}
            </ul>
          )}
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Premium gives you unlimited scored attempts, so you can retry this question and watch the score climb.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onUpgrade} className="rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-95">Unlock unlimited attempts</button>
            <span className="text-xs text-slate-500 dark:text-slate-400">One-time payment, no auto-renewal</span>
          </div>
        </section>
      )}

      <HiringDecision attempt={attempt} />

      <section className={card}>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Stage by stage</h3>
        <div className="space-y-4">
          {stages.map(s => (
            <div key={s.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">{s.label}</span>
                <span className="flex items-center gap-2 tabular-nums text-slate-500"><span className={`text-xs font-semibold ${stageSignal(s.score).cls}`}>{stageSignal(s.score).label}</span>{Math.round(s.score * 100)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`bar-grow h-full rounded-full ${s.score >= 0.8 ? 'bg-emerald-500' : s.score >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.round(s.score * 100)}%` }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.covered.map(c => <span key={c} className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">✓ {c}</span>)}
                {s.missed.map(c => <span key={c} className="rounded-md bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">✗ {c}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">Your answer</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{attempt.answer}</p>
        </details>
      </section>

      {attempt.modelAnswer && (
        <section className={card}>
          <button type="button" onClick={() => setShowModel(v => !v)} className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {showModel ? 'Hide the model answer' : 'Show the model answer'}
          </button>
          {showModel && <div className="mt-3 text-sm text-slate-700 dark:text-slate-300"><Markdown text={attempt.modelAnswer} /></div>}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className={btnPrimary}>Try this question again</button>
        <button type="button" onClick={onBack} className={btnSecondary}>Pick another question</button>
        {Number(attempt.score) >= 6 && attempt.questionId && <ShareLinkedIn score={{ questionId: attempt.questionId, title: attempt.title, score: attempt.score }} label="Share my score" />}
      </div>
    </div>
  )
}
