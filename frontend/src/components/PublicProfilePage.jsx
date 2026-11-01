import NotFound from './NotFound.jsx'
import Loader from './Loader.jsx'
import { useState, useEffect } from 'react'
import TopBar from './TopBar.jsx'
import { techLabel, techBadge, difficultyBadge } from '../lib/badges.js'
import { TECH_COLOR, DIFF_COLOR } from './ProfilePage.jsx'
import ActivityHeatmap from './ActivityHeatmap.jsx'
import { slugify } from '../lib/slug.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// Public progress page at /u/:username. Shows only what the member chooses to make public:
// name, join date and progress. No email, location or private lists.
export default function PublicProfilePage({ username }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [listFilter, setListFilter] = useState('solved')   // Solved | Visited

  useEffect(() => {
    fetch(`${API_BASE}/public/profiles/${encodeURIComponent(username)}`)
      .then(res => {
        if (res.status === 404) throw new Error('This profile does not exist.')
        if (!res.ok) throw new Error('Could not load this profile.')
        return res.json()
      })
      .then(setProfile)
      .catch(e => setError(e.message))
  }, [username])

  const solvedQs = profile?.solved || []
  const visitedQs = profile?.visited || []
  const shownQs = listFilter === 'solved' ? solvedQs : visitedQs
  const coding = profile?.coding
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

  // Labelled bar: "label ....... solved / total". Bars are scaled to the category total, so a thin bar is honest about how much is left.
  const Bar = ({ label, solved, total, color }) => (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between text-xs">
        <span className="truncate text-slate-700 dark:text-slate-200">{label}</span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">{solved} / {total}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full ${color || 'bg-blue-500'}`} style={{ width: `${Math.max(pct(solved, total), solved > 0 ? 3 : 0)}%` }} />
      </div>
    </div>
  )
  const Card = ({ title, children, className = '' }) => (
    <section className={`flex min-h-0 flex-col rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800 ${className}`}>
      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
    </section>
  )
  const topics = profile ? profile.byTech.filter(x => x.solved > 0).sort((a, b) => b.solved - a.solved) : []

  // One screen on desktop: header, four headline cards, breakdown bars, and two lists that scroll inside their own boxes.
  return (
    <>
      <TopBar />
    <div className="min-h-[calc(100vh-5.4rem)] bg-slate-100 p-5 dark:bg-slate-900 lg:h-[calc(100vh-5.4rem)] lg:overflow-hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:h-full">
        {error === 'This profile does not exist.' ? (
          <div className="rounded-2xl bg-white dark:bg-slate-950">
            <NotFound title="Profile not found" message={`There is no member with the username "${username}". Check the link, or head back and keep practising.`} />
            <p className="pb-6 text-center"><a href="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Back to home</a></p>
          </div>
        ) : error && <p className="text-slate-500">{error}</p>}
        {!error && !profile && <Loader label="Loading profile…" />}

        {profile && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white">
                  {profile.name.trim().charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold leading-tight text-slate-900 dark:text-slate-100">{profile.name}</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Interview Reader member{profile.memberSince ? ` since ${new Date(profile.memberSince).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              <a href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Interview Reader</a>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Questions solved', solvedQs.length, `of ${profile.totalQuestions}`, 'from-emerald-500 to-teal-600'],
                ['Coding problems solved', coding?.solvedCount ?? 0, `of ${coding?.total ?? 0}`, 'from-sky-500 to-cyan-600'],
                ['Topics practiced', topics.length, `of ${profile.byTech.length}`, 'from-violet-500 to-fuchsia-600'],
                ['Questions visited', profile.visitedCount, `of ${profile.totalQuestions}`, 'from-amber-400 to-orange-500'],
              ].map(([label, value, of, gradient]) => (
                <div key={label} className={`rounded-xl bg-gradient-to-br ${gradient} px-4 py-3 text-white shadow-lg`}>
                  <p className="text-xs uppercase tracking-wide text-white/85">{label}</p>
                  <p className="text-3xl font-bold leading-tight tabular-nums">{value} <span className="text-sm font-medium text-white/80">{of}</span></p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Card title="Questions solved by topic">
                {topics.length === 0 ? <p className="text-sm text-slate-400">Nothing solved yet.</p> : (
                  <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                    {topics.map(x => <Bar key={x.tech} label={techLabel(x.tech)} solved={x.solved} total={x.total} color={TECH_COLOR[x.tech]} />)}
                  </div>
                )}
              </Card>
              <Card title="Questions solved by difficulty">
                <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                  {['Basic', 'Intermediate', 'Advanced'].map(d => profile.byDifficulty.find(x => x.difficulty === d)).filter(Boolean).map(x => <Bar key={x.difficulty} label={x.difficulty} solved={x.solved} total={x.total} color={DIFF_COLOR[x.difficulty]} />)}
                </div>
              </Card>
              <Card title="Coding solved by difficulty">
                {coding && coding.byDifficulty.length > 0 ? (
                  <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                    {coding.byDifficulty.map(x => <Bar key={x.difficulty} label={x.difficulty} solved={x.solved} total={x.total} color={DIFF_COLOR[x.difficulty]} />)}
                  </div>
                ) : <p className="text-sm text-slate-400">No coding problems yet.</p>}
              </Card>
            </div>

            <div className="flex"><ActivityHeatmap compact times={coding?.activity || []} /></div>

            <div className="grid grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
              <Card title={listFilter === 'solved' ? `Solved questions (${solvedQs.length})` : `Visited questions (${visitedQs.length})`} className="max-h-80 lg:max-h-none">
                <div className="-mt-9 mb-2 flex justify-end gap-1" role="group" aria-label="Show">
                  {[['solved', 'Solved'], ['visited', 'Visited']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setListFilter(key)}
                      aria-pressed={listFilter === key}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${listFilter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
                    >{label}</button>
                  ))}
                </div>
                {shownQs.length === 0 ? (
                  <p className="text-sm text-slate-400">{listFilter === 'solved' ? 'Nothing solved yet.' : 'No visited questions yet.'}</p>
                ) : (
                  <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
                    {shownQs.map(q => (
                      <li key={q.id}>
                        <a href={`/${slugify(q.question || q.title)}?id=${encodeURIComponent(q.id)}`} className="flex items-center justify-between gap-3 py-1.5 hover:text-blue-600 dark:hover:text-blue-400">
                          <span className="break-words text-sm text-slate-800 dark:text-slate-100">{q.title}</span>
                          <span className="flex flex-shrink-0 gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] ${techBadge(q.tech)}`}>{techLabel(q.tech)}</span>
                            {q.difficulty && <span className={`rounded-full px-2 py-0.5 text-[11px] ${difficultyBadge(q.difficulty)}`}>{q.difficulty}</span>}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title={`Solved coding problems (${coding?.solvedCount ?? 0})`} className="max-h-80 lg:max-h-none">
                {!coding || coding.solved.length === 0 ? (
                  <p className="text-sm text-slate-400">No coding problems solved yet.</p>
                ) : (
                  <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
                    {coding.solved.map(p => (
                      <li key={p.id}>
                        <a href={`/practice?id=${p.id}`} className="flex items-center justify-between gap-3 py-1.5 hover:text-blue-600 dark:hover:text-blue-400">
                          <span className="text-sm text-slate-800 dark:text-slate-100">{p.title}</span>
                          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] ${difficultyBadge(p.difficulty)}`}>{p.difficulty}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}
