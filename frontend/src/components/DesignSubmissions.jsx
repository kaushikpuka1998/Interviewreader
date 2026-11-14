import { useEffect, useState } from 'react'
import { fetchDesignSubmissions } from '../lib/designPractice.js'

const rps = n => n >= 1e9 ? `${n / 1e9}B` : n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}K` : String(n)

/** System design submissions per question (solved = every simulator check passed), mirroring the coding "solved" list. */
export default function DesignSubmissions({ refreshKey, className = '' }) {
  const [data, setData] = useState(null)
  useEffect(() => { fetchDesignSubmissions().then(setData).catch(() => setData({ items: [], solved: 0, submitted: 0 })) }, [refreshKey])
  if (!data) return null
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">System design submitted</h2>
        <span className="text-xs tabular-nums text-slate-500"><b className="text-emerald-600 dark:text-emerald-400">{data.solved}</b> solved · {data.submitted} submitted</span>
      </div>
      {!data.items.length ? <p className="text-sm text-slate-500">Submit an architecture on the canvas and it will be listed here.</p> : (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {data.items.map(i => (
            <li key={i.questionId}>
              <a href={`/interview/practice?q=${encodeURIComponent(i.questionId)}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800 dark:text-slate-200">{i.title}</span>
                  <span className="text-xs text-slate-500">{i.submissions} submission{i.submissions > 1 ? 's' : ''}{i.solved ? ` · passed up to ${rps(i.bestTargetRps)} RPS` : ''} · {new Date(i.lastAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${i.solved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{i.solved ? '✓ Solved' : 'In progress'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
