import { useState, useEffect } from 'react'
import Loader from './Loader.jsx'
import { setPageSeo } from '../lib/seo.js'
import TopBar from './TopBar.jsx'
import LeagueBadge from './LeagueBadge.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// Weekly leaderboard. Only the last 7 days count, so members who stop reading drop off on their own.
export default function LeaderboardPage() {
  useEffect(() => { setPageSeo({ title: 'Leaderboard: Top Interview Prep Learners | Interview Reader', description: 'See who is leading the weekly Interview Reader leagues. Earn points by signing in daily, reading questions and solving coding problems, and climb from Bronze to Platinum.', path: '/leaderboard', jsonLd: undefined, noindex: true }) }, [])
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('ir_token')
    fetch(`${API_BASE}/leaderboard`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => { if (!res.ok) throw new Error('Could not load the leaderboard.'); return res.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  return (
    <>
      <TopBar />
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Weekly leaderboard</h1>
          <a href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Interview Reader</a>
        </div>

        {error && <p className="text-slate-500">{error}</p>}
        {!error && !data && <Loader label="Loading the leaderboard…" />}

        {data && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Earn points: +{data.rules?.login ?? 25} for your daily sign-in, +{data.rules?.read ?? 50} for reading a new question (30 seconds or halfway down it), +{data.rules?.solve ?? 100} for solving a new coding problem, and streak bonuses at 7, 30 and 100 days.
              Only the last {data.windowDays} days count, so the board refreshes every week.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[...data.leagues].reverse().map(l => (
                <div key={l.name} className="rounded-xl bg-white dark:bg-slate-800 p-3 shadow-sm">
                  <LeagueBadge league={l.name} size="sm" />
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{l.minXp}+ points this week</p>
                </div>
              ))}
            </div>

            {data.me?.needsLocation && (
              <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                Add your country and city to appear on the leaderboard.{' '}
                <a href="/profile" className="font-semibold underline">Add location</a>
              </div>
            )}

            {data.me && (
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white shadow-lg shadow-blue-500/30 mb-6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/80">Your standing</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {data.me.rank ? `#${data.me.rank}` : 'Not ranked'} <span className="text-base font-medium text-white/80">· {data.me.xp} points</span>
                  </p>
                </div>
                <LeagueBadge league={data.me.league} size="sm" />
              </div>
            )}

            <section className="rounded-xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
              {data.board.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">No one has read anything this week yet. Be the first.</p>
              ) : (
                <ol className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.board.map(row => (
                    <li key={row.userId}>
                      <a href={row.username ? `/u/${row.username}` : undefined} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className={`w-8 text-center font-bold tabular-nums ${row.rank <= 3 ? 'text-amber-500' : 'text-slate-400'}`}>{row.rank}</span>
                        <span className="flex-1 min-w-0 truncate text-slate-800 dark:text-slate-100">{row.name}</span>
                        <LeagueBadge league={row.league} size="sm" />
                        <span className="w-28 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{row.xp.toLocaleString()} points</span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </div>
    </>
  )
}
