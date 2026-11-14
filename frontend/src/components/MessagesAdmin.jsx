import { useEffect, useState } from 'react'
import Loader from './Loader.jsx'
import { adminMessages, sendMemberMessage, closeMemberMessage } from '../lib/memberMessages.js'

const field = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100'
const EMPTY = { email: '', title: '', body: '', coupon: false, percent: 20, days: 14 }

// Admin tab: send an in-app message (optionally with a personal coupon) to one member, close it when done.
export default function MessagesAdmin() {
  const [rows, setRows] = useState(null)
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { adminMessages().then(setRows).catch(e => { setRows([]); setMsg(e.message) }) }, [])
  const run = async (fn, ok) => {
    setBusy(true); setMsg('')
    try { setRows(await fn()); setMsg(ok); return true } catch (e) { setMsg(e.message); return false } finally { setBusy(false) }
  }
  const send = async (e) => {
    e.preventDefault()
    const body = { email: f.email, title: f.title, body: f.body, coupon: f.coupon ? { percent: Number(f.percent), days: Number(f.days) } : null }
    if (await run(() => sendMemberMessage(body), `Sent to ${f.email}. They see it at their next page load.`)) setF(EMPTY)
  }

  if (!rows) return <Loader compact label="Loading messages…" />
  return (
    <div className="space-y-5">
      <form onSubmit={send} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Message a member</h2>
        <input className={field} type="email" required placeholder="Member's email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <input className={field} required maxLength={120} placeholder="Title, e.g. A little something for you" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        <textarea className={field} required rows={3} maxLength={1000} placeholder="Message" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" className="accent-emerald-600" checked={f.coupon} onChange={e => setF({ ...f, coupon: e.target.checked })} /> Include a personal coupon (works only for this member, one use)
        </label>
        {f.coupon && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2">Discount <input className={`${field} w-20`} type="number" min={1} max={90} value={f.percent} onChange={e => setF({ ...f, percent: e.target.value })} /> %</label>
            <label className="flex items-center gap-2">Valid for <input className={`${field} w-20`} type="number" min={1} max={365} value={f.days} onChange={e => setF({ ...f, days: e.target.value })} /> days</label>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Send message</button>
          {msg && <span className="text-sm text-slate-600 dark:text-slate-300">{msg}</span>}
        </div>
        <p className="text-xs text-slate-500">Use {'{name}'} in the title or message for their first name; a title of just "Hello" gets the name added automatically. Shown as a floating card on every page after they sign in. If they close it with ✕ it returns at their next login, until you close it here.</p>
      </form>

      {rows.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {rows.map(r => (
            <li key={r.id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{r.title} <span className="font-normal text-slate-500">→ {r.email}</span></p>
                <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{r.body}</p>
                {r.couponCode && <p className="mt-1 font-mono text-xs text-emerald-700 dark:text-emerald-400">{r.couponCode} · {r.couponLabel}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.closed ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>{r.closed ? 'Closed' : 'Showing'}</span>
              {!r.closed && <button disabled={busy} onClick={() => run(() => closeMemberMessage(r.id), 'Closed. It disappears for them.')} className="text-sm text-red-600 hover:underline">Close</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
