import { useEffect, useMemo, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import { setPageSeo } from '../lib/seo.js'
import { techBadge, difficultyBadge, techLabel } from '../lib/badges.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const RANGES = [[7, 'This week'], [14, '2 weeks'], [30, '30 days']]

const ago = at => {
  const d = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 864e5))
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

function Card({ q, tone }) {
  const edge = tone === 'new' ? 'border-l-emerald-500' : 'border-l-teal-500'
  return (
    <a href={`/${q.slug}?id=${encodeURIComponent(q.id)}`} className={`group block rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950 ${edge}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${techBadge(q.tech)}`}>{techLabel(q.tech)}</span>
        {q.difficulty && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${difficultyBadge(q.difficulty)}`}>{q.difficulty}</span>}
        <span className="ml-auto text-[11px] text-slate-400">{ago(q.at)}</span>
      </div>
      <h3 className="mt-2 text-[15px] font-bold leading-snug text-slate-900 group-hover:text-emerald-700 dark:text-slate-100 dark:group-hover:text-emerald-300">{q.title}</h3>
      <p className={`mt-2 text-xs font-bold ${tone === 'new' ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400'}`}>{tone === 'new' ? 'Read the new question →' : 'See the improved answer →'}</p>
    </a>
  )
}

function Section({ title, subtitle, items, tone }) {
  if (!items.length) return null
  const chip = tone === 'new' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${chip}`}>{title} · {items.length}</span>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{items.map(q => <Card key={q.id} q={q} tone={tone} />)}</div>
    </section>
  )
}

// Where the "new & updated questions" email lands: everything added or improved recently, filterable by topic.
export default function UpdatesPage() {
  const [days, setDays] = useState(() => [7, 14, 30].includes(Number(new URLSearchParams(window.location.search).get('days'))) ? Number(new URLSearchParams(window.location.search).get('days')) : 7)
  const [data, setData] = useState(null)
  const [tech, setTech] = useState('all')
  useEffect(() => { setPageSeo({ title: "What's new: new and updated interview questions | Interview Reader", description: 'Interview questions added or improved recently.', path: '/updates' }) }, [])
  useEffect(() => {
    setData(null)
    fetch(`${API_BASE}/questions/updates?days=${days}`).then(r => r.json()).then(setData).catch(() => setData({ added: [], updated: [] }))
  }, [days])
  const pick = list => (list || []).filter(q => tech === 'all' || q.tech === tech)
  const techs = useMemo(() => [...new Set([...(data?.added || []), ...(data?.updated || [])].map(q => q.tech))].sort(), [data])
  const added = pick(data?.added), updated = pick(data?.updated)
  return (
    <div className="flex min-h-screen flex-col bg-emerald-50/40 dark:bg-slate-900">
      <TopBar />
      <header className="bg-gradient-to-r from-emerald-700 via-green-600 to-teal-600 px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-white/80">Interview Reader</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">What’s new</h1>
          <p className="mt-2 max-w-xl text-sm text-white/85">Fresh questions and sharper answers, straight from the last few days. Read the ones that match your interview.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {RANGES.map(([d, label]) => <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${days === d ? 'bg-white text-emerald-700 shadow' : 'bg-white/15 text-white hover:bg-white/25'}`}>{label}</button>)}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-12">
        {!data ? <p className="mt-10 text-center text-sm text-slate-500">Loading…</p> : (
          <>
            {techs.length > 1 && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {['all', ...techs].map(t => <button key={t} type="button" onClick={() => setTech(t)} className={`rounded-full px-3 py-1 text-xs font-bold transition ${tech === t ? 'bg-emerald-600 text-white' : t === 'all' ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200' : techBadge(t)}`}>{t === 'all' ? 'All topics' : techLabel(t)}</button>)}
              </div>
            )}
            <Section title="New" subtitle="Added to the question bank" items={added} tone="new" />
            <Section title="Updated" subtitle="Existing questions with a better answer" items={updated} tone="updated" />
            {!added.length && !updated.length && (
              <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-950">
                <p className="text-3xl" aria-hidden="true">🌱</p>
                <p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">Nothing new in this window</p>
                <p className="mt-1 text-sm text-slate-500">Try a longer range, or pick up where you left off.</p>
                <a href="/" className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Browse all questions</a>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
