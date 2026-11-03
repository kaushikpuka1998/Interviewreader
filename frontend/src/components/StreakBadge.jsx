import { useEffect, useRef, useState } from 'react'
import { checkInToday } from '../lib/points.js'

// Top-bar streak and points. The first signed-in visit of the day checks in (+25, streak +1) and shows a short toast.
export default function StreakBadge() {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const box = useRef(null)

  useEffect(() => {
    checkInToday().then(({ data, fresh }) => {
      setData(data)
      if (fresh) {
        setToast(`+${data.awarded} points · ${data.milestone ? `🎉 ${data.milestone}!` : `🔥 ${data.streak}-day streak`}`)
        setTimeout(() => setToast(null), 4000)
      }
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (!data) return null
  const lit = data.streak > 0
  const fmt = n => Number(n || 0).toLocaleString('en-IN')
  const days = n => `${n} day${n === 1 ? '' : 's'}`
  const r = data.rules || { login: 25, read: 50, solve: 100 }
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`${data.streak}-day streak, ${data.weekPoints} points this week`}
        className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-bold tabular-nums transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
        <span className={`flex items-center gap-0.5 ${lit ? 'text-orange-500' : 'text-slate-400'}`} title="Daily streak">
          <span aria-hidden="true" className={lit ? '' : 'grayscale opacity-60'}>🔥</span>{data.streak}
        </span>
        <span className="hidden items-center gap-1 text-amber-500 sm:flex" title="Points this week">
          {/* A drawn star instead of the ⭐ emoji, which renders small and washed out on dark backgrounds. */}
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] drop-shadow-[0_0_4px_rgba(251,191,36,0.55)]" aria-hidden="true">
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          {Number(data.weekPoints).toLocaleString('en-IN')}
        </span>
      </button>

      {toast && (
        <div role="status" className="premium-fade absolute right-0 top-11 z-50 whitespace-nowrap rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div>
      )}

      {open && (
        <div className="premium-fade fixed inset-x-2 top-16 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${lit ? 'bg-orange-500/15' : 'bg-slate-100 dark:bg-white/5'}`} aria-hidden="true">🔥</span>
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900 dark:text-white">{days(data.streak)} streak</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Best: {days(data.best)} · {data.checkedInToday ? <span className="text-emerald-600 dark:text-emerald-400">today counted ✓</span> : 'sign in daily to keep it'}
              </p>
            </div>
          </div>

          {data.nextMilestone && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span>{days(data.nextMilestone.daysLeft)} more to a {data.nextMilestone.days}-day streak</span>
                <span className="shrink-0 font-bold text-amber-600 dark:text-amber-400">+{fmt(data.nextMilestone.bonus)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all" style={{ width: `${Math.max(4, Math.round((data.streak / data.nextMilestone.days) * 100))}%` }} />
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-slate-100 px-3 py-4 dark:bg-white/5">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{fmt(data.weekPoints)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">points this week</p>
              <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">{data.league}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-4 dark:bg-white/5">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{fmt(data.totalPoints)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">points all time</p>
            </div>
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">How to earn</p>
          <ul className="mt-2 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
            {[['📅', 'Daily sign-in', r.login], ['📖', 'Read a new question', r.read], ['💻', 'Solve a new coding problem', r.solve]].map(([icon, label, pts]) => (
              <li key={label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5"><span aria-hidden="true" className="w-5 text-center">{icon}</span>{label}</span>
                <span className="shrink-0 font-bold tabular-nums text-amber-600 dark:text-amber-400">+{pts}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><span aria-hidden="true" className="w-5 text-center">🔥</span>Streak bonuses</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[[7, 100], [30, 500], [100, 2000]].map(([d, pts]) => (
              <div key={d} className={`rounded-lg px-2 py-2 text-center ring-1 ${data.best >= d ? 'bg-orange-500/10 ring-orange-500/30' : 'bg-slate-50 ring-slate-200 dark:bg-white/5 dark:ring-white/10'}`}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{d} days</p>
                <p className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">+{fmt(pts)}</p>
              </div>
            ))}
          </div>

          <a href="/leaderboard" className="mt-5 block rounded-xl bg-slate-900 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/15">See the leaderboard →</a>
        </div>
      )}
    </div>
  )
}
