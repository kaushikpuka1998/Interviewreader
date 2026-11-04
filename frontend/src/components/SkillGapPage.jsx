import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Loader from './Loader.jsx'
import AuthModal from './AuthModal.jsx'
import { setPageSeo } from '../lib/seo.js'
import { isLoggedIn } from '../lib/auth.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-950'
const tone = p => (p < 30 ? 'bg-red-500' : p < 60 ? 'bg-amber-500' : 'bg-emerald-500')
const MOCK_TYPES = { CODING: 'Coding', SYSTEM_DESIGN: 'System design', RESUME: 'Resume' }

// One horizontal bar per row: a track, a coloured fill (width = percent) and a value at the right. Pure CSS, no chart library.
function BarRow({ label, percent, value, color, sub, track = 'bg-slate-100 dark:bg-slate-800', extra }) {
  return (
    <li className="grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate text-slate-700 dark:text-slate-300" title={label}>{label}</span>
      <div className={`relative h-3 overflow-hidden rounded-full ${track}`} role="img" aria-label={`${label}: ${value}`}>
        {extra}
        <div className={`absolute inset-y-0 left-0 rounded-full ${color || tone(percent)}`} style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }} />
      </div>
      <span className="w-24 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{value}{sub ? <span className="ml-1 text-slate-400">{sub}</span> : null}</span>
    </li>
  )
}

// Vertical bars for a short series (the latest design practice scores, 0-10).
function ColumnChart({ items, max, unit }) {
  const H = 120
  return (
    <div className="flex items-end gap-2 pt-2" style={{ height: H + 28 }} role="img" aria-label="Recent scores">
      {items.map((it, i) => {
        const h = Math.max(4, (it.value / max) * H)
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">{it.value}</span>
            <div className={`w-full max-w-[2.25rem] rounded-t-md ${it.value / max < 0.4 ? 'bg-red-500' : it.value / max < 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ height: h }} title={`${it.label}: ${it.value}${unit}`} />
            <span className="text-[10px] text-slate-400">{it.label}</span>
          </div>
        )
      })}
    </div>
  )
}

const Legend = ({ items }) => (
  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
    {items.map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${c}`} />{l}</span>)}
  </div>
)

export default function SkillGapPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const authed = isLoggedIn()

  useEffect(() => {
    setPageSeo({ title: 'My skill gap analysis | Interview Reader', description: 'Your weak topics and what to learn next, from your practice.', path: '/skills', noindex: true })
    if (!authed) return
    fetch(`${API_BASE}/me/skills`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Could not load your analysis. Try again in a moment.'))))
      .then(setData).catch(e => setError(e.message))
  }, [authed])

  if (!authed) return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto max-w-md px-4 py-16"><div className={`${card} text-center`}>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sign in to see your skill gaps</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">We work out your weak topics from the questions you read, the problems you solve and your practice scores.</p>
        <button onClick={() => setAuthOpen(true)} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Log in / Sign up</button>
      </div></main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
    </div>
  )

  const started = data ? data.topics.filter(t => t.read + t.visited > 0) : []
  const coding = data ? data.coding : null
  const patterns = coding ? [...coding.byTopic].filter(p => p.attempted > 0).sort((a, b) => b.attempted - a.attempted).slice(0, 10) : []
  const design = data?.design
  const mock = data?.mock
  const empty = data && started.length === 0 && coding.attempted === 0 && design.attempts === 0

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your skill gap analysis</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Worked out from the questions you read, the problems you solve, your system design practice and your mock interviews.</p>
        </header>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!data && !error && <Loader label="Analysing your practice…" />}

        {data && (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
              {[
                ['Topics started', `${started.length} / ${data.topics.length}`],
                ['Questions read', data.topics.reduce((s, t) => s + t.read, 0).toLocaleString()],
                ['Problems solved', `${coding.solved} of ${coding.attempted} tried`],
                ['Design practice', design.attempts ? `${design.average} / 10` : 'None yet'],
              ].map(([l, v]) => (
                <div key={l} className={card}><p className="text-[11px] uppercase tracking-wide text-slate-400">{l}</p><p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{v}</p></div>
              ))}
            </section>

            {empty && <div className={card}><p className="text-sm text-slate-600 dark:text-slate-300">There is nothing to analyse yet. Read a few questions and solve a problem, then come back: this page fills in as you practise.</p>
              <a href="/" className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Start reading</a></div>}

            <section className={card} aria-labelledby="sg-focus">
              <h2 id="sg-focus" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Where to focus</h2>
              {data.focus.length === 0 ? <p className="mt-2 text-sm text-slate-500">No weak spots found. Keep going, and try a harder pattern or a mock interview.</p> : (
                <ul className="mt-3 space-y-2">
                  {data.focus.map((f, i) => (
                    <li key={i}>
                      <a href={f.url} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-slate-800 dark:hover:bg-slate-900">
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tone(f.percent)}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{f.name}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{f.reason}</span></span>
                        <span className="text-xs font-semibold tabular-nums text-slate-500">{f.percent}%</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={card} aria-labelledby="sg-topics">
              <h2 id="sg-topics" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Questions read by topic</h2>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Share of each topic you have read. Weakest first.</p>
              <ul className="space-y-2.5">
                {data.topics.map(t => <BarRow key={t.tech} label={t.label} percent={t.percent} value={`${t.percent}%`} sub={`${t.read}/${t.total}`} />)}
              </ul>
              <Legend items={[['bg-red-500', 'under 30%'], ['bg-amber-500', '30 to 59%'], ['bg-emerald-500', '60% or more']]} />
            </section>

            {patterns.length > 0 && (
              <section className={card} aria-labelledby="sg-code">
                <h2 id="sg-code" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Coding patterns you practised</h2>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">For each pattern you tried: how many of those problems you solved. Most-practised first.</p>
                <ul className="space-y-2.5">
                  {patterns.map(p => (
                    <BarRow key={p.topic} label={p.topic} percent={(p.solved / p.attempted) * 100} color="bg-emerald-500"
                      value={`${p.solveRate}% solved`} sub={`${p.solved}/${p.attempted}`}
                      track="bg-amber-300 dark:bg-amber-500/40" />
                  ))}
                </ul>
                <Legend items={[['bg-emerald-500', 'solved'], ['bg-amber-300', 'tried, not solved yet']]} />
              </section>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <section className={card} aria-labelledby="sg-design">
                <h2 id="sg-design" className="text-lg font-semibold text-slate-900 dark:text-slate-100">System design practice</h2>
                {design.attempts === 0 ? <p className="mt-2 text-sm text-slate-500">No attempts yet. <a className="text-emerald-700 underline dark:text-emerald-400" href="/interview/practice">Try a solo design round</a>.</p> : (
                  <>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Latest scores out of 10 (average {design.average}).</p>
                    <ColumnChart max={10} unit="/10" items={design.recent.map((r, i) => ({ value: r.score, label: `#${design.attempts - design.recent.length + i + 1}` }))} />
                  </>
                )}
              </section>

              <section className={card} aria-labelledby="sg-mock">
                <h2 id="sg-mock" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Mock interview ratings</h2>
                {mock.byType.length === 0 ? <p className="mt-2 text-sm text-slate-500">No rated mock interviews yet. <a className="text-emerald-700 underline dark:text-emerald-400" href="/interview">Book one</a>.</p> : (
                  <>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Average interviewer rating out of 5.</p>
                    <ul className="space-y-2.5">{mock.byType.map(m => <BarRow key={m.type} label={MOCK_TYPES[m.type] || m.type} percent={(m.average / 5) * 100} value={`${m.average} / 5`} sub={`(${m.count})`} />)}</ul>
                    {mock.improve.length > 0 && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"><p className="mb-1 font-semibold">Interviewers said to improve:</p><ul className="list-disc space-y-0.5 pl-4">{mock.improve.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
                  </>
                )}
              </section>
            </div>

            {data.next.length > 0 && (
              <section className={card} aria-labelledby="sg-next">
                <h2 id="sg-next" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Learn next</h2>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">The next steps in the areas above.</p>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.next.map((n, i) => (
                    <li key={i}>
                      <a href={n.type === 'problem' ? `/practice?id=${n.id}` : `/${n.slug}?id=${encodeURIComponent(n.id)}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-emerald-700 dark:hover:text-emerald-300">
                        <span className="min-w-0"><span className="mr-2" aria-hidden="true">{n.type === 'problem' ? '💻' : '📖'}</span><span className="text-slate-800 dark:text-slate-200">{n.title}</span></span>
                        <span className="shrink-0 text-[11px] text-slate-400">{n.reason}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
