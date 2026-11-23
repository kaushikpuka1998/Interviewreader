const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#f43f5e']
const TAG = /^\s*<Chart\s+content=\{(\{[\s\S]*\})\}\s*\/>\s*$/

// Answers pasted from other tools contain `<Chart content={{...}} />`. Returns the parsed spec, or null.
export function parseChartTag(line) {
  const m = TAG.exec(line)
  if (!m) return null
  try {
    const c = JSON.parse(m[1])
    return Array.isArray(c.data) && Array.isArray(c.series) && c.xKey ? c : null
  } catch { return null }
}

// ponytail: every chartType renders as horizontal bars; add line/pie when an answer needs one.
export default function ChartBlock({ spec }) {
  const { meta = {}, xKey, series, data } = spec
  const max = Math.max(...data.flatMap(d => series.map(s => Number(d[s.dataKey]) || 0)), 0) || 1
  return (
    <figure className="my-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
      {meta.title && <figcaption className="font-semibold text-slate-900 dark:text-slate-100">{meta.title}</figcaption>}
      {meta.description && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>}
      <div className="space-y-3">
        {data.map((d, i) => (
          <div key={i}>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{String(d[xKey])}</div>
            {series.map((s, si) => {
              const v = Number(d[s.dataKey]) || 0
              return (
                <div key={s.dataKey} className="flex items-center gap-2">
                  <div className="h-4 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                    <div className="h-4 rounded" style={{ width: `${Math.max((v / max) * 100, 0.5)}%`, background: COLORS[si % COLORS.length] }} />
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                    {v}{s.valueSuffix ? ` ${s.valueSuffix}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </figure>
  )
}
