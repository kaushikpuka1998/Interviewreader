import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Loader from './Loader.jsx'
import NotFound from './NotFound.jsx'
import { setPageSeo } from '../lib/seo.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-950'
const tone = p => (p >= 60 ? 'bg-emerald-500' : p >= 30 ? 'bg-amber-500' : 'bg-red-500')
const Bar = ({ percent }) => <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${tone(percent)}`} style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }} /></div>

// Role-wise tracks: /tracks lists them, /tracks/<id> shows one as an ordered path with progress on every step.
export default function TracksPage({ id }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setData(null); setError(false)
    fetch(`${API_BASE}/public/tracks${id ? `/${encodeURIComponent(id)}` : ''}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        setData(d)
        if (id) setPageSeo({ title: `${d.title} Interview Track: ${d.tagline} | Interview Reader`, description: `${d.description} Questions with answers, in the order to study them.`, path: `/tracks/${id}` })
        else setPageSeo({ title: 'Role-wise Interview Tracks: Java Backend, Frontend, Full Stack | Interview Reader', description: 'Pick your role and follow one ordered path of interview questions: language, framework, databases, messaging and system design.', path: '/tracks' })
      })
      .catch(() => setError(true))
  }, [id])

  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl space-y-4">
          {error && <NotFound title="Track not found" message="There is no such track. Pick one from the list." />}
          {!data && !error && <Loader label="Loading…" />}
          {data && !id && <List tracks={data} />}
          {data && id && <Detail t={data} />}
        </div>
      </div>
    </>
  )
}

function List({ tracks }) {
  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">Role-wise interview tracks</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pick the role you are preparing for. Each track puts the topics in the order to study them, with your progress on every step.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {tracks.map(t => (
          <a key={t.id} href={`/tracks/${t.id}`} className={`${card} block transition hover:border-emerald-400 hover:shadow-md`}>
            <img  src="https://img.icons8.com/3d-fluency/1200/java-coffee-cup-logo.jpg" alt="Java Icon" className="w-10 h-10 flex-shrink-0 mt-1"  />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.title}</h2>
            <p className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-400">{t.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{t.stack.map(s => <span key={s} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{s}</span>)}</div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.questions.toLocaleString()} questions →</p>
          </a>
        ))}
      </div>
    </>
  )
}

function Detail({ t }) {
  const next = t.steps.find(s => s.next)
  return (
    <>
      <header className={card}>
        <a href="/tracks" className="text-xs text-emerald-700 hover:underline dark:text-emerald-400">← All tracks</a>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">{t.title}</h1>
        <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">{t.tagline}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t.description}</p>
        {t.signedIn ? (
          <div className="mt-4">
            <div className="mb-1 flex items-baseline justify-between text-xs text-slate-500 dark:text-slate-400"><span>Your progress</span><span className="tabular-nums">{t.read.toLocaleString()} / {t.total.toLocaleString()} read · {t.percent}%</span></div>
            <Bar percent={t.percent} />
            {next && <a href={`/${next.next.slug}?id=${encodeURIComponent(next.next.id)}`} className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{t.read ? 'Continue' : 'Start'}: {next.title} →</a>}
          </div>
        ) : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">Sign in to track your progress through this path.</p>}
      </header>

      <ol className="space-y-3">
        {t.steps.map(s => (
          <li key={s.n} className={card}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{s.n}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{s.title}</h2>
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{t.signedIn ? `${s.read} / ${s.total} read` : `${s.total} questions`}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{s.why}</p>
                {t.signedIn && <div className="mt-2"><Bar percent={s.percent} /></div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.next
                    ? <a href={`/${s.next.slug}?id=${encodeURIComponent(s.next.id)}`} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">{s.read ? 'Continue' : 'Start'} →</a>
                    : <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">✓ Done</span>}
                  <a href={`/?tech=${s.tech}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Browse all</a>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {t.scenarios.length > 0 && (
        <section className={card} aria-labelledby="tk-sc">
          <h2 id="tk-sc" className="text-lg font-semibold text-slate-900 dark:text-slate-100">System design scenarios to start with</h2>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {t.scenarios.map(q => <li key={q.id}><a href={`/${q.slug}?id=${encodeURIComponent(q.id)}`} className="block py-2.5 text-sm text-slate-800 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300">{q.title}</a></li>)}
          </ul>
        </section>
      )}
    </>
  )
}
