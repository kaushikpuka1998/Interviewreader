import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import Markdown from './Markdown.jsx'
import ListenButton from './ListenButton.jsx'
import ShareLinkedIn from './ShareLinkedIn.jsx'
import { HelpfulVote } from './AnswerExtras.jsx'
import { fetchQotd, fetchProblemStatement } from '../lib/engage.js'
import { fetchQuestion } from '../lib/api.js'
import { isLoggedIn, markReadRemote } from '../lib/auth.js'
import AuthModal from './AuthModal.jsx'
import { setPageSeo } from '../lib/seo.js'

// A new free question every day, with its answer on a public page: a reason to come back, and a page worth sharing.
export default function QuestionOfTheDayPage() {
  const [q, setQ] = useState(null)
  const [problem, setProblem] = useState(null)
  const [error, setError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const authed = isLoggedIn()
  useEffect(() => {
    if (!authed) { fetchQotd().then(d => { setQ(d.id ? { title: d.title } : null); setProblem(d.problem || null) }).catch(() => {}); return }
    fetchQotd().then(d => { setProblem(d.problem || null); if (d.problem) fetchProblemStatement(d.problem.id).then(x => setProblem(p => ({ ...p, statement: x.statement }))).catch(() => {}); return d.id ? fetchQuestion(d.id) : Promise.reject(new Error('No question today')) }).then(item => {
      setQ(item)
      setPageSeo({ title: `Daily interview challenge: ${item.title} | Interview Reader`, description: `Today's interview question with a detailed answer: ${item.title}`, path: '/question-of-the-day' })
    }).catch(e => setError(e.message))
  }, [authed])
  // Reading it counts: marked read once the member has stayed on the answer for a few seconds, so the home card can tick it off.
  useEffect(() => {
    if (!authed || !q?.id) return
    const t = setTimeout(() => markReadRemote(q.id).catch(() => {}), 8000)
    return () => clearTimeout(t)
  }, [authed, q?.id])
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  if (!authed) return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sign in to take today's challenge</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Two new items every day, free with an account. Sign in to unlock them and keep your streak.</p>
          <ul className="mt-4 space-y-2 text-left text-sm">
            {q && <li className="rounded-xl bg-blue-500/10 px-3 py-2">📖 <b>Read:</b> {q.title}</li>}
            {problem && <li className="rounded-xl bg-emerald-500/10 px-3 py-2">💻 <b>Solve:</b> {problem.title} · {problem.difficulty}</li>}
          </ul>
          <button type="button" onClick={() => setAuthOpen(true)} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Sign in or register</button>
        </div>
      </main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
      <Footer />
    </div>
  )
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Daily challenge · {today}</p>
        {problem && (
          <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white" aria-hidden="true">💻</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Coding problem of the day · {problem.difficulty}</span>
                <span className="block truncate text-base font-semibold text-slate-900 dark:text-slate-100">{problem.title}</span>
              </span>
              <a href={`/practice?id=${problem.id}`} data-track="qotd_page_solve" className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Open in editor →</a>
            </div>
            {problem.statement && <div className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-white/60 p-3 dark:bg-slate-900/50"><Markdown text={problem.statement} /></div>}
          </div>
        )}
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Question to read</p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!q && !error && <p className="mt-4 text-sm text-slate-500">Loading today's question…</p>}
        {q && (
          <article className="mt-2 rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-950">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{q.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ListenButton question={q} />
              <ShareLinkedIn question={q} label="Share" />
              <a href={`/${(q.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)}?id=${q.id}`}
                className="inline-flex min-h-9 items-center rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-700 hover:bg-slate-200 sm:min-h-11 dark:bg-slate-800 dark:text-slate-200">Open in the reader →</a>
            </div>
            <div className="mt-6"><Markdown text={q.answer} /></div>
            <HelpfulVote question={q} />
          </article>
        )}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-800 dark:bg-slate-950">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Come back tomorrow for a new pair</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Open it every day to build your streak and earn points.</p>
          <a href="/questions" className="mt-3 inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Browse all questions</a>
        </section>
      </main>
      <Footer />
    </div>
  )
}
