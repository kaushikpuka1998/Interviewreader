import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import AuthModal from './AuthModal.jsx'
import NewDiscussionDialog from './NewDiscussionDialog.jsx'
import { PostCard } from './DiscussParts.jsx'
import { CATEGORIES, fetchDiscussions, fetchTrending } from '../lib/discuss.js'
import { isLoggedIn } from '../lib/auth.js'
import { setPageSeo } from '../lib/seo.js'

const FREE_PREVIEW = 5   // posts a signed-out visitor can read before the sign-in card

// Community: interview experiences, compensation and general talk. Public to read; after the first few posts a signed-out
// visitor gets a sign-in card. Upvotes/downvotes drive "Top" and the Trending list.
export default function DiscussPage() {
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState('new')
  const [q, setQ] = useState('')
  const [company, setCompany] = useState('')
  const [pages, setPages] = useState([])        // loaded pages of items
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [trending, setTrending] = useState([])
  const [authOpen, setAuthOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const authed = isLoggedIn()

  useEffect(() => { setPageSeo({ title: 'Interview experiences & compensation discussions | Interview Reader', description: 'Real interview experiences, compensation reports and community discussion from candidates preparing for top tech companies.', path: '/discuss' }) }, [])
  useEffect(() => { fetchTrending().then(setTrending).catch(() => {}) }, [])
  const load = (page, replace) => {
    setLoading(true)
    fetchDiscussions({ sort, category: cat, company, page }).then(r => {
      setPages(p => (replace ? r.items : [...p, ...r.items])); setHasMore(r.hasMore)
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load(0, true) }, [sort, cat, company]) // eslint-disable-line react-hooks/exhaustive-deps
  const update = nd => { setPages(p => p.map(x => (x.id === nd.id ? nd : x))); setTrending(t => t.map(x => (x.id === nd.id ? nd : x))) }
  const needAuth = () => setAuthOpen(true)
  const compose = () => (authed ? setComposeOpen(true) : needAuth())
  const shown = authed ? pages : pages.slice(0, FREE_PREVIEW)
  const gated = !authed && pages.length > FREE_PREVIEW || (!authed && hasMore)

  const pill = on => `rounded-full px-3 py-1.5 text-sm font-semibold transition ${on ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-emerald-500/10 dark:bg-slate-950 dark:text-slate-300'}`
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Community</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Interview experiences, real compensation numbers and questions, from people who just did it.</p>
          </div>
          <button type="button" onClick={compose} data-track="discuss_new_post" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">✍️ Share your experience</button>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section>
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map(c => <button key={c.key} type="button" className={pill(cat === c.key)} onClick={() => setCat(c.key)}>{c.icon} {c.label}</button>)}
              <div className="ml-auto flex items-center gap-2">
                <form onSubmit={e => { e.preventDefault(); setCompany(q.trim()) }}><input value={q} onChange={e => setQ(e.target.value)} onBlur={() => setCompany(q.trim())} placeholder="Filter by company" className="w-40 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></form>
                <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  <option value="new">Newest</option><option value="top">Top voted</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {shown.map(d => <PostCard key={d.id} d={d} onChange={update} onNeedAuth={needAuth} />)}
              {!loading && shown.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 dark:bg-slate-950">No posts here yet. Be the first to share.</p>}
              {loading && <p className="py-4 text-center text-sm text-slate-500">Loading…</p>}
            </div>

            {gated && (
              <div className="relative mt-3">
                <div className="pointer-events-none space-y-3 opacity-40 blur-[3px]" aria-hidden="true">
                  {pages.slice(FREE_PREVIEW, FREE_PREVIEW + 2).map(d => <PostCard key={d.id} d={d} onChange={() => {}} />)}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-slate-100/80 to-slate-100 p-4 dark:via-slate-900/80 dark:to-slate-900">
                  <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-white p-5 text-center shadow-xl dark:bg-slate-950">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Sign in to keep reading</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Free account: read every experience and compensation report, vote, and share your own, even anonymously.</p>
                    <button type="button" onClick={needAuth} data-track="discuss_signin_gate" className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Sign in or register</button>
                  </div>
                </div>
              </div>
            )}
            {authed && hasMore && !loading && (
              <button type="button" onClick={() => load(Math.ceil(pages.length / 15), false)} className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">Load more</button>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">🔥 Trending this week</h2>
              <ol className="mt-3 space-y-3">
                {trending.map((d, i) => (
                  <li key={d.id} className="flex gap-3">
                    <span className={`w-5 shrink-0 text-center text-sm font-bold ${i === 0 ? 'text-amber-500' : 'text-slate-400'}`}>{i + 1}</span>
                    <a href={`/discuss/${d.id}`} className="min-w-0 flex-1" data-track="discuss_trending_open">
                      <span className="block text-sm font-medium leading-snug text-slate-900 hover:text-emerald-600 dark:text-slate-100">{d.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{d.company ? `${d.company} · ` : ''}▲ {d.score} · 👁 {d.views}</span>
                    </a>
                  </li>
                ))}
                {trending.length === 0 && <li className="text-sm text-slate-500">Nothing trending yet.</li>}
              </ol>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4 text-sm text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-100">💰 Know your market worth</p>
              <p className="mt-1">Compensation posts show company, level, years of experience and total pay, shared by members. Add yours, anonymously if you prefer.</p>
            </div>
          </aside>
        </div>
      </main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
      {composeOpen && <NewDiscussionDialog onClose={() => setComposeOpen(false)} onCreated={d => { setComposeOpen(false); window.location.href = `/discuss/${d.id}` }} />}
      <Footer />
    </div>
  )
}
