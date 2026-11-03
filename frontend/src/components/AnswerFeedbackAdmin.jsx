import { useEffect, useState } from 'react'
import { fetchAnswerFeedback } from '../lib/engage.js'
import { slugify } from '../lib/slug.js'

// Admin: which answers readers found unhelpful, worst first, with what they said was missing.
export default function AnswerFeedbackAdmin() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { fetchAnswerFeedback().then(setD).catch(e => setError(e.message)) }, [])
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!d) return <p className="text-sm text-slate-500">Loading…</p>
  const total = d.helpful + d.notHelpful
  const notes = Object.groupBy ? Object.groupBy(d.notes, n => n.questionId) : d.notes.reduce((m, n) => ((m[n.questionId] ||= []).push(n), m), {})
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[['Votes', total], ['Helpful', total ? `${Math.round((d.helpful * 100) / total)}%` : '–'], ['Not helpful', d.notHelpful]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{l}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{v}</p>
          </div>
        ))}
      </div>
      {d.questions.length === 0 ? <p className="text-sm text-slate-500">No votes yet. They appear as readers answer "Was this answer helpful?".</p> : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/40">
          {d.questions.map(q => (
            <li key={q.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <a href={`/${slugify(q.title)}?id=${q.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline dark:text-slate-100">{q.title}</a>
                <span className="shrink-0 text-xs tabular-nums"><span className="text-emerald-600 dark:text-emerald-400">👍 {q.helpful}</span> · <span className="text-rose-600 dark:text-rose-400">👎 {q.notHelpful}</span></span>
              </div>
              {(notes[q.id] || []).slice(0, 4).map((n, i) => <p key={i} className="mt-1 border-l-2 border-slate-300 pl-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-400">“{n.note}”</p>)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
