import { useEffect, useState } from 'react'
import { isLoggedIn } from '../lib/auth.js'
import AuthModal from './AuthModal.jsx'
import { fetchHelpful, voteHelpful, fetchComments, addComment, deleteComment, reportComment } from '../lib/engage.js'

const ago = t => {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}

// "Was this answer helpful?" One vote per member or visitor, changeable; a "no" can say what was missing.
export function HelpfulVote({ question }) {
  const [s, setS] = useState(null)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => { setS(null); setAsking(false); setNote(''); fetchHelpful(question.id).then(setS).catch(() => {}) }, [question.id])
  if (!s) return null
  const vote = async (helpful, text) => { try { setS(await voteHelpful(question.id, helpful, text)); setAsking(false) } catch { /* keep the old state */ } }
  const btn = on => `rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200'}`
  return (
    <div className="mt-8 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Was this answer helpful?</p>
        <button type="button" onClick={() => vote(true)} aria-pressed={s.mine === true} className={btn(s.mine === true)}>👍 Yes{s.helpful ? ` · ${s.helpful}` : ''}</button>
        <button type="button" onClick={() => (s.mine === false ? vote(false) : setAsking(true))} aria-pressed={s.mine === false} className={btn(s.mine === false)}>👎 No{s.notHelpful ? ` · ${s.notHelpful}` : ''}</button>
        {s.mine !== null && !asking && <span className="text-xs text-slate-500 dark:text-slate-400">Thanks for the feedback.</span>}
      </div>
      {asking && (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); vote(false, note) }}>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="What was missing or unclear? (optional)"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">Send</button>
        </form>
      )}
    </div>
  )
}

// Comments under the answer. Anyone reads; members write, delete their own and report others.
export function Comments({ question, onSignIn }) {
  const [list, setList] = useState(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reported, setReported] = useState({})
  const signedIn = isLoggedIn()
  useEffect(() => { setList(null); setBody(''); setError(''); fetchComments(question.id).then(setList).catch(() => setList([])) }, [question.id])
  if (!list) return null
  const post = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try { const c = await addComment(question.id, body); setList(l => [...l, c]); setBody('') }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const remove = async c => { if (!window.confirm('Delete your comment?')) return; try { await deleteComment(question.id, c.id); setList(l => l.filter(x => x.id !== c.id)) } catch (err) { setError(err.message) } }
  const report = async c => { try { await reportComment(c.id); setReported(r => ({ ...r, [c.id]: true })) } catch (err) { setError(err.message) } }
  return (
    <section className="mt-6" aria-label="Comments">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Discussion{list.length ? ` (${list.length})` : ''}</h3>
      <ul className="mt-3 space-y-3">
        {list.length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No comments yet. Share a tip, a follow-up question or how this was asked in your interview.</li>}
        {list.map(c => (
          <li key={c.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span><a href={c.username ? `/u/${c.username}` : undefined} className="font-semibold text-slate-800 hover:underline dark:text-slate-200">{c.author}</a> · {ago(c.createdAt)}</span>
              {c.mine
                ? <button type="button" onClick={() => remove(c)} className="text-red-600 hover:underline dark:text-red-400">Delete</button>
                : signedIn && (reported[c.id] ? <span>Reported</span> : <button type="button" onClick={() => report(c)} className="hover:text-red-600 hover:underline">Report</button>)}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900 dark:text-slate-100">{c.body}</p>
          </li>
        ))}
      </ul>
      {signedIn ? (
        <form onSubmit={post} className="mt-3 space-y-2">
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={2000} placeholder="Add a comment…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || body.trim().length < 3} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Posting…' : 'Post comment'}</button>
            <span className="text-xs text-slate-400">Be kind and specific. Comments reported by members are hidden for review.</span>
          </div>
        </form>
      ) : (
        <button type="button" onClick={onSignIn} className="mt-3 rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-400">Sign in to join the discussion</button>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}

export default function AnswerExtras({ question }) {
  const [authOpen, setAuthOpen] = useState(false)
  if (!question?.id) return null
  return (
    <div className="pb-6">
      <HelpfulVote question={question} />
      <Comments question={question} onSignIn={() => setAuthOpen(true)} />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
    </div>
  )
}
