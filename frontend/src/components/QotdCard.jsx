import { useEffect, useState } from 'react'
import { fetchQotd } from '../lib/engage.js'
import { isLoggedIn, fetchProgress } from '../lib/auth.js'
import { fetchSolvedIds } from '../lib/code.js'

const DIFF = { basic: 'text-emerald-600 dark:text-emerald-400', intermediate: 'text-amber-600 dark:text-amber-400', advanced: 'text-rose-600 dark:text-rose-400' }

const Done = () => <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">✓ Done</span>

// Today's two challenges as one card: a question to read and a coding problem to solve. Links to /question-of-the-day.
export default function QotdCard({ className = '' }) {
  const [d, setD] = useState(null)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState({ read: false, solved: false })   // only known for a signed-in member
  useEffect(() => {
    fetchQotd().then(x => {
      if (!x.id) return setFailed(true)
      setD(x)
      if (!isLoggedIn()) return
      fetchProgress().then(p => setDone(s => ({ ...s, read: p.read.includes(x.id) }))).catch(() => {})
      if (x.problem) fetchSolvedIds().then(ids => setDone(s => ({ ...s, solved: ids.includes(x.problem.id) }))).catch(() => {})
    }).catch(() => setFailed(true))
  }, [])
  // While the data loads the card keeps its size, so the page below doesn't jump when it fills in; with nothing to show it disappears.
  if (!d) return failed ? null : <div className={`mx-auto max-w-2xl ${className}`} aria-hidden="true"><div className="aspect-[1200/520] w-full animate-pulse rounded-2xl bg-emerald-50 dark:bg-slate-800/50" /><div className="mt-2 h-[132px] animate-pulse rounded-2xl bg-emerald-50 dark:bg-slate-800/50" /></div>
  const row = 'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-emerald-50 dark:hover:bg-blue-500/10'
  return (
    <section aria-label="Today's challenge" className={`mx-auto max-w-2xl rounded-2xl border border-emerald-700/20 bg-white p-2 text-left shadow-lg shadow-emerald-900/10 dark:border-blue-500/30 dark:bg-transparent dark:bg-gradient-to-r dark:from-blue-500/10 dark:to-transparent dark:shadow-sm ${className}`}>
      <a href="/question-of-the-day" data-track="qotd_card_banner" tabIndex={-1} aria-hidden="true"><img src="/promo/daily-hero.jpg" alt="" width="1200" height="520" decoding="async" className="mb-1 block h-auto w-full rounded-xl" /></a>
      <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">🔥 Today's challenge · new every day</p>
      <a href="/question-of-the-day" data-track="qotd_card_read" className={row}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-lg text-white" aria-hidden="true">📖</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-600 dark:text-slate-400">Read{done.read && <Done />}</span>
          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{d.title}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-blue-700 dark:text-blue-300">{done.read ? 'Read again →' : 'Read →'}</span>
      </a>
      {d.problem && (
        <a href={`/practice?id=${d.problem.id}`} data-track="qotd_card_solve" className={row}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-lg text-white" aria-hidden="true">💻</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-slate-600 dark:text-slate-400">Solve{done.solved && <Done />} · <span className={`font-semibold ${DIFF[String(d.problem.difficulty).toLowerCase()] || ''}`}>{d.problem.difficulty}</span></span>
            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{d.problem.title}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{done.solved ? 'Solve again →' : 'Solve →'}</span>
        </a>
      )}
    </section>
  )
}
