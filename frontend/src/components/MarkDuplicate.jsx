import { useState, useEffect } from 'react'
import { reportDuplicate, isLoggedIn } from '../lib/auth.js'

/**
 * Lets a reader flag a question as a duplicate of another. Goes to the admin
 * queue (DuplicatesPanel) — an admin decides whether to delete it.
 */
export default function MarkDuplicate({ question, compact = false }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { setOpen(false); setSent(''); setError(''); setNote('') }, [question.id])

  if (!isLoggedIn()) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const res = await reportDuplicate(question.id, note.trim() || undefined)
      setSent(res.message)
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  if (sent) {
    return (
      <div role="status" className="w-full mt-3 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        {sent}
      </div>
    )
  }

  if (!open) {
    return (
      <div className="flex">
        <button
          onClick={() => setOpen(true)}
          aria-label="Mark as duplicate"
          className={compact
            ? 'reader-action-tooltip inline-flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-500 transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-amber-900/20 dark:hover:text-amber-400'
            : 'inline-flex min-h-8 sm:min-h-10 items-center gap-1.5 text-xs font-semibold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors'}
          data-tip={compact ? 'Mark as duplicate' : undefined}
          title={compact ? undefined : 'Flag this as a duplicate of another question — an admin reviews it'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {!compact && <span className="hidden sm:inline">Mark as duplicate</span>}
        </button>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <form onSubmit={submit} className="w-full mt-3 space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">Which question does this duplicate? (optional, helps the admin find it)</p>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
        placeholder="e.g. same as Q42 in this same category" className={inputCls} autoFocus />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy}
          className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-60">
          {busy ? 'Sending…' : 'Report duplicate'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 text-xs text-slate-500 hover:underline">Cancel</button>
      </div>
    </form>
  )
}
