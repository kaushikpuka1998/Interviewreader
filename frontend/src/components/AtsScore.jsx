import { useMemo, useState } from 'react'
import { atsScore, ROLES } from '../lib/atsScore.js'

const ROLE_KEY = 'ir_ats_role'
const band = s => (s >= 80 ? ['Strong', 'text-emerald-600 dark:text-emerald-400', 'bg-emerald-500'] : s >= 60 ? ['Good, can improve', 'text-amber-600 dark:text-amber-400', 'bg-amber-500'] : ['Needs work', 'text-red-600 dark:text-red-400', 'bg-red-500'])

// "Your resume is 72% ATS friendly": the score, what is missing, and what to fix first. Worked out live in the browser as the resume is edited.
export default function AtsScore({ data }) {
  const [role, setRole] = useState(() => { try { return localStorage.getItem(ROLE_KEY) || 'java-backend' } catch { return 'java-backend' } })
  const [jd, setJd] = useState('')
  const [open, setOpen] = useState(true)
  const r = useMemo(() => atsScore(data, { role, jd }), [data, role, jd])
  const [label, text, fill] = band(r.score)
  const pick = v => { setRole(v); try { localStorage.setItem(ROLE_KEY, v) } catch { /* private mode */ } }
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40" aria-label="ATS score">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={open}>
        <span>
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">ATS score</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">Your resume is <b className={text}>{r.score}% ATS friendly</b> · {label}</span>
        </span>
        <span className={`text-2xl font-extrabold tabular-nums ${text}`}>{r.score}%</span>
      </button>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${fill}`} style={{ width: `${r.score}%` }} /></div>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Target role
              <select value={role} onChange={e => pick(e.target.value)} disabled={jd.trim().length > 40}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <div className="text-xs text-slate-500 dark:text-slate-400 sm:pt-5">{r.usedJd ? 'Matching against the job description below.' : 'Or paste a job description below for an exact match.'}</div>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium text-emerald-700 dark:text-emerald-400">Paste a job description</summary>
            <textarea value={jd} onChange={e => setJd(e.target.value)} rows={5} placeholder="Paste the job posting here. Nothing leaves your browser."
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </details>

          <ul className="space-y-2">
            {r.rows.map(x => (
              <li key={x.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
                <span className="text-slate-700 dark:text-slate-300">{x.label}</span>
                <span className="tabular-nums text-slate-500">{x.points} / {x.max}</span>
                <div className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${x.points / x.max >= 0.7 ? 'bg-emerald-500' : x.points / x.max >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(x.points / x.max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>

          {r.missing.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Missing keywords ({r.missing.length})</p>
              <div className="flex flex-wrap gap-1.5">{r.missing.map(k => <span key={k} className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">{k}</span>)}</div>
              <p className="mt-1.5 text-[11px] text-slate-400">Add only the ones you really have used, in your skills or in a bullet that shows how.</p>
            </div>
          )}
          {r.matched.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Found ({r.matched.length})</p>
              <div className="flex flex-wrap gap-1.5">{r.matched.map(k => <span key={k} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">✓ {k}</span>)}</div>
            </div>
          )}
          {r.tips.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">{r.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        </div>
      )}
    </section>
  )
}
