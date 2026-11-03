import { useEffect, useState } from 'react'
import { fetchComments, addDiscussionComment, editDiscussionComment, deleteDiscussionComment, ago } from '../lib/discuss.js'
import { isLoggedIn } from '../lib/auth.js'
import { Avatar } from './DiscussParts.jsx'

const MAX_DEPTH = 3   // deeper replies stay at this level, so a long chain doesn't squeeze into a sliver

function Composer({ placeholder, onSubmit, onCancel, autoFocus, initial = '', hideAnon = false, submitLabel = 'Post' }) {
  const [body, setBody] = useState(initial)
  const [anon, setAnon] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const send = async e => {
    e.preventDefault(); if (!body.trim()) return
    setBusy(true); setErr('')
    try { await onSubmit(body.trim(), anon); if (!initial) setBody('') } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={send} className="space-y-2">
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} rows={3} maxLength={5000}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
      <div className="flex flex-wrap items-center gap-3">
        {!hideAnon && <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"><input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} className="accent-emerald-600" />🕶️ Anonymous</label>}
        <button type="submit" disabled={busy || !body.trim()} className="ml-auto rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:underline">Cancel</button>}
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </form>
  )
}

function Node({ c, byParent, depth, authed, replyTo, setReplyTo, onReply, onDelete, onEdit, onNeedAuth }) {
  const kids = byParent.get(c.id) || []
  const [editing, setEditing] = useState(false)
  return (
    <li>
      <div className="flex gap-2.5">
        <Avatar author={c.author} size="h-7 w-7 text-xs" />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500"><span className="font-semibold text-slate-800 dark:text-slate-200">{c.author?.name}</span> · {ago(c.createdAt)}{c.editedAt && <span className="italic" title={new Date(c.editedAt).toLocaleString()}> · edited</span>}</div>
          {editing
            ? <div className="mt-1"><Composer autoFocus initial={c.body} hideAnon submitLabel="Save" onSubmit={async b => { await onEdit(c.id, b); setEditing(false) }} onCancel={() => setEditing(false)} /></div>
            : <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">{c.body}</p>}
          <div className="mt-1 flex gap-3 text-xs font-semibold text-slate-500">
            <button type="button" onClick={() => (authed ? setReplyTo(replyTo === c.id ? null : c.id) : onNeedAuth())} className="hover:text-emerald-600">Reply</button>
            {c.mine && !editing && <button type="button" onClick={() => setEditing(true)} className="hover:text-emerald-600">Edit</button>}
            {c.mine && <button type="button" onClick={() => window.confirm('Delete your comment?') && onDelete(c.id)} className="hover:text-rose-500">Delete</button>}
          </div>
          {replyTo === c.id && <div className="mt-2"><Composer autoFocus placeholder={`Reply to ${c.author?.name}…`} onSubmit={(b, a) => onReply(b, c.id, a)} onCancel={() => setReplyTo(null)} /></div>}
          {kids.length > 0 && (
            <ul className={`mt-3 space-y-3 ${depth < MAX_DEPTH ? 'border-l-2 border-slate-200 pl-3 dark:border-slate-800' : ''}`}>
              {kids.map(k => <Node key={k.id} c={k} byParent={byParent} depth={depth + 1} authed={authed} replyTo={replyTo} setReplyTo={setReplyTo} onReply={onReply} onDelete={onDelete} onEdit={onEdit} onNeedAuth={onNeedAuth} />)}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}

// Threaded replies under a post. Anyone can read; signed-in members comment and reply (anonymously if they like).
export default function DiscussComments({ postId, onCount, onNeedAuth }) {
  const [list, setList] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const authed = isLoggedIn()
  const load = () => fetchComments(postId).then(l => { setList(l); onCount?.(l.length) }).catch(() => setList([]))
  useEffect(() => { load() }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps
  const byParent = new Map()
  ;(list || []).forEach(c => { const k = c.parentId ?? 0; byParent.set(k, [...(byParent.get(k) || []), c]) })
  const roots = byParent.get(0) || []
  // A reply whose parent was removed would vanish; show it at the top level instead.
  const ids = new Set((list || []).map(c => c.id))
  const orphans = (list || []).filter(c => c.parentId != null && !ids.has(c.parentId))
  const add = async (body, parentId, anon) => { await addDiscussionComment(postId, body, parentId, anon); setReplyTo(null); await load() }
  const edit = async (cid, body) => { await editDiscussionComment(postId, cid, body); await load() }
  const del = async cid => { await deleteDiscussionComment(postId, cid).catch(() => {}); load() }
  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-950 sm:p-6" aria-label="Comments">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">💬 {list ? list.length : ''} {list && list.length === 1 ? 'comment' : 'comments'}</h2>
      <div className="mt-3">
        {authed ? <Composer placeholder="Add to the discussion…" onSubmit={(b, a) => add(b, null, a)} /> : (
          <button type="button" onClick={onNeedAuth} className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-400">Sign in to join the discussion</button>
        )}
      </div>
      {list && list.length === 0 && <p className="mt-4 text-sm text-slate-500">No comments yet. Start the conversation.</p>}
      <ul className="mt-5 space-y-4">
        {[...roots, ...orphans].map(c => <Node key={c.id} c={c} byParent={byParent} depth={1} authed={authed} replyTo={replyTo} setReplyTo={setReplyTo} onReply={add} onDelete={del} onEdit={edit} onNeedAuth={onNeedAuth} />)}
      </ul>
    </section>
  )
}
