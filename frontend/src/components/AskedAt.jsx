import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchQuestionCompanies, searchCompanies, reportCompany, isLoggedIn } from '../lib/auth.js'

/**
 * "Was this asked in your interview?" — collects which companies ask a question.
 *
 * The company field is a typeahead over rows already in the database, so repeated
 * companies reuse one record; anything not on the list is created from what the
 * user types.
 */
export default function AskedAt({ questionId }) {
  const [companies, setCompanies] = useState([])
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const boxRef = useRef(null)

  const authed = isLoggedIn()

  // Load existing reports whenever the question changes.
  useEffect(() => {
    let cancelled = false
    setOpen(false); setValue(''); setError('')
    fetchQuestionCompanies(questionId).then(c => { if (!cancelled) setCompanies(c) })
    return () => { cancelled = true }
  }, [questionId])

  // Debounced typeahead against the existing companies.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      searchCompanies(value).then(setSuggestions).catch(() => setSuggestions([]))
    }, 180)
    return () => clearTimeout(t)
  }, [value, open])

  // Close the picker when clicking elsewhere.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const submit = useCallback(async (name) => {
    const company = (name ?? value).trim()
    if (!company) return
    setBusy(true); setError('')
    try {
      setCompanies(await reportCompany(questionId, company))
      setValue(''); setOpen(false)
    } catch (e) {
      setError(e.message)
    } finally { setBusy(false) }
  }, [questionId, value])

  // Nothing reported and nobody signed in to report it — stay out of the way.
  if (!authed && companies.length === 0) return null

  const exactExists = suggestions.some(s => s.toLowerCase() === value.trim().toLowerCase())

  return (
    <div className="asked-at mt-2 border-t border-slate-200 pt-2 sm:mt-4 sm:pt-3 dark:border-slate-800">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Asked at
        </span>

        {companies.length === 0 && (
          <span className="hidden sm:inline text-sm text-slate-400">Not reported yet</span>
        )}

        {companies.map((c, i) => (
          <span
            key={c.company}
            title={`${c.reports} ${c.reports === 1 ? 'person' : 'people'} reported this`}
            style={{ animationDelay: `${i * 60}ms` }}
            className="company-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          >
            {c.company}
            {c.reports > 1 && (
              <span className="tabular-nums opacity-70">{c.reports}</span>
            )}
          </span>
        ))}

        {authed && !open && (
          <button
            onClick={() => { setOpen(true); setError('') }}
            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            + <span className="hidden sm:inline">Was this asked to you?</span><span className="sm:hidden">Asked to you?</span>
          </button>
        )}
      </div>

      {authed && open && (
        <div ref={boxRef} className="relative mt-2 max-w-sm">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit() }
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="Which company asked it?"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {(suggestions.length > 0 || value.trim()) && (
            <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1">
              {suggestions.map(s => (
                <li key={s}>
                  <button
                    onClick={() => submit(s)}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {s}
                  </button>
                </li>
              ))}
              {/* Not in the list yet — offer to create it from what was typed */}
              {value.trim() && !exactExists && (
                <li className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                  <button
                    onClick={() => submit()}
                    disabled={busy}
                    className="w-full text-left px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60"
                  >
                    {busy ? 'Saving…' : <>Add “<span className="font-semibold">{value.trim()}</span>”</>}
                  </button>
                </li>
              )}
            </ul>
          )}

          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
