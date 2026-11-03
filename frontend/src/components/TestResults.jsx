import { useState } from 'react'
import TreeDiagram, { parseTreeInput } from './TreeDiagram.jsx'

// LeetCode-style result panel: a summary, a progress bar, a tab per test case, and the selected case's input and outputs.
// Confetti pieces for a full pass: spread left and right, with a little delay between them.
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  dx: ((i * 37) % 200) - 100,
  delay: (i * 45) % 300,
  color: ['#34d399', '#60a5fa', '#fbbf24', '#34d399', '#a78bfa'][i % 5],
}))

export default function TestResults({ data }) {
  const firstFailed = data.results.findIndex(r => !r.passed)
  const [active, setActive] = useState(firstFailed >= 0 ? firstFailed : 0)
  const allPassed = data.passed === data.total
  const pct = data.total ? Math.round((data.passed / data.total) * 100) : 0
  const current = data.results[active]
  const [open, setOpen] = useState(true)

  return (
    <div className="relative mt-4 space-y-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
      {allPassed && CONFETTI.map((c, i) => (
        <span key={i} aria-hidden="true" className="confetti-piece" style={{ background: c.color, '--dx': `${c.dx}px`, animationDelay: `${c.delay}ms` }} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Test results</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${allPassed ? 'result-pop' : 'result-shake'} ${allPassed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'}`}>
          {allPassed ? 'Accepted' : (data.verdict || 'Wrong answer')} · {data.passed}/{data.total}
        </span>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-label={open ? 'Collapse test results' : 'Expand test results'}
          data-tip={open ? 'Collapse' : 'Expand'}
          className="tip relative flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <svg className={`h-4 w-4 transition-transform duration-200 ${open ? '' : '-rotate-180'}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>

      {open && (
        <>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className={`bar-grow h-full rounded-full ${allPassed ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
        </div>

        <div className="flex flex-wrap gap-2">
          {data.results.map((r, i) => {
            const tone = r.passed
              ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-300'
            return (
              <button
                key={r.number}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${tone} ${i === active ? 'ring-2 ring-blue-500' : 'opacity-90 hover:opacity-100'}`}
              >
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${r.passed ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                Case {r.number}
              </button>
            )
          })}
        </div>

        {current && (
          <div className="space-y-3 text-sm">
            <p className={`font-semibold ${current.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {current.passed ? 'Passed' : 'Failed'}{current.status && current.status !== 'Accepted' ? ` · ${current.status}` : ''}
            </p>

            {current.hidden ? (
              <p className="rounded-lg bg-slate-100 p-3 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                This is a hidden test. Its input and expected output are not shown.
              </p>
            ) : (
              <>
                {current.treeInput && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Tree</p>
                    <TreeDiagram values={parseTreeInput(current.input)} />
                  </div>
                )}
                <div className="space-y-2">
                  {(current.input || '').split('\n').filter(line => line.trim() !== '').map((line, i) => (
                    <Field key={i} label={`Input ${i + 1}`} text={line} />
                  ))}
                </div>
                <Field label="Expected output" text={current.expected} />
                <Field label="Your output" text={current.actual} tone={current.passed ? 'ok' : 'bad'} />
                {!current.passed && (current.compileOutput || current.stderr) && (
                  <Field label={current.compileOutput ? 'Compile error' : 'Error'} text={current.compileOutput || current.stderr} tone="bad" />
                )}
              </>
            )}
          </div>
        )}
        </>
      )}
    </div>
  )
}

function Field({ label, text, tone }) {
  const color = tone === 'bad' ? 'text-rose-600 dark:text-rose-300' : tone === 'ok' ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <pre className={`overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-100 selection:bg-blue-500/30 selection:text-slate-900 dark:selection:text-slate-100 px-3 py-2 font-mono text-sm dark:bg-slate-800 ${color}`}>{text === '' || text == null ? '(empty)' : text}</pre>
    </div>
  )
}
