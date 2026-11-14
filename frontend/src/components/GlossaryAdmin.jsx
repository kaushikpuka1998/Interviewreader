import { useEffect, useState } from 'react'
import Loader from './Loader.jsx'
import { fetchGlossary, saveGlossaryTerm, deleteGlossaryTerm, applyGlossary } from '../lib/glossary.js'

const EMPTY = { term: '', definition: '', example: '' }
const field = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100'

// Admin tab: words that show a hover definition inside answers. Saved terms override the built-in ones.
export default function GlossaryAdmin() {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => { fetchGlossary({ fresh: true }).then(r => { applyGlossary(r); setRows(r) }) }, [])

  const run = async (fn, ok) => {
    setBusy(true); setMsg('')
    try { setRows(await fn()); setMsg(ok); return true } catch (e) { setMsg(e.message); return false } finally { setBusy(false) }
  }
  const save = async (e) => {
    e.preventDefault()
    if (await run(() => saveGlossaryTerm(form), `Saved “${form.term.trim().toLowerCase()}”. Readers see it within a minute.`)) setForm(EMPTY)
  }
  const remove = (r) => confirm(`Delete “${r.term}”?`) && run(() => deleteGlossaryTerm(r.id), `Deleted “${r.term}”.`)

  if (!rows) return <Loader compact label="Loading glossary…" />
  const shown = rows.filter(r => !q || r.term.includes(q.toLowerCase()) || r.definition.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{rows.some(r => r.term === form.term.trim().toLowerCase()) ? 'Edit term' : 'Add a term'}</h2>
        <input className={field} placeholder="Word or phrase, e.g. starvation" value={form.term} maxLength={80} required onChange={e => setForm({ ...form, term: e.target.value })} />
        <textarea className={field} rows={3} placeholder="Definition shown on hover" value={form.definition} maxLength={800} required onChange={e => setForm({ ...form, definition: e.target.value })} />
        <input className={field} placeholder="Optional example, e.g. A low-priority job never runs…" value={form.example} maxLength={400} onChange={e => setForm({ ...form, example: e.target.value })} />
        <div className="flex items-center gap-3">
          <button disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Save term</button>
          {form !== EMPTY && (form.term || form.definition) && <button type="button" onClick={() => setForm(EMPTY)} className="text-sm text-slate-500 hover:underline">Clear</button>}
          {msg && <span className="text-sm text-slate-600 dark:text-slate-300">{msg}</span>}
        </div>
        <p className="text-xs text-slate-500">Matches whole words in any case, plurals included. A saved term replaces the built-in definition for the same word.</p>
      </form>

      <div>
        <input className={`${field} mb-3`} placeholder={`Search ${rows.length} saved terms…`} value={q} onChange={e => setQ(e.target.value)} />
        {shown.length === 0 && <p className="text-sm text-slate-500">No saved terms yet. Add one above.</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700">
          {shown.map(r => (
            <li key={r.id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">{r.term}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{r.definition}</p>
                {r.example && <p className="mt-1 text-xs text-slate-500">{r.example}</p>}
              </div>
              <button onClick={() => { setForm({ term: r.term, definition: r.definition, example: r.example }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-sm text-blue-600 hover:underline">Edit</button>
              <button onClick={() => remove(r)} className="text-sm text-red-600 hover:underline">Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
