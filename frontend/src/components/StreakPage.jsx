import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import AuthModal from './AuthModal.jsx'
import LeagueBadge from './LeagueBadge.jsx'
import { setPageSeo } from '../lib/seo.js'
import { isLoggedIn } from '../lib/auth.js'
import { fetchPoints, fetchPointHistory } from '../lib/points.js'

const KIND = { login: ['📅', 'Daily sign-in'], read: ['📖', 'Read a new question'], solve: ['💻', 'Solved a problem'], streak: ['🔥', 'Streak bonus'] }
const MILESTONES = [[7, 100], [30, 500], [100, 2000]]   // mirrors PointsService.MILESTONES
const istDay = d => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10)

// Streak and points in one place: the numbers, the last 5 weeks as a calendar, how points are earned, and every recent award.
export default function StreakPage() {
  const [sum, setSum] = useState(null)
  const [hist, setHist] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const authed = isLoggedIn()
  useEffect(() => {
    setPageSeo({ title: 'My streak and points | Interview Reader', description: 'Your daily streak, points and recent activity.', path: '/streak', noindex: true })
    if (!authed) return
    fetchPoints().then(setSum).catch(() => setSum({}))
    fetchPointHistory().then(setHist).catch(() => setHist({ events: [], days: [] }))
  }, [authed])

  if (!authed) return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4"><div className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sign in to see your streak</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your streak, points and every award are saved to your account.</p>
        <button type="button" onClick={() => setAuthOpen(true)} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Sign in or register</button>
      </div></main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
    </div>
  )

  // 35 days ending today, oldest first, padded so each column is a weekday (Mon first).
  const checked = new Set(hist?.days || [])
  const today = new Date()
  const cells = Array.from({ length: 35 }, (_, i) => { const d = new Date(today.getTime() - (34 - i) * 864e5); return { day: istDay(d), dow: (new Date(d.getTime() + 5.5 * 3600e3).getUTCDay() + 6) % 7 } })
  const lead = cells[0].dow
  const stat = 'rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-950'
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My streak & points</h1>
          <a href="/leaderboard" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">Leaderboard →</a>
        </div>

        {!sum ? <p className="text-sm text-slate-500">Loading…</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={stat}><p className="text-3xl font-bold tabular-nums text-orange-500">🔥 {sum.streak ?? 0}</p><p className="text-xs text-slate-500">day streak</p></div>
            <div className={stat}><p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{sum.best ?? 0}</p><p className="text-xs text-slate-500">best streak</p></div>
            <div className={stat}><p className="text-3xl font-bold tabular-nums text-amber-500">⭐ {sum.weekPoints ?? 0}</p><p className="text-xs text-slate-500">points this week</p></div>
            <div className={stat}><p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{sum.totalPoints ?? 0}</p><p className="text-xs text-slate-500">points all time</p></div>
          </div>
        )}
        {sum?.nextMilestone && <p className="text-sm text-slate-600 dark:text-slate-400">{sum.nextMilestone.daysLeft} more day{sum.nextMilestone.daysLeft > 1 ? 's' : ''} to a {sum.nextMilestone.days}-day streak: <b className="text-amber-600 dark:text-amber-400">+{sum.nextMilestone.bonus} points</b></p>}
        {sum?.league && <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">This week's league: <LeagueBadge league={sum.league} size="sm" /></div>}

        <section className={stat}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Last 5 weeks</h2>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-slate-400">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <span key={i}>{x}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`p${i}`} />)}
            {cells.map(c => (
              <span key={c.day} title={`${c.day}${checked.has(c.day) ? ' · checked in' : ''}`}
                className={`flex h-8 items-center justify-center rounded-lg text-xs ${checked.has(c.day) ? 'bg-orange-500 font-bold text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'} ${c.day === istDay(today) ? 'ring-2 ring-blue-500' : ''}`}>
                {checked.has(c.day) ? '🔥' : Number(c.day.slice(8))}
              </span>
            ))}
          </div>
        </section>

        <section className={stat}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">How you earn points</h2>
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {Object.entries(sum?.rules || {}).map(([k, v]) => <li key={k} className="flex justify-between py-2"><span>{KIND[k][0]} {KIND[k][1]}{k === 'login' ? ' (first visit each day keeps the streak)' : k === 'read' ? ' (first time only)' : ' (first accepted solution)'}</span><b className="tabular-nums text-emerald-600 dark:text-emerald-400">+{v}</b></li>)}
            {MILESTONES.map(([days, pts]) => <li key={days} className="flex justify-between py-2"><span>🔥 {days}-day streak{sum?.best >= days ? ' · reached ✓' : ''}</span><b className="tabular-nums text-emerald-600 dark:text-emerald-400">+{pts}</b></li>)}
          </ul>
        </section>

        <section className={stat}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Recent points</h2>
          {!hist ? <p className="text-sm text-slate-500">Loading…</p> : hist.events.length === 0 ? <p className="text-sm text-slate-500">Nothing yet. Read a question or solve a problem to earn your first points.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {hist.events.map((e, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm">
                  <span aria-hidden="true">{KIND[e.kind]?.[0] || '⭐'}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-slate-900 dark:text-slate-100">{e.title || KIND[e.kind]?.[1] || e.kind}</span>
                    <span className="block text-xs text-slate-500">{KIND[e.kind]?.[1]} · {new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></span>
                  <b className="tabular-nums text-emerald-600 dark:text-emerald-400">+{e.points}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
