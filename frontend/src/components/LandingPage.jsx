import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Loader from './Loader.jsx'
import NotFound from './NotFound.jsx'
import { setPageSeo } from '../lib/seo.js'
import { difficultyBadge } from '../lib/badges.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// A keyword landing page ("Java interview questions", "Sliding window problems", ...). The text comes from the server, which also serves the
// same page as plain HTML to crawlers, so people and search/AI bots read identical content.
export default function LandingPage({ path }) {
  const [page, setPage] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/public/landing?path=${encodeURIComponent(path)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(p => {
        setPage(p)
        setPageSeo({
          title: p.title, description: p.description, path,
          jsonLd: { '@context': 'https://schema.org', '@type': 'FAQPage',
            mainEntity: (p.faq || []).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        })
      })
      .catch(() => setError(true))
  }, [path])

  const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950'
  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl space-y-4">
          {error && <NotFound title="Page not found" message="This page does not exist." />}
          {!page && !error && <Loader label="Loading…" />}
          {page && (
            <>
              <header className={card}>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">{page.h1}</h1>
                {page.intro.map((t, i) => <p key={i} className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t}</p>)}
              </header>

              {page.questions.length > 0 && (
                <section className={card} aria-labelledby="lp-q">
                  <h2 id="lp-q" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Questions ({page.questions.length})</h2>
                  <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {page.questions.map(q => (
                      <li key={q.id}>
                        <a href={`/${q.slug}?id=${encodeURIComponent(q.id)}`} className="flex items-start justify-between gap-3 py-2.5 text-sm text-slate-800 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300">
                          <span>{q.title}</span>
                          {q.difficulty && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${difficultyBadge(q.difficulty)}`}>{q.difficulty}</span>}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {page.problems.length > 0 && (
                <section className={card} aria-labelledby="lp-p">
                  <h2 id="lp-p" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Coding problems ({page.problems.length})</h2>
                  <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {page.problems.map(p => (
                      <li key={p.id}>
                        <a href={`/practice?id=${p.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm text-slate-800 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300">
                          <span>{p.title}</span>
                          {p.difficulty && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${difficultyBadge(p.difficulty)}`}>{p.difficulty}</span>}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className={card} aria-labelledby="lp-r">
                <h2 id="lp-r" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Keep preparing</h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {page.links.map(l => <li key={l.url}><a href={l.url} className="text-emerald-700 hover:underline dark:text-emerald-400">{l.label} →</a></li>)}
                </ul>
              </section>

              <section className={card} aria-labelledby="lp-f">
                <h2 id="lp-f" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Frequently asked questions</h2>
                <dl className="mt-3 space-y-4">
                  {page.faq.map(f => (
                    <div key={f.q}>
                      <dt className="text-sm font-semibold text-slate-900 dark:text-slate-100">{f.q}</dt>
                      <dd className="mt-1 text-sm text-slate-600 dark:text-slate-300">{f.a}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}
