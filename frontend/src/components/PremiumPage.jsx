import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import PremiumPlans from './PremiumPlans.jsx'
import AuthModal from './AuthModal.jsx'
import { fetchTrial, startTrial } from '../lib/engage.js'
import { getUser, isLoggedIn } from '../lib/auth.js'
import { setPageSeo } from '../lib/seo.js'

// [what you get, free, premium]. true = included, text = what the plan gives, false = not included.
const ROWS = [
  ['Interview questions with answers, in every topic', true, true],
  ['Coding problems and the online editor', true, true],
  ['Streaks, points, leaderboard, Listen, revision and comments', true, true],
  ['Resume builder', true, true],
  ['Company roadmaps', 'Topic outlines', 'Full roadmap for every company'],
  ['Company-tagged DSA problems for every pattern, with shuffle', false, true],
  ['Direct links to system design and LLD answers per company', false, true],
  ['Scored system-design practice', '3 free questions', 'Continue with Premium'],
  ['HLD architecture simulator (3 free runs, then unlimited)', '3 simulations', 'Unlimited simulations'],
  ['Behavioral question bank mapped to company values', false, true],
  ['Cheat sheets, progress tracking and readiness score', false, true],
  ['New roadmaps as they are added (yearly and lifetime)', false, true],
]

const cell = v => (v === true ? <span className="text-emerald-600 dark:text-emerald-400" aria-label="Included">✓</span>
  : v === false ? <span className="text-slate-300 dark:text-slate-600" aria-label="Not included">–</span> : <span className="text-slate-700 dark:text-slate-300">{v}</span>)

// At /premium it is the Free vs Premium comparison. At /pricing (autoOpen) the same page opens the "Choose your Premium pass" screen straight away,
// after sign-in if needed, so offers and emails can link to one address: /pricing, or /pricing?coupon=CODE to pre-fill a coupon.
export default function PremiumPage({ autoOpen = false }) {
  const [plans, setPlans] = useState(autoOpen && isLoggedIn())
  const [auth, setAuth] = useState(autoOpen && !isLoggedIn())
  const [trial, setTrial] = useState(null)   // null | { available, days, used }
  const [msg, setMsg] = useState('')
  const user = getUser()
  useEffect(() => { setPageSeo({ title: 'Free vs Premium | Interview Reader', description: 'What you get free on Interview Reader and what Premium adds: full company roadmaps, company-tagged DSA problems, system design links and more. Try Premium free for 3 days.', path: '/premium' }) }, [])
  useEffect(() => { if (isLoggedIn()) fetchTrial().then(setTrial).catch(() => {}) }, [])
  const start = async () => {
    setMsg('')
    try { await startTrial(); window.location.href = '/roadmaps?trial=1' } catch (e) { setMsg(e.message) }
  }
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Free vs Premium</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Try scored system-design practice with 3 questions free. Premium unlocks continued practice, unlimited HLD simulations, and company-specific preparation.</p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr><th className="px-4 py-3 font-semibold">What you get</th><th className="w-28 px-3 py-3 text-center font-semibold">Free</th><th className="w-36 px-3 py-3 text-center font-semibold text-amber-600 dark:text-amber-400">★ Premium</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([label, free, prem]) => (
                <tr key={label} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{label}</td>
                  <td className="px-3 py-3 text-center">{cell(free)}</td>
                  <td className="px-3 py-3 text-center">{cell(prem)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
          {user?.premium ? (
            <p className="font-semibold text-amber-800 dark:text-amber-200">★ You have Premium. <a href="/roadmaps" className="underline">Open your roadmaps →</a></p>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{trial?.available || !isLoggedIn() ? `Try Premium free for ${trial?.days || 3} days` : 'Get Premium'}</h2>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{trial?.used ? 'You have used your free trial. Pick a pass to continue.' : 'No payment details needed. Full roadmaps unlock immediately; you decide afterwards.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(trial?.available || !isLoggedIn()) && (
                  <button type="button" onClick={() => (isLoggedIn() ? start() : setAuth(true))} className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-amber-950 hover:bg-amber-400">
                    {isLoggedIn() ? `Start my ${trial?.days || 3}-day free trial` : 'Sign up to start the free trial'}
                  </button>
                )}
                <button type="button" onClick={() => (isLoggedIn() ? setPlans(true) : setAuth(true))} className="rounded-lg border border-amber-500/60 px-5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/10">See plans and prices</button>
              </div>
              {msg && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{msg}</p>}
            </>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Or invite a friend from your profile: you both get 7 days of Premium.</p>
        </div>
      </main>
      <Footer />
      {plans && <PremiumPlans onClose={() => setPlans(false)} onBought={() => window.location.reload()} />}
      {auth && <AuthModal onClose={() => setAuth(false)} onSuccess={() => window.location.reload()} />}
    </div>
  )
}
