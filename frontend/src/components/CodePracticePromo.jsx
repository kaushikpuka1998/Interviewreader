import { useMemo } from 'react'

const ORB_COLORS = ['rgba(96,165,250,0.45)', 'rgba(167,139,250,0.4)', 'rgba(52,211,153,0.3)', 'rgba(251,191,36,0.3)']

// Shown after login: announces code practice. Same look as the resume builder card.
export default function CodePracticePromo({ onClose }) {
  const orbs = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    id: i,
    left: 5 + ((i * 41) % 85),
    top: 10 + ((i * 29) % 75),
    size: 160 + ((i * 53) % 180),
    color: ORB_COLORS[i % ORB_COLORS.length],
    delay: -((i * 1.7) % 9),
    duration: 9 + ((i * 2) % 6),
  })), [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Code practice">
      <style>{`
        @keyframes ir-drift { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(var(--mx), var(--my)) scale(1.08) } }
        @keyframes ir-card-in { from { opacity: 0; transform: translateY(16px) scale(0.97) } to { opacity: 1; transform: none } }
        @keyframes ir-sheen { from { transform: translateX(-120%) skewX(-20deg) } to { transform: translateX(220%) skewX(-20deg) } }
        @keyframes ir-glow { 0%,100% { box-shadow: 0 10px 30px -10px rgba(16,185,129,0.5) } 50% { box-shadow: 0 10px 40px -4px rgba(249,115,22,0.8) } }
        @media (prefers-reduced-motion: reduce) { .ir-fx, .ir-card, .ir-cta { animation: none !important } }
      `}</style>

      {orbs.map(o => (
        <div
          key={o.id}
          className="ir-fx pointer-events-none absolute rounded-full blur-3xl"
          style={{
            left: `${o.left}%`, top: `${o.top}%`, width: o.size, height: o.size, background: o.color,
            '--mx': `${(o.id % 2 ? 40 : -40)}px`, '--my': `${(o.id % 3 ? -30 : 30)}px`,
            animation: `ir-drift ${o.duration}s ease-in-out ${o.delay}s infinite`,
          }}
          aria-hidden="true"
        />
      ))}

      <div
        className="ir-card relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-7 text-center text-white shadow-2xl shadow-black/60"
        style={{ animation: 'ir-card-in 0.5s ease-out both' }}
      >
        <div className="ir-fx pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{ animation: 'ir-sheen 1.6s ease-out 0.4s 1 both' }} aria-hidden="true" />

        <div className="relative mx-auto mb-5 w-full max-w-[260px] rounded-xl bg-slate-950 p-3 text-left font-mono text-[11px] leading-relaxed shadow-xl shadow-black/40 -rotate-2">
          <div className="mb-2 flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <p><span className="text-sky-300">int</span> <span className="text-slate-100">main() {'{'}</span></p>
          <p className="pl-4"><span className="text-slate-100">cout &lt;&lt; </span><span className="text-emerald-300">"Hello!"</span><span className="text-slate-100">;</span></p>
          <p className="pl-4"><span className="text-sky-300">return</span> <span className="text-amber-300">0</span>;</p>
          <p className="text-slate-100">{'}'}</p>
          <p className="mt-2 text-emerald-300">Accepted · 0.01s</p>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300">New · Code practice</p>
        <h2 className="mt-2 bg-gradient-to-r from-white via-indigo-100 to-blue-200 bg-clip-text text-2xl font-extrabold text-transparent">Practice coding in minutes</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">Write code in your browser, upload a file, and run it. Solve problems and check your answer against tests.</p>

        <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] font-medium">
          {['Run any program', 'Upload a file', 'Run tests'].map(t => (
            <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">{t}</span>
          ))}
        </div>

        <a
          href="/practice"
          onClick={onClose}
          data-track="code_practice_promo_open"
          className="ir-cta group mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          style={{ animation: 'ir-glow 2.8s ease-in-out infinite' }}
        >
          Open practice coding
          <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </a>
        <button type="button" onClick={onClose} data-track="code_practice_promo_dismiss" className="mt-3 text-xs text-slate-400 transition hover:text-slate-200">
          Maybe later
        </button>
      </div>
    </div>
  )
}
