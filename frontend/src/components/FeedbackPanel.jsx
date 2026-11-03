import { useEffect, useState } from 'react'
import Loader from './Loader.jsx'
import { QUESTIONS } from './FeedbackForm.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

const LABELS = Object.fromEntries(QUESTIONS.map(q => [q.key, Object.fromEntries(q.options.map(([v, l]) => [v, l]))]))

// How many responses picked each option, per question. Every option is listed (zero included), most picked first,
// so the full questionnaire is visible even before anyone has answered.
function Summary({ items }) {
  const withAnswers = items.filter(f => f.answers && Object.keys(f.answers).length)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {QUESTIONS.map(q => {
        const counts = {}
        withAnswers.forEach(f => (f.answers[q.key] || []).forEach(v => { counts[v] = (counts[v] || 0) + 1 }))
        const answered = withAnswers.filter(f => f.answers[q.key]?.length).length
        const rows = q.options.map(([v]) => [v, counts[v] || 0]).sort((a, b) => b[1] - a[1])
        return (
          <div key={q.key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{q.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{answered ? `${answered} response${answered === 1 ? '' : 's'}` : 'No answers yet'}</p>
            <ul className="mt-2 space-y-1.5">
              {rows.map(([v, n]) => (
                <li key={v} className={`text-xs ${n ? '' : 'opacity-50'}`}>
                  <div className="flex justify-between text-slate-700 dark:text-slate-300"><span>{LABELS[q.key][v] || v}</span><span className="tabular-nums">{n}{answered ? ` · ${Math.round((n * 100) / answered)}%` : ''}</span></div>
                  <div className="mt-0.5 h-1.5 rounded bg-slate-100 dark:bg-slate-800"><div className="h-full rounded bg-blue-500" style={{ width: `${answered ? (n * 100) / answered : 0}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–')

// Who sent a response: account, activity and the pages they opened last (to follow up or reproduce an issue).
function Sender({ id }) {
  const [s, setS] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch(`${API_BASE}/admin/feedback/${id}/sender`).then(r => (r.ok ? r.json() : Promise.reject(new Error('Could not load the sender.'))))
      .then(setS).catch(e => setError(e.message))
  }, [id])
  if (error) return <p className="mt-3 text-xs text-red-600">{error}</p>
  if (!s) return <p className="mt-3 text-xs text-slate-400">Loading sender…</p>
  if (!s.member) return <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">Sent without an account ({s.email}). {s.feedbackCount} response{s.feedbackCount === 1 ? '' : 's'} from this email.</p>
  const stat = (label, value) => (
    <div className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {s.name || s.username || s.email}
          {s.premium && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">★ Premium</span>}
        </p>
        <div className="flex gap-3 text-xs">
          {s.username && <a href={`/u/${s.username}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Public profile ↗</a>}
          <a href={`mailto:${s.email}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">Email</a>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {s.email}{s.location ? ` · ${s.location}` : ''} · joined {when(s.joined)} · last sign-in {when(s.lastLogin)} · {s.feedbackCount} response{s.feedbackCount === 1 ? '' : 's'} sent
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat('Questions read', `${s.questionsRead} of ${s.questionsVisited} opened`)}
        {stat('Coding solved', s.codingSolved)}
        {stat('Streak', `${s.streak} day${s.streak === 1 ? '' : 's'} · best ${s.bestStreak}`)}
        {stat('Points', `${Number(s.totalPoints).toLocaleString('en-IN')} · ${s.league || 'Unranked'}`)}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">Recent pages</p>
        {s.recentPages.length === 0 ? <p className="text-xs text-slate-500">No signed-in page views recorded.</p> : (
          <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs">
            {s.recentPages.map((v, i) => (
              <li key={i} className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                <a href={v.path} target="_blank" rel="noopener noreferrer" className="truncate hover:text-blue-600 hover:underline">{v.path}</a>
                <span className="shrink-0 text-slate-400">{v.device ? `${v.device} · ` : ''}{when(v.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Headline numbers for the feedback dashboard.
function Headline({ items }) {
  const rated = items.filter(f => f.rating)
  const avg = rated.length ? (rated.reduce((n, f) => n + f.rating, 0) / rated.length).toFixed(1) : '–'
  const answered = items.filter(f => f.answers && Object.keys(f.answers).length).length
  const members = items.filter(f => f.fromAccount).length
  const issues = items.filter(f => (f.answers?.issues || []).some(v => v !== 'none')).length
  const cards = [
    ['Responses', items.length, ''],
    ['Average rating', avg, rated.length ? `from ${rated.length} rating${rated.length === 1 ? '' : 's'}` : 'no ratings yet'],
    ['Answered the questions', answered, items.length ? `${Math.round((answered * 100) / items.length)}% of responses` : ''],
    ['Reported an issue', issues, `${members} from members · ${items.length - members} visitors`],
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(([label, value, sub]) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
      ))}
    </div>
  )
}

// Admin, two tabs: "dashboard" (headline numbers and per-question answer counts) and "responses" (every
// response with its answers, rating, email, page and screenshots; click one to see who sent it).
export default function FeedbackPanel({ view = 'responses' }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)   // id of the response whose sender is shown

  const load = () => fetch(`${API_BASE}/admin/feedback`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load feedback.')))
    .then(setItems).catch(e => setError(e.message))
  useEffect(() => { load() }, [])

  const remove = async id => {
    if (!window.confirm('Delete this feedback?')) return
    const res = await fetch(`${API_BASE}/admin/feedback/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(items.filter(i => i.id !== id))
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!items) return <Loader compact label="Loading feedback…" />
  if (view === 'dashboard') {
    return (
      <div className="space-y-4">
        <Headline items={items} />
        <Summary items={items} />
      </div>
    )
  }
  if (!items.length) return <p className="text-sm text-slate-500">No feedback yet.</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{items.length} response{items.length > 1 ? 's' : ''}, newest first.</p>
      {items.map(f => (
        <div key={f.id} onClick={e => { if (!e.target.closest('a, button')) setOpen(o => (o === f.id ? null : f.id)) }}
          className={`cursor-pointer rounded-xl border bg-white p-4 transition-colors hover:border-blue-400 dark:bg-slate-900/40 ${open === f.id ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {f.rating ? <span className="mr-2 text-amber-500">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span> : null}
              {new Date(f.createdAt).toLocaleString()}{f.page ? ` · ${f.page}` : ''}{f.email ? ` · ` : ''}
              {f.email && <a href={`mailto:${f.email}`} className="text-blue-600 hover:underline dark:text-blue-400">{f.email}</a>}{f.fromAccount ? ' (account)' : ''}
            </span>
            <span className="flex items-center gap-3">
              <button type="button" onClick={() => setOpen(o => (o === f.id ? null : f.id))} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{open === f.id ? 'Hide sender' : 'Sender details'}</button>
              <button type="button" onClick={() => remove(f.id)} className="text-red-600 hover:underline">Delete</button>
            </span>
          </div>
          <dl className="mt-3 space-y-1.5 text-xs">
            {QUESTIONS.map((q, i) => {
              const picked = f.answers?.[q.key] || []
              return (
                <div key={q.key} className="flex flex-wrap items-center gap-1.5">
                  <dt className="mr-1 text-slate-500 dark:text-slate-400">{i + 1}. {q.title}</dt>
                  {picked.length
                    ? picked.map(v => <dd key={v} className="rounded-full bg-blue-600 px-2 py-0.5 font-medium text-white">{LABELS[q.key][v] || v}</dd>)
                    : <dd className="italic text-slate-400">Not answered</dd>}
                </div>
              )
            })}
          </dl>
          {f.message && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">{f.message}</p>}
          {open === f.id && <Sender id={f.id} />}
          {f.imageUrls?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {f.imageUrls.map(u => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="Screenshot" className="h-24 w-24 rounded-lg border border-slate-300 object-cover dark:border-slate-700" /></a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
