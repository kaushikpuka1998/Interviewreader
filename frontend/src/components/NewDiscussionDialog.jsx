import { useState } from 'react'
import { CATEGORIES, createDiscussion, updateDiscussion } from '../lib/discuss.js'

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

// Post an interview experience, a compensation report or a general question. "Post anonymously" hides the name in the feed.
// With `post` it edits that post instead: same form, saved with PUT; whether it is anonymous is fixed once posted.
export default function NewDiscussionDialog({ onClose, onCreated, post }) {
  const [f, setF] = useState(post
    ? { category: post.category, anonymous: false, company: post.company || '', role: post.role || '', level: post.level || '', yoe: post.yoe ?? '', ctc: post.ctc || '', title: post.title, body: post.body }
    : { category: 'experience', anonymous: false, company: '', role: '', level: '', yoe: '', ctc: '', title: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = k => e => setF(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    const payload = { ...f, yoe: f.yoe === '' ? null : Number(f.yoe) }
    try { onCreated(post ? await updateDiscussion(post.id, payload) : await createDiscussion(payload)) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const comp = f.category === 'compensation'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="New post" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-950">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{post ? 'Edit your post' : 'Share with the community'}</h2><button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">✕</button></div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter(c => c.key !== 'all').map(c => (
            <button key={c.key} type="button" onClick={() => setF(s => ({ ...s, category: c.key }))}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${f.category === c.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>{c.icon} {c.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="Company (e.g. Amazon)" value={f.company} onChange={set('company')} maxLength={120} />
          <input className={input} placeholder="Role (e.g. SDE-2)" value={f.role} onChange={set('role')} maxLength={40} />
          <input className={input} placeholder="Level (e.g. L5)" value={f.level} onChange={set('level')} maxLength={40} />
          <input className={input} type="number" min="0" max="50" placeholder="Years of experience" value={f.yoe} onChange={set('yoe')} />
          {comp && <input className={`${input} col-span-2`} placeholder="Total compensation, e.g. 45 LPA + 10L stock" value={f.ctc} onChange={set('ctc')} maxLength={80} />}
        </div>
        <input className={input} placeholder="Title" value={f.title} onChange={set('title')} maxLength={200} required />
        <textarea className={`${input} min-h-[160px]`} placeholder={comp ? 'Offer breakdown, location, negotiation, what you would do differently…' : 'Rounds, questions asked, how it went, outcome…'} value={f.body} onChange={set('body')} required />
        {post ? (
          <p className="text-xs text-slate-500">{post.author?.anonymous ? '🕶️ Posted anonymously. That stays as it is.' : 'Posted under your name. That stays as it is.'}</p>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={f.anonymous} onChange={set('anonymous')} className="h-4 w-4 accent-emerald-600" />
            🕶️ Post anonymously <span className="text-xs text-slate-500">(your name is hidden in the feed)</span>
          </label>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? (post ? 'Saving…' : 'Posting…') : (post ? 'Save changes' : 'Post')}</button>
      </form>
    </div>
  )
}
