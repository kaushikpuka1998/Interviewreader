import { useEffect, useState } from 'react'
import { fetchAdminComments, moderateComment, deleteCommentAdmin } from '../lib/engage.js'
import { slugify } from '../lib/slug.js'

// Admin: moderate comments. "Reported" shows what members flagged (3 reports hide a comment automatically).
export default function CommentsAdmin({ onChange }) {
  const [filter, setFilter] = useState('reported')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const load = () => { setRows(null); fetchAdminComments(filter).then(d => setRows(d.comments)).catch(e => setError(e.message)) }
  useEffect(load, [filter]) // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (id, action) => {
    try { action === 'delete' ? await deleteCommentAdmin(id) : await moderateComment(id, action); load(); onChange?.() } catch (e) { setError(e.message) }
  }
  const btn = 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold dark:border-slate-600'
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[['reported', 'Reported'], ['all', 'All recent']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-lg px-3 py-1 text-xs font-medium ${filter === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{l}</button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows ? <p className="text-sm text-slate-500">Loading…</p> : rows.length === 0 ? <p className="text-sm text-slate-500">{filter === 'reported' ? 'Nothing is waiting for review.' : 'No comments yet.'}</p> : (
        <ul className="space-y-2">
          {rows.map(c => (
            <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span><b className="text-slate-800 dark:text-slate-200">{c.author}</b> on <a href={`/${slugify(c.questionTitle)}?id=${c.questionId}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{c.questionTitle || c.questionId}</a> · {new Date(c.createdAt).toLocaleString()}</span>
                <span className={c.status === 'HIDDEN' ? 'font-semibold text-rose-600' : ''}>{c.status === 'HIDDEN' ? 'Hidden · ' : ''}{c.reports} report{c.reports === 1 ? '' : 's'}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900 dark:text-slate-100">{c.body}</p>
              <div className="mt-2 flex gap-2">
                {c.status === 'HIDDEN' || c.reports > 0 ? <button type="button" onClick={() => act(c.id, 'show')} className={`${btn} text-emerald-700 dark:text-emerald-300`}>Approve (show)</button> : null}
                {c.status !== 'HIDDEN' && <button type="button" onClick={() => act(c.id, 'hide')} className={`${btn} text-amber-700 dark:text-amber-300`}>Hide</button>}
                <button type="button" onClick={() => window.confirm('Delete this comment for good?') && act(c.id, 'delete')} className={`${btn} text-rose-600 dark:text-rose-400`}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
