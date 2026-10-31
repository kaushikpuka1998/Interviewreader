import { useState } from 'react'
import { giveFeedback } from '../lib/interviews.js'

const Stars = ({ n }) => <span className="text-amber-500" aria-label={`${n} out of 5`}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>

// What the candidate reads: the rating and the two notes the interviewer wrote.
export function FeedbackView({ feedback }) {
  if (!feedback) return null
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Feedback from your interviewer</h3>
        <Stars n={feedback.rating} />
      </div>
      {feedback.strengths && <><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">What went well</p><p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{feedback.strengths}</p></>}
      {feedback.improve && <><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">What to improve</p><p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{feedback.improve}</p></>}
    </div>
  )
}

// What the interviewer fills in. It can be saved again to change it, and the candidate sees the latest version.
export function FeedbackEditor({ id, existing, onSaved }) {
  const [rating, setRating] = useState(existing?.rating || 0)
  const [strengths, setStrengths] = useState(existing?.strengths || '')
  const [improve, setImprove] = useState(existing?.improve || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const box = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try { await giveFeedback(id, rating, strengths, improve); setMsg({ ok: true, text: 'Feedback sent to the candidate.' }); onSaved?.() } catch (err) { setMsg({ ok: false, text: err.message }) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-950">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Feedback for the candidate</h3>
      <div className="flex items-center gap-1" role="group" aria-label="Overall rating">
        {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" onClick={() => setRating(n)} aria-pressed={n <= rating} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={`text-3xl leading-none ${n <= rating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>★</button>)}
        <span className="ml-2 text-xs text-slate-500">Overall</span>
      </div>
      <textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={3} maxLength={3000} placeholder="What went well" className={box} />
      <textarea value={improve} onChange={e => setImprove(e.target.value)} rows={3} maxLength={3000} placeholder="What to improve" className={box} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !rating} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{existing ? 'Update feedback' : 'Send feedback'}</button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</span>}
      </div>
    </form>
  )
}
