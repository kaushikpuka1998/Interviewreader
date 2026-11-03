import { useEffect, useState } from 'react'
import { buyPremium, fetchPremiumPlans, PREMIUM_PLAN_NAMES } from '../lib/billing.js'
import { validateCoupon } from '../lib/promo.js'
import { getUser } from '../lib/auth.js'

const rupees = n => `₹${Number(n).toLocaleString('en-IN')}`

const PREMIUM_FEATURES = [
  'Personalized roadmaps for every company',
  'Company-tagged DSA problems for every pattern, with shuffle',
  'Direct links to system design & LLD answers',
  'Behavioral question bank mapped to company values',
  'Cheat sheets, progress tracking & readiness score',
  '6 mock interviews a month with real interviewers',
]
const PLAN_EXTRAS = {
  monthly: { access: '1 month access', extra: [] },
  yearly: { access: '1 year access', badge: 'Most Popular', extra: ['New roadmaps as they are added'] },
  lifetime: { access: 'Forever access', badge: 'Best Value', extra: ['New roadmaps as they are added', 'All future Premium content included'] },
}

// Premium pass picker: three cards, yearly highlighted. Prices come from the server; every pass is a one-time payment.
// Used from the top bar's Premium button and the roadmap upsell; onBought runs once the payment is verified.
export default function PremiumPlans({ onClose, onBought }) {
  const [plans, setPlans] = useState([])
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  // "Have a coupon?": checked against each pass on the server; valid passes show the new price, and the code goes with the order.
  // Prefilled from ?coupon=CODE or from the code copied off the offer banner.
  const [code, setCode] = useState(() => { try { return (new URLSearchParams(location.search).get('coupon') || localStorage.getItem('ir_coupon') || '').toUpperCase() } catch { return '' } })
  const [applied, setApplied] = useState(null)   // { code, quotes: { monthly: {...}, ... }, message }
  const [checking, setChecking] = useState(false)
  const applyCoupon = async () => {
    const c = code.trim().toUpperCase()
    if (!c) return setApplied(null)
    setChecking(true); setError('')
    try {
      const keys = plans.map(p => p.key)
      const res = await Promise.all(keys.map(k => validateCoupon(k, c).catch(e => ({ valid: false, message: e.message }))))
      const quotes = Object.fromEntries(keys.map((k, i) => [k, res[i]]))
      const any = res.some(r => r.valid)
      setApplied({ code: c, quotes, any, message: any ? `${c} applied.` : (res[0]?.message || "That code isn't valid.") })
    } finally { setChecking(false) }
  }
  useEffect(() => { fetchPremiumPlans().then(setPlans).catch(e => setError(e.message)) }, [])
  const onBuy = async plan => {
    setError('')
    setPaying(plan)
    try {
      await buyPremium(plan, applied?.quotes?.[plan]?.valid ? applied.code : undefined)
      const u = getUser()
      if (u) localStorage.setItem('ir_user', JSON.stringify({ ...u, premium: true }))
      await onBought?.()
    } catch (e) {
      if (e.message !== 'Payment cancelled.') setError(e.message)
    } finally {
      setPaying(false)
    }
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="premium-plans-title" onClick={onClose}
      className="premium-fade fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm">
      <div onClick={e => e.stopPropagation()} className="relative mx-auto my-8 max-w-5xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8 dark:bg-slate-900">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-lg p-1.5 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">×</button>
        <h2 id="premium-plans-title" className="text-2xl font-bold text-slate-900 dark:text-white">Choose your Premium pass</h2>
        <p className="mt-1 text-sm"><a href="/premium" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Compare Free vs Premium, or try it free for 3 days →</a></p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">One-time payment, no auto-renewal. Buying again adds time on top of what you have left.</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <label htmlFor="premium-coupon" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Have a coupon?</label>
          <input id="premium-coupon" value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && applyCoupon()}
            placeholder="ENTER CODE" maxLength={24} autoComplete="off"
            className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm uppercase tracking-wider text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <button type="button" onClick={applyCoupon} disabled={checking || !code.trim()}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900">{checking ? 'Checking…' : 'Apply'}</button>
          {applied && <span className={`text-sm font-medium ${applied.any ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{applied.any ? '✓ ' : ''}{applied.message}</span>}
        </div>
        <div className="mt-10 grid items-center gap-6 md:grid-cols-3">
          {plans.map(p => {
            const meta = PLAN_EXTRAS[p.key] || { extra: [] }
            const popular = p.key === 'yearly'
            const full = p.regular > p.price ? p.regular : null   // regular price, crossed out
            const off = full ? Math.round((1 - p.price / full) * 100) : null
            const couponQ = applied?.quotes?.[p.key]
            return (
              <div key={p.key} className={`relative rounded-2xl border p-6 ${popular
                ? 'border-2 border-pink-500 bg-gradient-to-b from-pink-50 to-white shadow-xl shadow-pink-500/10 md:py-9 dark:from-pink-950/30 dark:to-slate-900'
                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                {meta.badge && (
                  <span className={`absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-bold ${popular
                    ? 'bg-gradient-to-r from-amber-500 to-pink-600 text-white'
                    : 'border border-amber-400 bg-white text-amber-600 dark:bg-slate-900 dark:text-amber-400'}`}>{meta.badge}</span>
                )}
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{PREMIUM_PLAN_NAMES[p.key]}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{meta.access}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{rupees(couponQ?.valid ? couponQ.finalPrice : p.price)}</span>
                  {couponQ?.valid ? <span className="text-base text-slate-400 line-through">{rupees(p.price)}</span> : full && <span className="text-base text-slate-400 line-through">{rupees(full)}</span>}
                  {couponQ?.valid ? <span className="ml-auto text-xs font-bold text-emerald-600 dark:text-emerald-400">Save {rupees(couponQ.discount)}</span> : off && <span className="ml-auto text-xs font-bold text-emerald-600 dark:text-emerald-400">{off}% OFF</span>}
                </div>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  {[...PREMIUM_FEATURES, ...meta.extra, 'One-time payment (no auto-renewal)'].map(f => (
                    <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
                  ))}
                </ul>
                <button type="button" onClick={() => onBuy(p.key)} disabled={!!paying}
                  className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-60 ${popular || p.key === 'lifetime'
                    ? 'bg-gradient-to-r from-amber-500 to-pink-600 text-white shadow-md hover:opacity-95'
                    : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'}`}>
                  {paying === p.key ? 'Opening payment…' : `Get ${PREMIUM_PLAN_NAMES[p.key]}`}
                </button>
              </div>
            )
          })}
        </div>
        {error && <p className="mt-4 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          System design practice is a separate plan — <a href="/interview/practice" className="font-semibold text-pink-600 hover:underline dark:text-pink-400">see practice plans</a>.
        </p>
      </div>
    </div>
  )
}
