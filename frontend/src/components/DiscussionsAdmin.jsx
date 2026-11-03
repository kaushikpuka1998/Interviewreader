import { useEffect, useState } from 'react'
import { fetchAdminDiscussions, adminHideAuthor, adminDiscussionAction, fetchAdminDiscussionComments, adminCommentAction, ago } from '../lib/discuss.js'

// Admin: moderate Community posts and their comments. Anonymous authors show their real email here.
export default function DiscussionsAdmin() {
  const [f, setF] = useState({ status: '', category: '', sort: 'new', q: '' })
  const [q, setQ] = useState('')                 // the box; applied to the search on Enter / Search
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)         // { items, total, totalPages }
  const [open, setOpen] = useState(null)         // post id whose comments are expanded
  const [cmts, setCmts] = useState([])
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const rows = data?.items
  const load = () => { setError(''); fetchAdminDiscussions({ ...f, page }).then(setData).catch(e => setError(e.message)) }
  useEffect(load, [f, page]) // eslint-disable-line react-hooks/exhaustive-deps
  const setFilter = patch => { setPage(0); setF(s => ({ ...s, ...patch })) }
  const search = e => { e?.preventDefault(); setFilter({ q: q.trim() }) }
  const hideAuthor = async email => {
    if (!window.confirm(`Hide ALL live posts by ${email}?`)) return
    try { const r = await adminHideAuthor(email); setNote(`Hid ${r.hidden} post${r.hidden === 1 ? '' : 's'} by ${email}.`); load() } catch (e) { setError(e.message) }
  }
  const act = async (id, action) => { try { await adminDiscussionAction(id, action); load() } catch (e) { setError(e.message) } }
  const toggle = id => { if (open === id) return setOpen(null); setOpen(id); fetchAdminDiscussionComments(id).then(setCmts).catch(e => setError(e.message)) }
  const cact = async (cid, action) => { try { await adminCommentAction(cid, action); setCmts(await fetchAdminDiscussionComments(open)); load() } catch (e) { setError(e.message) } }
  const btn = 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold dark:border-slate-600'
  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, company, author email (starts with) or post id"
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">Search</button>
        {f.q && <button type="button" onClick={() => { setQ(''); setFilter({ q: '' }) }} className="text-xs text-slate-500 hover:underline">Clear</button>}
      </form>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[['', 'All'], ['active', 'Live'], ['hidden', 'Hidden']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter({ status: k })} className={`rounded-lg px-3 py-1 font-medium ${f.status === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{l}</button>
        ))}
        <select value={f.category} onChange={e => setFilter({ category: e.target.value })} className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <option value="">Any category</option><option value="experience">Interview experience</option><option value="compensation">Compensation</option><option value="general">General</option>
        </select>
        <select value={f.sort} onChange={e => setFilter({ sort: e.target.value })} className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <option value="new">Newest</option><option value="score">Highest score</option><option value="comments">Most comments</option>
        </select>
        {data && <span className="ml-auto text-slate-500">{data.total.toLocaleString('en-IN')} post{data.total === 1 ? '' : 's'}</span>}
      </div>
      {note && <p className="text-sm text-emerald-700 dark:text-emerald-300">{note}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows ? <p className="text-sm text-slate-500">Loading…</p> : rows.length === 0 ? <p className="text-sm text-slate-500">No posts match.</p> : (
        <ul className="space-y-2">
          {rows.map(d => (
            <li key={d.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span><button type="button" title="Search this author" onClick={() => { setQ(d.authorEmail); setFilter({ q: d.authorEmail }) }} className="font-bold text-slate-800 hover:underline dark:text-slate-200">{d.authorEmail || 'unknown'}</button>{d.anonymous && ' (posted anonymously)'} · {d.category} · {ago(d.createdAt)}</span>
                <span className={d.status === 'hidden' ? 'font-semibold text-rose-600' : ''}>{d.status === 'hidden' ? 'Hidden · ' : ''}▲ {d.score} · 💬 {d.commentCount} · 👁 {d.views}</span>
              </div>
              <a href={`/discuss/${d.id}`} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">{d.title}</a>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{d.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {d.status === 'hidden'
                  ? <button type="button" onClick={() => act(d.id, 'show')} className={`${btn} text-emerald-700 dark:text-emerald-300`}>Restore</button>
                  : <button type="button" onClick={() => act(d.id, 'hide')} className={`${btn} text-amber-700 dark:text-amber-300`}>Hide</button>}
                <button type="button" onClick={() => window.confirm('Delete this post and its comments for good?') && act(d.id, 'delete')} className={`${btn} text-rose-600 dark:text-rose-400`}>Delete</button>
                {d.authorEmail && <button type="button" onClick={() => hideAuthor(d.authorEmail)} className={`${btn} text-amber-700 dark:text-amber-300`}>Hide all by author</button>}
                <button type="button" onClick={() => toggle(d.id)} className={btn}>{open === d.id ? 'Hide comments' : `Comments (${d.commentCount})`}</button>
              </div>
              {open === d.id && (
                <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  {cmts.length === 0 && <li className="text-xs text-slate-500">No comments.</li>}
                  {cmts.map(c => (
                    <li key={c.id} className="flex items-start gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-slate-500"><b className="text-slate-800 dark:text-slate-200">{c.authorEmail}</b>{c.anonymous && ' (anonymous)'}{c.parentId ? ' · reply' : ''} · {ago(c.createdAt)}{c.status === 'hidden' && <b className="ml-1 text-rose-600">· hidden</b>}</span>
                        <p className="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">{c.body}</p>
                      </div>
                      <button type="button" onClick={() => cact(c.id, c.status === 'hidden' ? 'show' : 'hide')} className={`${btn} shrink-0`}>{c.status === 'hidden' ? 'Restore' : 'Hide'}</button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-sm">
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className={`${btn} disabled:opacity-40`}>← Previous</button>
          <span className="text-slate-500">Page {(page + 1).toLocaleString('en-IN')} of {data.totalPages.toLocaleString('en-IN')}</span>
          <button type="button" disabled={page + 1 >= data.totalPages} onClick={() => setPage(p => p + 1)} className={`${btn} disabled:opacity-40`}>Next →</button>
        </div>
      )}
    </div>
  )
}
