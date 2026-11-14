import { useEffect, useState } from 'react'
import { isLoggedIn } from '../lib/auth.js'
import { fetchAbandonedCheckout, answerAbandonedCheckout, PREMIUM_PLAN_NAMES } from '../lib/billing.js'

const REASONS = [
  ['Too expensive', 'Too expensive'],
  ['Payment problem (card/UPI failed)', 'Payment failed or was confusing'],
  ['Not sure it will help me', 'Not sure it will help me'],
  ['Wanted a discount or coupon', 'Was hoping for a discount'],
  ['Maybe later', 'Maybe later, no interview yet'],
  ['Something else', 'Something else'],
]

// When a member comes back after opening checkout and not paying, ask once what stopped them. The answer lands in the
// admin Analytics > Payments list next to that checkout. Mounted once in main.jsx so it appears on every page.
export default function AbandonedCheckoutAsk() {
  const [attempt, setAttempt] = useState(null)
  const [picked, setPicked] = useState([])
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)

  // Checked on every page load and whenever the member returns to the tab, so it also catches a checkout abandoned in another tab.
  useEffect(() => {
    const check = () => { if (isLoggedIn()) fetchAbandonedCheckout().then(a => a?.id && setAttempt(a)).catch(() => {}) }
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])
  if (!attempt) return null

  const close = (reason = '') => { answerAbandonedCheckout(reason).catch(() => {}); reason ? setDone(true) : setAttempt(null) }
  const send = (e) => {
    e.preventDefault()
    if (!picked.length && !note.trim()) return
    close(`${picked.join('; ')}${note.trim() ? `${picked.length ? '. ' : ''}${note.trim()}` : ''}`)
    setTimeout(() => setAttempt(null), 2500)
  }
  const plan = PREMIUM_PLAN_NAMES[attempt.plan] || attempt.plan

  return (
    <div role="dialog" aria-label="Quick question about Premium" className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-amber-300/70 bg-white p-5 shadow-2xl dark:border-amber-500/30 dark:bg-slate-900">
      {done ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Thank you! This helps us make Premium better.</p> : (
        <form onSubmit={send}>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Welcome back! Quick question</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">You were checking out{plan ? ` the ${plan} pass` : ' Premium'}. What stopped you from completing it?</p>
          <div className="mt-3 space-y-1.5">
            {REASONS.map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" className="accent-amber-500" checked={picked.includes(value)} onChange={() => setPicked(p => p.includes(value) ? p.filter(x => x !== value) : [...p, value])} /> {label}
              </label>
            ))}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2} placeholder="Anything else? (optional)" className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <div className="mt-3 flex items-center gap-3">
            <button className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">Send</button>
            <button type="button" onClick={() => close()} className="text-sm text-slate-500 hover:underline">Not now</button>
          </div>
        </form>
      )}
    </div>
  )
}
