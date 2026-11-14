import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const REASONS = [
  ['price', 'Too expensive'],
  ['free_enough', 'The free content is enough for now'],
  ['not_sure', 'Not sure it will help me'],
  ['missing', 'Missing something I need'],
  ['later', 'Maybe later, no interview yet'],
  ['other', 'Something else'],
]

// "Not ready to buy?" mini survey under the locked-answer card. Sent as normal feedback (page = paywall-survey),
// so it shows up in the admin Feedback tab with no new backend.
export default function PaywallSurvey({ questionId }) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState([])
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')   // '' | sending | sent | error text

  const toggle = (k) => setPicked(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])
  const send = async (e) => {
    e.preventDefault()
    if (!picked.length) { setStatus('Pick at least one reason.'); return }
    setStatus('sending')
    const labels = REASONS.filter(([k]) => picked.includes(k)).map(([, l]) => l).join('; ')
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Not buying Premium: ${labels}.${note.trim() ? ` Note: ${note.trim()}` : ''}`, page: `paywall-survey:${questionId}` }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not send.')
      setStatus('sent')
    } catch (err) { setStatus(err.message) }
  }

  if (status === 'sent') return <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">Thank you, this really helps us improve Premium.</p>
  if (!open) return <button onClick={() => setOpen(true)} className="mt-3 text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Not ready to buy? Tell us why</button>
  return (
    <form onSubmit={send} className="mt-4 rounded-xl border border-amber-300/70 bg-white/70 p-4 text-left dark:border-amber-500/30 dark:bg-slate-900/40">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">What is holding you back?</p>
      <div className="mt-2 space-y-1.5">
        {REASONS.map(([k, l]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={picked.includes(k)} onChange={() => toggle(k)} className="accent-amber-500" /> {l}
          </label>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Anything we should know? (optional)"
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
      <div className="mt-3 flex items-center gap-3">
        <button disabled={status === 'sending'} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">Send</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">Cancel</button>
        {status && status !== 'sending' && <span className="text-sm text-red-600">{status}</span>}
      </div>
    </form>
  )
}
