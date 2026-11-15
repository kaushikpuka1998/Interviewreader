import { useMemo } from 'react'
import { analyzeComplexity } from '../lib/complexity.js'

// Standard growth curves on one chart; the estimated one for the submitted code is highlighted.
const CURVES = [
  ['O(1)', () => 1], ['O(log n)', n => Math.log2(n)], ['O(n)', n => n], ['O(n log n)', n => n * Math.log2(n)],
  ['O(n² log n)', n => n * n * Math.log2(n)], ['O(n²)', n => n * n], ['O(n³)', n => n ** 3], ['O(2ⁿ)', n => 2 ** n],
]
const W = 320, H = 150, PAD = 8, NMAX = 10, YMAX = 100

function Chart({ active }) {
  const x = n => PAD + ((n - 1) / (NMAX - 1)) * (W - PAD * 2)
  const y = v => H - PAD - (Math.min(v, YMAX * 1.2) / YMAX) * (H - PAD * 2)
  const path = f => Array.from({ length: 91 }, (_, i) => { const n = 1 + i / 10; return `${i ? 'L' : 'M'}${x(n).toFixed(1)},${y(f(n)).toFixed(1)}` }).join('')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Growth curves with ${active} highlighted`} className="w-full">
      <defs><clipPath id="cx-clip"><rect x={PAD} y={PAD / 2} width={W - PAD * 2} height={H - PAD * 1.5} /></clipPath></defs>
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="stroke-slate-300 dark:stroke-slate-600" />
      <line x1={PAD} y1={PAD / 2} x2={PAD} y2={H - PAD} className="stroke-slate-300 dark:stroke-slate-600" />
      <g clipPath="url(#cx-clip)" fill="none">
        {CURVES.filter(([l]) => l !== active).map(([l, f]) => <path key={l} d={path(f)} strokeWidth="1.2" className="stroke-slate-300 dark:stroke-slate-600" />)}
        {CURVES.filter(([l]) => l === active).map(([l, f]) => <path key={l} d={path(f)} strokeWidth="3" strokeLinecap="round" className="stroke-emerald-500" />)}
      </g>
      <text x={W - PAD} y={H - 1} textAnchor="end" className="fill-slate-400 text-[8px]">input size n →</text>
      <text x={PAD + 3} y={PAD + 5} className="fill-slate-400 text-[8px]">work</text>
    </svg>
  )
}

// Shown under an accepted submission. It reads the code, it does not time it, so it says "estimated".
export default function ComplexityCard({ code, language, floating = false }) {
  const r = useMemo(() => analyzeComplexity(code, language), [code, language])
  if (!r) return null
  return (
    <section aria-label="Estimated complexity" className={`rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-500/30 dark:bg-slate-900 ${floating ? 'pr-9' : 'mt-3'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Estimated complexity</h3>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Time {r.time}</span>
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">Space {r.space}</span>
      </div>
      <div className="mt-2 grid gap-3">
        <Chart active={r.time} />
        <div className="text-sm">
          <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
            {(r.reasons.length ? r.reasons : ['No loops or recursion found: constant work']).map(t => <li key={t}>{t}</li>)}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Estimated from the structure of your code, not measured. The green curve is where your solution sits as the input grows; n is the input size.</p>
        </div>
      </div>
    </section>
  )
}
