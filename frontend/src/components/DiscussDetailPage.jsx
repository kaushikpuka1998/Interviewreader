import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import AuthModal from './AuthModal.jsx'
import { VoteRail, Avatar, Chips } from './DiscussParts.jsx'
import DiscussComments from './DiscussComments.jsx'
import NewDiscussionDialog from './NewDiscussionDialog.jsx'
import { fetchDiscussion, deleteDiscussion, ago } from '../lib/discuss.js'
import { setPageSeo } from '../lib/seo.js'

export default function DiscussDetailPage({ id }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    fetchDiscussion(id).then(x => { setD(x); setPageSeo({ title: `${x.title} | Interview Reader`, description: x.body.slice(0, 150), path: `/discuss/${id}` }) }).catch(() => setErr('This post is not available.'))
  }, [id])
  const remove = async () => { if (window.confirm('Delete this post?')) { await deleteDiscussion(id).catch(() => {}); window.location.href = '/discuss' } }
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <a href="/discuss" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">← Community</a>
        {err && <p className="mt-6 text-sm text-slate-600">{err}</p>}
        {!d && !err && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
        {d && (
          <article className="mt-3 flex gap-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-950 sm:p-6">
            <VoteRail d={d} onChange={setD} onNeedAuth={() => setAuthOpen(true)} />
            <div className="min-w-0 flex-1">
              <Chips d={d} />
              <h1 className="mt-3 text-2xl font-bold leading-snug text-slate-900 dark:text-slate-100">{d.title}</h1>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Avatar author={d.author} /><span className="font-medium text-slate-700 dark:text-slate-300">{d.author?.name}</span><span>· {ago(d.createdAt)} · 👁 {d.views}</span>
                {d.editedAt && <span className="text-xs italic" title={new Date(d.editedAt).toLocaleString()}>· edited</span>}
                {d.mine && <span className="ml-auto flex gap-3 text-xs font-semibold"><button type="button" onClick={() => setEditing(true)} className="text-emerald-600 hover:underline">Edit</button><button type="button" onClick={remove} className="text-rose-500 hover:underline">Delete</button></span>}
              </div>
              <div className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">{d.body}</div>
            </div>
          </article>
        )}
        {d && <DiscussComments postId={d.id} onNeedAuth={() => setAuthOpen(true)} />}
      </main>
      {editing && d && <NewDiscussionDialog post={d} onClose={() => setEditing(false)} onCreated={nd => { setD(nd); setEditing(false) }} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
      <Footer />
    </div>
  )
}
