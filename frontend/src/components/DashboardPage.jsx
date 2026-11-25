import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import AuthModal from './AuthModal.jsx'
import LeagueBadge from './LeagueBadge.jsx'
import ActivityHeatmap from './ActivityHeatmap.jsx'
import { setPageSeo } from '../lib/seo.js'
import { getUser, isLoggedIn, fetchProgress } from '../lib/auth.js'
import { fetchPoints } from '../lib/points.js'
import { fetchQotd } from '../lib/engage.js'
import { fetchSolvedIds } from '../lib/code.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const count = x => (Array.isArray(x) ? x.length : x?.size ?? 0)
export const greeting = (h = new Date().getHours()) => (h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')

// Where to go next: [label, hint, href, icon]
const EXPLORE = [
  ['Interview questions', 'Every topic with worked answers', '/questions', '📚'],
  ['Practice coding', 'Run code against test cases', '/problems', '💻'],
  ['Company roadmaps', 'Round by round, per company', '/roadmaps', '🧭'],
  ['Mock interview', 'Live practice with scoring', '/interview', '🎤'],
  ['System design', 'Build and submit your own design', '/interview/practice', '🏗️'],
  ['Compensation talk', 'Real salary and offer reports', '/discuss', '💰'],
  ['Resume builder', 'ATS-friendly templates to PDF', '/resume', '📄'],
  ['Interview guides', 'Topic and company guides', '/interview-questions', '🗂️'],
]

const tile = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950'

function Stat({ label, value, tone, hint }) {
  return (
    <div className={tile}>
      <p className={`text-3xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

// A signed-in member's home base: today's challenge, streak and points, weekly rank, progress and the activity calendar.
export default function DashboardPage() {
  const authed = isLoggedIn()
  const user = getUser()
  const [authOpen, setAuthOpen] = useState(false)
  const [pts, setPts] = useState(null)
  const [read, setRead] = useState(null)
  const [solved, setSolved] = useState(null)
  const [daily, setDaily] = useState(null)
  const [rank, setRank] = useState(null)

  useEffect(() => {
    setPageSeo({ title: 'Your dashboard | InterviewReader', description: 'Your streak, points, weekly rank, progress and daily challenge.', path: window.location.pathname === '/' ? '/' : '/dashboard', noindex: true })
    if (!authed) return
    fetchPoints().then(setPts).catch(() => setPts({}))
    fetchProgress().then(p => setRead(count(p.read))).catch(() => setRead(0))
    fetchSolvedIds().then(s => setSolved(count(s))).catch(() => setSolved(0))
    fetchQotd().then(d => d?.id && setDaily(d)).catch(() => {})
    fetch(`${API_BASE}/leaderboard`, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).then(d => d?.me && setRank(d.me)).catch(() => {})
  }, [authed])

  if (!authed) return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sign in to see your dashboard</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your streak, points, progress and daily challenge live here.</p>
          <button type="button" onClick={() => setAuthOpen(true)} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Sign in or register</button>
        </div>
      </main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
    </div>
  )

  const first = (user?.name || user?.username || '').split(' ')[0]
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const next = pts?.nextMilestone
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-600 dark:text-emerald-400">{day}</p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">{greeting()}{first ? `, ${first}` : ''}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Your progress, your streak and what to do next, in one place.</p>
          </div>
          {pts?.league && <LeagueBadge league={pts.league} size="sm" />}
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-lg lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-100">Today's challenge</p>
            {daily ? (
              <>
                <h2 className="mt-2 text-xl font-bold leading-snug">{daily.title}</h2>
                {daily.problem && <p className="mt-1 text-sm text-emerald-100">Then solve: {daily.problem.title} · {daily.problem.difficulty}</p>}
              </>
            ) : <h2 className="mt-2 text-xl font-bold">A new question and problem every day</h2>}
            <div className="mt-5 flex flex-wrap gap-2">
              <a href="/question-of-the-day" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Take today's challenge →</a>
              <a href="/questions" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25">Pick a topic</a>
            </div>
          </div>
          <div className={tile}>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">This week</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">{rank?.rank ? `#${rank.rank}` : '–'}<span className="ml-2 text-sm font-medium text-slate-500">weekly rank</span></p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{pts?.weekPoints ?? 0} points this week</p>
            {next && <p className="mt-3 text-xs text-slate-500">{next.daysLeft} more day{next.daysLeft > 1 ? 's' : ''} to a {next.days}-day streak bonus.</p>}
            <a href="/leaderboard" className="mt-3 inline-block text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400">Leaderboard →</a>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="Day streak" value={`🔥 ${pts?.streak ?? 0}`} tone="text-orange-500" />
          <Stat label="Best streak" value={pts?.best ?? 0} tone="text-slate-900 dark:text-white" />
          <Stat label="Points (all time)" value={pts?.totalPoints ?? 0} tone="text-amber-500" />
          <Stat label="Questions read" value={read ?? '–'} tone="text-sky-500" />
          <Stat label="Problems solved" value={solved ?? '–'} tone="text-emerald-500" />
          <Stat label="Weekly points" value={pts?.weekPoints ?? 0} tone="text-violet-500" />
        </section>

        <section className={tile}>
          <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">Your activity</h2>
          <ActivityHeatmap compact />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[.14em] text-slate-500">Keep going</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {EXPLORE.map(([label, hint, href, icon]) => (
              <a key={href} href={href} className={`${tile} group transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md`}>
                <span className="text-2xl" aria-hidden="true">{icon}</span>
                <p className="mt-2 text-sm font-bold text-slate-900 group-hover:text-emerald-600 dark:text-white">{label}</p>
                <p className="text-xs text-slate-500">{hint}</p>
              </a>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
