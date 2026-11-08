const PERCENTILES = [
  ['p50', 'Median', '50% of requests finish at or below this time.'],
  ['p95', 'Tail latency', '95 of every 100 requests finish at or below this time.'],
  ['p99', 'Long tail', '99 of every 100 requests finish at or below this time.'],
  ['p99.5', 'Slowest 0.5%', '995 of every 1,000 requests finish at or below this time.'],
  ['p99.9', 'Slowest 0.1%', '999 of every 1,000 requests finish at or below this time.'],
]

export default function LatencyPercentileReference({ onClose }) {
  return <aside className="fixed right-5 top-24 z-40 hidden w-[21rem] max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-violet-300 bg-[#fbfaff]/95 p-4 shadow-2xl shadow-violet-950/15 backdrop-blur-xl xl:block dark:border-violet-400/25 dark:bg-slate-950/95" aria-label="Latency percentile reference">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-700 dark:text-violet-300">Latency guide</p>
        <h2 className="mt-1 text-sm font-extrabold text-slate-950 dark:text-white">Percentiles explained</h2>
      </div>
      <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-violet-100 hover:text-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-slate-400 dark:hover:bg-violet-400/15 dark:hover:text-violet-100" aria-label="Hide latency reference" title="Hide reference">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <p className="mt-2 rounded-lg bg-violet-100/80 px-2.5 py-2 text-[11px] leading-4 text-violet-950 dark:bg-violet-400/10 dark:text-violet-100">A percentile is the response time that a chosen percentage of requests meets or beats. Lower is better.</p>

    <div className="mt-3 overflow-hidden rounded-xl border border-violet-200/80 bg-white/80 dark:border-violet-400/15 dark:bg-slate-950/45">
      {PERCENTILES.map(([percentile, label, description]) => <div key={percentile} className="border-b border-violet-100/80 px-3 py-2.5 last:border-0 dark:border-white/[.06]">
        <div className="flex items-baseline justify-between gap-3"><b className="font-mono text-sm text-violet-800 dark:text-violet-200">{percentile}</b><span className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-500 dark:text-slate-400">{label}</span></div>
        <p className="mt-1 text-[11px] leading-4 text-slate-600 dark:text-slate-300">{description}</p>
      </div>)}
    </div>

    <p className="mt-3 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Example: p99 &lt; 300 ms means 99 of every 100 requests should complete within 300 ms; one request may still be slower.</p>
  </aside>
}
