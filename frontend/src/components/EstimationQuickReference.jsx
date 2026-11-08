const STORAGE_UNITS = [
  ['Byte', 'B', '1', '0'],
  ['Kilobyte', 'KB', '1,000', '3'],
  ['Megabyte', 'MB', '1,000,000', '6'],
  ['Gigabyte', 'GB', '1,000,000,000', '9'],
  ['Terabyte', 'TB', '1,000,000,000,000', '12'],
  ['Petabyte', 'PB', '1,000,000,000,000,000', '15'],
]

const NUMBER_SCALES = [
  ['One', '1', '0'],
  ['Ten', '10', '1'],
  ['Hundred', '100', '2'],
  ['Thousand', '1,000', '3'],
  ['Million · 10 lakh', '1,000,000', '6'],
  ['Billion · 100 crore', '1,000,000,000', '9'],
]

const BEYOND_BILLION = [
  ['Trillion', '12'],
  ['Quadrillion', '15'],
  ['Quintillion', '18'],
]

const ESTIMATION_FORMULAS = [
  ['Average RPS', 'daily requests ÷ 86,400'],
  ['Peak RPS', 'average RPS × peak factor (2–5×)'],
  ['Throughput', 'RPS × average payload size'],
  ['Daily storage', 'writes/day × payload size'],
  ['Growth', 'daily storage × retention days'],
]

function ReferenceTable({ headers, rows, columns }) {
  return <div className="overflow-hidden rounded-xl border border-emerald-200/80 bg-white/80 dark:border-emerald-400/15 dark:bg-slate-950/45">
    <table className="w-full text-left text-[11px] leading-4">
      <thead className="bg-emerald-50 text-[10px] uppercase tracking-[.1em] text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
        <tr>{headers.map(header => <th key={header} className="px-2 py-1.5 font-extrabold">{header}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-emerald-100/80 dark:divide-white/[.06]">
        {rows.map(row => <tr key={row[0]}>{row.slice(0, columns).map((value, index) => <td key={`${row[0]}-${index}`} className={`px-2 py-1.5 ${index ? 'font-mono tabular-nums text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>{value}</td>)}</tr>)}
      </tbody>
    </table>
  </div>
}

export default function EstimationQuickReference({ onClose }) {
  return <aside className="estimation-reference fixed right-5 top-24 z-40 hidden w-[21rem] max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-emerald-300 bg-[#f7fffb]/95 p-4 shadow-2xl shadow-emerald-950/15 backdrop-blur-xl xl:block dark:border-emerald-400/25 dark:bg-slate-950/95" aria-label="Back-of-the-envelope estimation reference">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700 dark:text-emerald-300">Capacity math</p>
        <h2 className="mt-1 text-sm font-extrabold text-slate-950 dark:text-white">Estimation quick reference</h2>
      </div>
      <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-100 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-400 dark:hover:bg-emerald-400/15 dark:hover:text-emerald-100" aria-label="Hide estimation reference" title="Hide reference">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <p className="mt-2 rounded-lg bg-emerald-100/80 px-2.5 py-2 text-[11px] leading-4 text-emerald-950 dark:bg-emerald-400/10 dark:text-emerald-100">Decimal units: each storage step adds three zeros. Use base 1,000 for interview estimates.</p>

    <section className="mt-3">
      <h3 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-700 dark:text-slate-200">Storage units</h3>
      <ReferenceTable headers={['Unit', 'Bytes', 'Zeros']} rows={STORAGE_UNITS.map(([name, symbol, bytes, zeros]) => [`${name} (${symbol})`, bytes, zeros])} columns={3} />
      <p className="mt-1.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Next: EB = 10¹⁸ · ZB = 10²¹ · YB = 10²⁴ bytes. Binary uses 1 KiB = 1,024 bytes.</p>
    </section>

    <section className="mt-4">
      <h3 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-700 dark:text-slate-200">Number scale</h3>
      <ReferenceTable headers={['Name', 'Value', 'Zeros']} rows={NUMBER_SCALES} columns={3} />
      <div className="mt-2 flex flex-wrap gap-1.5">{BEYOND_BILLION.map(([name, zeros]) => <span key={name} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[10px] font-bold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">{name}: 10^{zeros}</span>)}</div>
    </section>

    <section className="mt-4">
      <h3 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-700 dark:text-slate-200">Throughput & storage growth</h3>
      <div className="overflow-hidden rounded-xl border border-emerald-200/80 bg-white/80 dark:border-emerald-400/15 dark:bg-slate-950/45">
        {ESTIMATION_FORMULAS.map(([label, formula]) => <div key={label} className="border-b border-emerald-100/80 px-2.5 py-2 last:border-0 dark:border-white/[.06]">
          <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-emerald-800 dark:text-emerald-200">{label}</p>
          <p className="mt-0.5 font-mono text-[10px] leading-4 text-slate-600 dark:text-slate-300">{formula}</p>
        </div>)}
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">For replication, multiply stored data by the replication factor. Add headroom for indexes, metadata, and growth.</p>
    </section>
  </aside>
}
