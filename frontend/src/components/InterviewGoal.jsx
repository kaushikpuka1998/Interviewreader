import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getUser, isLoggedIn, fetchGoal, saveGoal } from '../lib/auth.js'
import { trackFunnel } from '../lib/analytics.js'

const COMPANIES = ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Netflix', 'Uber', 'Flipkart', 'Atlassian', 'Adobe', 'Salesforce', 'Swiggy', 'Zomato', 'PhonePe', 'Razorpay']
const PLAN_KEY = 'ir_roadmap_custom_plan'
const askedKey = () => `ir_goal_asked:${(getUser()?.email || '').toLowerCase()}`
const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

// Keeps the roadmap's plan length in step with the interview date: the roadmap offers 4, 8 or 12 weeks.
function syncRoadmapWeeks(daysLeft) {
  if (daysLeft == null) return
  const weeks = daysLeft <= 35 ? 4 : daysLeft <= 70 ? 8 : 12
  try {
    const saved = JSON.parse(localStorage.getItem(PLAN_KEY) || '{}')
    localStorage.setItem(PLAN_KEY, JSON.stringify({ dailyHours: 2.5, targetDate: '', ...saved, targetWeeks: weeks }))
  } catch { /* the roadmap keeps its own default */ }
}

// Top-bar pill: "23 days · Google" counting down to the interview, or a nudge to set it. Asks once, a little after sign-in.
export default function GoalChip() {
  const [goal, setGoal] = useState(undefined)   // undefined = loading, null = unavailable
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!isLoggedIn()) return
    let dead = false
    fetchGoal().then(g => { if (!dead) setGoal(g) }).catch(() => { if (!dead) setGoal(null) })
    return () => { dead = true }
  }, [])
  // Ask once, when nothing else is on screen.
  useEffect(() => {
    if (!goal || goal.interviewDate || goal.company) return
    try { if (localStorage.getItem(askedKey())) return } catch { return }
    const t = setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return
      try { localStorage.setItem(askedKey(), '1') } catch { /* asks again next visit */ }
      setOpen(true)
    }, 12000)
    return () => clearTimeout(t)
  }, [goal])
  if (!isLoggedIn() || goal === undefined || goal === null) return null
  const has = goal.interviewDate || goal.company
  const label = goal.daysLeft != null
    ? (goal.daysLeft === 0 ? 'Interview today' : `${goal.daysLeft} day${goal.daysLeft === 1 ? '' : 's'}`) + (goal.company ? ` · ${goal.company}` : '')
    : goal.company || 'Set interview date'
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-track="goal-chip"
        title={has ? 'Your interview goal: click to change it' : 'Tell us when your interview is and we will plan your prep'}
        aria-label={has ? `Interview goal: ${label}` : 'Set your interview date'}
        className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold ring-1 transition-colors sm:px-3 ${has
          ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 hover:bg-emerald-500/20 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-600 ring-slate-300/60 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'}`}>
        <span aria-hidden="true">🎯</span>
        <span className="max-w-[10rem] truncate max-sm:hidden">{label}</span>
        {goal.daysLeft != null && <span className="sm:hidden">{goal.daysLeft}d</span>}
      </button>
      {open && <GoalDialog goal={goal} onClose={() => setOpen(false)} onSaved={g => { setGoal(g); setOpen(false) }} />}
    </>
  )
}

export function GoalDialog({ goal, onClose, onSaved }) {
  const [f, setF] = useState({ company: goal?.company || '', role: goal?.role || '', interviewDate: goal?.interviewDate || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const save = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const g = await saveGoal(f)
      if (g.interviewDate || g.company) trackFunnel('goal_set')
      syncRoadmapWeeks(g.daysLeft)
      onSaved(g)
    } catch (x) { setError(x.message); setBusy(false) }
  }
  // Rendered on <body>: the top bar has a blur filter, which would otherwise trap a fixed dialog inside the bar's own box.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="goal-title" onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={save} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 id="goal-title" className="text-lg font-bold text-slate-900 dark:text-white">What are you preparing for?</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">We'll count down to it, size your roadmap to the time you have, and remind you what to do next.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">Target company
          <input className={`${field} mt-1`} list="goal-companies" value={f.company} maxLength={60} placeholder="e.g. Google" onChange={e => setF(s => ({ ...s, company: e.target.value }))} />
        </label>
        <datalist id="goal-companies">{COMPANIES.map(c => <option key={c} value={c} />)}</datalist>
        <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300">Role
          <input className={`${field} mt-1`} value={f.role} maxLength={60} placeholder="e.g. SDE-2 backend" onChange={e => setF(s => ({ ...s, role: e.target.value }))} />
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300">Interview date
          <input type="date" className={`${field} mt-1`} min={today} value={f.interviewDate} onChange={e => setF(s => ({ ...s, interviewDate: e.target.value }))} />
        </label>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">An interview in the next 60 days also unlocks the cheaper 30-day Premium pass.</p>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <div className="mt-5 flex items-center gap-2">
          <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? 'Saving…' : 'Save my goal'}</button>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Not now</button>
        </div>
      </form>
    </div>,
    document.body
  )
}
