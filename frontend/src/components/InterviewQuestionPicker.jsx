import { useEffect, useState } from 'react'
import Markdown from './Markdown.jsx'
import { searchQuestionOptions, setInterviewQuestions, randomInterviewQuestions } from '../lib/interviews.js'

const MAX = 8

// Interviewer's question list for one interview: search and add, remove, reorder, or randomise.
// Used on the interviews page and inside the live room before the interview starts (the list is fixed after).
// `questions` is [{ ref, title, body }]; `onChanged` reloads whatever the parent shows.
export default function InterviewQuestionPicker({ id, type, questions, onChanged, autoFocus = false }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const refs = questions.map(q => q.ref).filter(Boolean)
  const design = type === 'SYSTEM_DESIGN'
  const randomCount = design ? 1 : 3

  const run = async fn => {
    setSaving(true); setError('')
    try { await fn(); await onChanged() } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  const save = next => run(() => setInterviewQuestions(id, next))
  const move = (i, step) => {
    const next = [...refs]
    ;[next[i], next[i + step]] = [next[i + step], next[i]]
    save(next)
  }

  // Search as the interviewer types (a short pause first, so each letter does not hit the server).
  useEffect(() => {
    const t = setTimeout(() => searchQuestionOptions(id, term).then(setResults).catch(() => setResults([])), term ? 300 : 0)
    return () => clearTimeout(t)
  }, [term, id])

  const iconBtn = 'rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white'
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Questions to ask <span className="font-normal text-slate-500">(only you see these)</span></h3>
        <button type="button" disabled={saving} onClick={() => run(() => randomInterviewQuestions(id))} className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400">
          🎲 Random {randomCount}
        </button>
      </div>

      {questions.length ? (
        <ol className="space-y-2">
          {questions.map((q, i) => (
            <li key={q.ref || i} className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80">
              <div className="flex items-start gap-2 p-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-[11px] font-bold text-blue-700 dark:text-blue-300">{i + 1}</span>
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100">{q.title}</summary>
                  {q.body && <div className="mt-2 text-sm text-slate-700 dark:text-slate-300"><Markdown text={q.body} /></div>}
                </details>
                {q.ref && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button type="button" className={iconBtn} disabled={saving || i === 0} onClick={() => move(i, -1)} aria-label={`Move question ${i + 1} up`}>↑</button>
                    <button type="button" className={iconBtn} disabled={saving || i === questions.length - 1} onClick={() => move(i, 1)} aria-label={`Move question ${i + 1} down`}>↓</button>
                    <button type="button" className={`${iconBtn} text-red-600 hover:text-red-700 dark:text-red-400`} disabled={saving} onClick={() => save(refs.filter(r => r !== q.ref))} aria-label={`Remove question ${i + 1}`}>✕</button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700">
          No questions yet. Search below or press Random {randomCount}.
        </p>
      )}

      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
        <input
          value={term} onChange={e => setTerm(e.target.value)} autoFocus={autoFocus}
          placeholder={type === 'CODING' ? 'Search by title or number (e.g. 1328 or #12)…' : design ? 'Search design questions, e.g. "rate limiter" or "parking lot"…' : 'Search by text or id…'}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {results.length > 0 && (
          <ul className="mt-2 max-h-56 divide-y divide-slate-200 overflow-auto rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
            {results.map(r => {
              const chosen = refs.includes(r.ref)
              return (
                <li key={r.ref} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="min-w-0 truncate text-slate-800 dark:text-slate-200">{r.title}</span>
                  <button type="button" disabled={chosen || saving || refs.length >= MAX} onClick={() => save([...refs, r.ref])}
                    className="shrink-0 text-xs font-semibold text-blue-600 hover:underline disabled:text-slate-400 dark:text-blue-400">{chosen ? 'Added' : 'Add'}</button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Up to {MAX} questions{design ? '; one design question usually fills the round' : ''}. They are fixed once you start the interview.
        </p>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  )
}
