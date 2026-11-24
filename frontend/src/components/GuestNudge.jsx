import { useEffect, useState } from 'react'

const SEEN = 'ir_guest_seen'          // ids of questions this signed-out browser has opened
const SNOOZE = 'ir_guest_nudge_until'  // ms timestamp: dismissed, stay quiet until then
const DAY = 864e5
const MIN_VIEWS = 2                    // show the card after this many different questions

const load = () => { try { return JSON.parse(localStorage.getItem(SEEN)) || [] } catch { return [] } }
const snoozed = () => { try { return Date.now() < Number(localStorage.getItem(SNOOZE)) } catch { return false } }

// Signed-out readers get no prompt until they hit a locked topic, so most never sign up.
// After a couple of questions (or on exit intent) show one dismissible card selling what an account adds.
export default function GuestNudge({ questionId, signedIn, suppress, onSignup }) {
  const [count, setCount] = useState(() => load().length)
  const [open, setOpen] = useState(false)
  const off = signedIn || suppress

  useEffect(() => {
    if (off || !questionId) return
    const seen = load()
    if (seen.includes(questionId)) return
    try { localStorage.setItem(SEEN, JSON.stringify([...seen, questionId].slice(-50))) } catch { /* private mode: count stays in memory */ }
    setCount(n => n + 1)
  }, [questionId, off])

  useEffect(() => {
    if (off) { setOpen(false); return }
    if (count < MIN_VIEWS || snoozed()) return
    const t = setTimeout(() => { if (!document.querySelector('[role="dialog"]')) setOpen(true) }, 1500)
    return () => clearTimeout(t)
  }, [count, off])

  // Exit intent (desktop): the cursor leaves through the top of the window.
  useEffect(() => {
    if (off || count < 1 || snoozed()) return
    const leave = e => { if (e.clientY <= 0 && !e.relatedTarget && !snoozed()) setOpen(true) }
    document.addEventListener('mouseout', leave)
    return () => document.removeEventListener('mouseout', leave)
  }, [count, off])

  if (!open || off) return null
  const dismiss = () => { try { localStorage.setItem(SNOOZE, String(Date.now() + DAY)) } catch { /* shows again next visit */ } setOpen(false) }
  return (
    <aside role="complementary" aria-label="Create a free account"
      className="fixed bottom-16 left-4 right-4 z-40 rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl dark:border-blue-500/30 dark:bg-slate-900 sm:bottom-4 sm:left-auto sm:right-14 sm:w-[22rem]">
      <button type="button" onClick={dismiss} aria-label="Dismiss" data-track="guest_nudge_dismiss"
        className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
      <p className="pr-6 text-sm font-bold text-slate-900 dark:text-slate-100">
        {count >= 5 ? `You've read ${count} questions. Keep them.` : 'Get more from every question'}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
        <li>✅ Mark questions read and track your progress</li>
        <li>🔥 A new question and coding problem every day, with a streak</li>
        <li>⭐ Flag questions and pick up on any device</li>
      </ul>
      <button type="button" onClick={() => { setOpen(false); onSignup() }} data-track="guest_nudge_signup"
        className="mt-3 w-full rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 py-2 text-sm font-semibold text-white hover:opacity-95">
        Create free account
      </button>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">Free forever. No card required.</p>
    </aside>
  )
}
