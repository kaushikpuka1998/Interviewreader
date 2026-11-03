import { useEffect, useState } from 'react'
import { fetchQotd } from '../lib/engage.js'
import { fetchFeatures } from '../lib/features.js'
import { isLoggedIn } from '../lib/auth.js'

export const DAILY_PROMO_KEY = 'ir_daily_promo_seen'

const QUIET = ['/question-of-the-day', '/streak', '/admin', '/practice', '/interview/live', '/reset-password']

// Mounted once for every page: after a few quiet seconds it shows the card, but only to a signed-in member who hasn't seen it,
// not on pages where it would get in the way, and not on top of another dialog (the login promos come first).
export function DailyPromoGate() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!isLoggedIn() || QUIET.some(p => location.pathname.startsWith(p))) return
    try { if (localStorage.getItem(DAILY_PROMO_KEY)) return } catch { return }
    let t
    const tryShow = n => {
      if (document.querySelector('[role="dialog"]') && n < 6) { t = setTimeout(() => tryShow(n + 1), 5000); return }
      fetchFeatures().then(f => { if (f.daily_promo !== false && !document.querySelector('[role="dialog"]')) setOpen(true) }).catch(() => {})
    }
    t = setTimeout(() => tryShow(0), 4000)
    return () => clearTimeout(t)
  }, [])
  return open ? <DailyPromo onClose={() => setOpen(false)} /> : null
}

// Launch card for the daily challenge, shown once per browser to a signed-in member: today's question and problem, one tap away.
export default function DailyPromo({ onClose }) {
  const [d, setD] = useState(null)
  useEffect(() => { fetchQotd().then(x => x.id && setD(x)).catch(() => {}) }, [])
  const close = () => { try { localStorage.setItem(DAILY_PROMO_KEY, '1') } catch { /* private mode: it may show again */ } onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Daily challenge">
      <style>{`
        @keyframes ir-card-in { from { opacity: 0; transform: translateY(16px) scale(0.97) } to { opacity: 1; transform: none } }
        @keyframes ir-flame { 0%,100% { transform: translateY(0) scale(1) rotate(-4deg) } 50% { transform: translateY(-6px) scale(1.15) rotate(4deg) } }
        @keyframes ir-sheen { from { transform: translateX(-120%) skewX(-20deg) } to { transform: translateX(220%) skewX(-20deg) } }
        @media (prefers-reduced-motion: reduce) { .ir-card, .ir-flame { animation: none !important } }
      `}</style>
      <div className="ir-card relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-7 text-center text-white shadow-2xl shadow-black/60" style={{ animation: 'ir-card-in 0.5s ease-out both' }}>
        <div className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{ animation: 'ir-sheen 1.6s ease-out 0.4s 1 both' }} aria-hidden="true" />
        <img src="/promo/daily-hero.jpg" alt="" width="1200" height="520" className="-mx-7 -mt-7 mb-5 block h-auto max-w-none" style={{ width: 'calc(100% + 3.5rem)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-300">New · Daily challenge</p>
        <h2 className="mt-2 bg-gradient-to-r from-white via-orange-100 to-amber-200 bg-clip-text text-2xl font-extrabold text-transparent">Two new things, every day</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">One question to read and one problem to solve. Do both, keep your streak and climb the leaderboard.</p>
        {d && (
          <ul className="mt-4 space-y-2 text-left text-sm">
            <li className="rounded-xl bg-blue-500/15 px-3 py-2">📖 <b>Read:</b> <span className="text-slate-100">{d.title}</span></li>
            {d.problem && <li className="rounded-xl bg-emerald-500/15 px-3 py-2">💻 <b>Solve:</b> <span className="text-slate-100">{d.problem.title}</span> <span className="text-xs text-slate-400">· {d.problem.difficulty}</span></li>}
          </ul>
        )}
        <a href="/question-of-the-day" onClick={close} data-track="daily_promo_open"
          className="group mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110">
          Take today's challenge <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </a>
        <button type="button" onClick={close} data-track="daily_promo_dismiss" className="mt-3 text-xs text-slate-400 transition hover:text-slate-200">Maybe later</button>
      </div>
    </div>
  )
}
