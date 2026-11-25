import { inlineParts, parseCompBody } from '../lib/compPost.js'

// "**ASE** (SDE-1 / Entry, 1-2 years): ₹6.9 LPA": a pay level of a company post, shown as a row with the amount on the right.
const LEVEL = /^\*\*(.+?)\*\*(?: \((.+?)\))?: (₹.+)$/

const Inline = ({ s }) => inlineParts(s).map((p, i) => p.href
  ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-600 underline dark:text-emerald-400">{p.text}</a>
  : p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>)

// A compensation post (the template form or an import) as a clean card: facts, the pay breakdown with the total highlighted, then the member's own notes if any.
export default function CompBody({ body }) {
  const p = parseCompBody(body)
  if (!p) return <div className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">{body}</div>
  const isTotal = l => /^\*\*Total/.test(l)
  return (
    <div className="mt-5 space-y-4">
      <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700 sm:grid-cols-2">
        {p.facts.map(([k, v]) => (
          <div key={k}><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{k}</dt><dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{v}</dd></div>
        ))}
      </dl>
      {p.pay.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Compensation</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
            {p.pay.map((l, i) => {
              const m = l.match(LEVEL)
              return m ? (
                <li key={i} className="flex items-baseline justify-between gap-4 border-b border-emerald-200/60 pb-1.5 last:border-0 dark:border-emerald-500/20">
                  <span><b>{m[1]}</b>{m[2] && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{m[2]}</span>}</span>
                  <b className="shrink-0 tabular-nums text-emerald-700 dark:text-emerald-300">{m[3]}</b>
                </li>
              ) : <li key={i} className={isTotal(l) ? 'pt-1 text-lg text-emerald-800 dark:text-emerald-200' : 'text-slate-600 dark:text-slate-400'}><Inline s={l} /></li>
            })}
          </ul>
        </div>
      )}
      {p.notes && <p className="text-sm text-slate-700 dark:text-slate-300"><b>Benefits and notes: </b><Inline s={p.notes} /></p>}
    </div>
  )
}
