import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Markdown from './Markdown.jsx'
import { isLoggedIn } from '../lib/auth.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const LIMITS = [[2, '2 min'], [5, '5 min'], [10, '10 min']]
const mmss = s => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`

// "Practice this answer": answer the question from memory against a timer, then see a score out of 10, the key points you made, the ones you
// missed ("add idempotency") and the model answer. No AI model: it checks your answer against the key points of the model answer.
export default function AnswerPractice({ question, compact = false }) {
  const [open, setOpen] = useState(false)
  if (!question || question.locked) return null
  const btn = compact
    ? 'reader-action-tooltip inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300'
    : 'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors sm:min-h-11 sm:gap-2 sm:px-3 bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn} title={compact ? undefined : 'Answer this from memory, timed, and get a score'} data-tip={compact ? 'Practice answer' : undefined}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        {!compact && <span className="hidden sm:inline">Practice</span>}
      </button>
      {open && createPortal(<Dialog question={question} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function Dialog({ question, onClose }) {
  const [limit, setLimit] = useState(5)             // minutes
  const [left, setLeft] = useState(null)            // seconds left once started; null = not started
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [showModel, setShowModel] = useState(false)
  const started = useRef(0)
  const area = useRef(null)

  useEffect(() => {
    if (left === null || result) return
    const t = setInterval(() => setLeft(Math.max(-3600, Math.ceil(limit * 60 - (Date.now() - started.current) / 1000))), 500)
    return () => clearInterval(t)
  }, [left === null, result, limit])
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const start = () => { started.current = Date.now(); setLeft(limit * 60); setTimeout(() => area.current?.focus(), 50) }
  const reset = () => { setResult(null); setText(''); setLeft(null); setShowModel(false); setError('') }
  const submit = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/practice/answer/${encodeURIComponent(question.id)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: text, seconds: started.current ? Math.round((Date.now() - started.current) / 1000) : null }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error === 'premium_required' ? 'This answer is part of Premium.' : body.error === 'signup_required' ? 'Sign in to practise this topic.' : body.error || 'Could not check your answer.')
      setResult(body)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const overtime = left !== null && left < 0
  const tone = s => (s >= 8 ? 'text-emerald-600 dark:text-emerald-400' : s >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')
  const bar = s => (s >= 8 ? 'bg-emerald-500' : s >= 5 ? 'bg-amber-500' : 'bg-red-500')
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Practice this answer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Practice answer</p>
            <h2 className="mt-0.5 text-base font-bold leading-snug text-slate-900 sm:text-lg dark:text-slate-100">{question.question}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
        </div>

        {!isLoggedIn() ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Sign in to practise answering and get feedback.</p> : !result ? (
          <div className="mt-4 space-y-3">
            {left === null ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300">Time limit</span>
                {LIMITS.map(([m, l]) => <button key={m} onClick={() => setLimit(m)} className={`rounded-full px-3 py-1 text-sm font-medium ${limit === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{l}</button>)}
                <button onClick={start} className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Start timer</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className={`font-mono text-2xl font-bold tabular-nums ${overtime ? 'text-red-600' : left < 30 ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`} aria-live="off">{overtime ? '+' : ''}{mmss(left)}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{overtime ? 'Time is up. You can still finish.' : 'Answer as you would in the interview.'}</span>
              </div>
            )}
            <textarea ref={area} value={text} onChange={e => setText(e.target.value)} rows={9} placeholder="Type your answer here. Explain it, give an example and mention a trade-off."
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
              <button onClick={submit} disabled={busy || text.trim().length < 10} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Checking…' : 'Get feedback'}</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-baseline gap-2"><span className={`text-4xl font-extrabold tabular-nums ${tone(result.score)}`}>{result.score}</span><span className="text-slate-500">/ 10</span>
                {result.seconds != null && <span className="ml-auto text-xs text-slate-400">{mmss(result.seconds)} used</span>}</div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${bar(result.score)}`} style={{ width: `${result.score * 10}%` }} /></div>
            </div>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">{result.feedback.map((f, i) => <li key={i} className="flex gap-2"><span aria-hidden="true">{i === 0 ? '💬' : '➕'}</span><span>{f}</span></li>)}</ul>
            {result.basis === 'terms' && <p className="text-[11px] text-slate-400">This answer does not mark its key points, so the check uses the main terms from the model answer. Saying the same thing in other words is fine; compare with the model answer below.</p>}
            {result.points > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{result.basis === 'terms' ? 'Terms you used' : 'You covered'} ({result.covered.length})</p>
                  <div className="flex flex-wrap gap-1.5">{result.covered.length ? result.covered.map(c => <span key={c} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">✓ {c}</span>) : <span className="text-xs text-slate-400">Nothing yet</span>}</div></div>
                <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">{result.basis === 'terms' ? 'Terms to cover' : 'You missed'} ({result.missed.length})</p>
                  <div className="flex flex-wrap gap-1.5">{result.missed.length ? result.missed.map(c => <span key={c} className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">✗ {c}</span>) : <span className="text-xs text-slate-400">Nothing missed</span>}</div></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowModel(s => !s)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{showModel ? 'Hide' : 'Show'} model answer</button>
              <button onClick={reset} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Try again</button>
            </div>
            {showModel && <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 p-4 dark:border-slate-700"><Markdown text={result.modelAnswer || ''} /></div>}
          </div>
        )}
      </div>
    </div>
  )
}
