import { useEffect, useState } from 'react'

// Admin: give a member Premium without payment, or take an admin grant back. Paid Premium can't be changed here.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const PLANS = [['monthly', '1 month'], ['yearly', '1 year'], ['lifetime', 'Lifetime']]
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}/admin/premium${path}`, {
    method, ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

const until = r => (r.lifetime ? 'Lifetime' : new Date(r.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))

export default function PremiumAdmin() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(null)   // id of the row being changed

  useEffect(() => {
    const t = setTimeout(() => call(`?q=${encodeURIComponent(q.trim())}`).then(setRows).catch(e => setMsg({ ok: false, text: e.message })), q ? 300 : 0)
    return () => clearTimeout(t)
  }, [q])

  const change = async (row, method, plan) => {
    if (method === 'DELETE' && !window.confirm(`Remove the Premium you gave ${row.email}?`)) return
    setBusy(row.id); setMsg(null)
    try {
      const updated = await call(`/${row.id}`, method, plan && { plan })
      setRows(rs => rs.map(r => (r.id === row.id ? updated : r)))
      setMsg({ ok: true, text: method === 'DELETE' ? `Premium removed for ${row.email}.` : `${row.email} has Premium until ${until(updated)}.` })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Give Premium</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Search a member by email, name or username. With an empty search, everyone on Premium right now is listed. Paid Premium can't be changed here; only Premium given by an admin can be removed.</p>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search members…" className={input} />
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</p>}
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {rows.length === 0 && <li className="p-4 text-sm text-slate-500">{q ? 'No members match.' : 'Nobody has Premium right now.'}</li>}
        {rows.map(r => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{r.name || r.username || r.email}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{r.email}</p>
              <p className="mt-0.5 text-xs">
                {r.premium
                  ? <span className="font-semibold text-amber-600 dark:text-amber-400">★ Premium until {until(r)} · {r.grantedBy ? `given by ${r.grantedBy}` : 'paid'}</span>
                  : <span className="text-slate-400">No Premium</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(!r.premium || r.grantedBy) && PLANS.map(([plan, label]) => (
                <button key={plan} type="button" disabled={busy === r.id || (r.lifetime && plan !== 'lifetime')} onClick={() => change(r, 'POST', plan)}
                  className="rounded-lg border border-amber-500/40 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40 dark:text-amber-300 dark:hover:bg-amber-900/20">
                  {r.premium ? `+ ${label}` : `Give ${label}`}
                </button>
              ))}
              {r.premium && r.grantedBy && (
                <button type="button" disabled={busy === r.id} onClick={() => change(r, 'DELETE')}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-900/20">Remove</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
