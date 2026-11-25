import { inlineParts, parseCompBody } from '../lib/compPost.js'

const Inline = ({ s }) => inlineParts(s).map((p, i) => p.href
  ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-600 underline dark:text-emerald-400">{p.text}</a>
  : p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>)

// A compensation post (the template form or an import) as a clean card: facts, the pay breakdown with the total highlighted, then notes and source.
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
            {p.pay.map((l, i) => <li key={i} className={isTotal(l) ? 'pt-1 text-lg text-emerald-800 dark:text-emerald-200' : ''}><Inline s={l} /></li>)}
          </ul>
        </div>
      )}
      {p.notes && <p className="text-sm text-slate-700 dark:text-slate-300"><b>Benefits and notes: </b><Inline s={p.notes} /></p>}
      {p.source && <p className="text-xs text-slate-500">Source: <Inline s={p.source} /></p>}
    </div>
  )
}
