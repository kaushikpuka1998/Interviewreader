const DATABASES = [
  ['MySQL', 'Relational OLTP(Online Transaction Processing)', 'Orders, payments, users, transactions(ACID), and joins.'],
  ['PostgreSQL', 'Relational + flexible data', 'Transactional systems, complex queries, JSON fields, and geospatial data.'],
  ['Redis', 'In-memory key-value', 'Caching, sessions, rate limits, leaderboards, and short-lived counters.'],
  ['MongoDB', 'Document database', 'Flexible product/catalog data and rapidly changing document shapes.'],
  ['Cassandra', 'Wide-column, write-heavy', 'High-volume event/time-series writes across multiple regions.'],
  ['DynamoDB', 'Managed key-value', 'Predictable access patterns with automatic scaling and low operations work.'],
  ['Elasticsearch', 'Search index', 'Full-text search, filtering, autocomplete, and log exploration.'],
  ['Object storage', 'Blob storage', 'Images, video, backups, exports, and large immutable files.'],
]

export default function DatabaseUseCaseReference({ onClose }) {
  return <aside className="fixed right-5 top-24 z-40 hidden w-[22rem] max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-sky-300 bg-[#f8fcff]/95 p-4 shadow-2xl shadow-sky-950/15 backdrop-blur-xl xl:block dark:border-sky-400/25 dark:bg-slate-950/95" aria-label="Database selection guide">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-sky-700 dark:text-sky-300">Architecture guide</p>
        <h2 className="mt-1 text-sm font-extrabold text-slate-950 dark:text-white">Choose the right data store</h2>
      </div>
      <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-sky-100 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-400 dark:hover:bg-sky-400/15 dark:hover:text-sky-100" aria-label="Hide database guide" title="Hide guide">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <p className="mt-2 rounded-lg bg-sky-100/80 px-2.5 py-2 text-[11px] leading-4 text-sky-950 dark:bg-sky-400/10 dark:text-sky-100">Start from the access pattern, consistency needs, data shape, and scale—not the database name.</p>

    <div className="mt-3 overflow-hidden rounded-xl border border-sky-200/80 bg-white/80 dark:border-sky-400/15 dark:bg-slate-950/45">
      {DATABASES.map(([name, type, useCase]) => <div key={name} className="border-b border-sky-100/80 px-3 py-2.5 last:border-0 dark:border-white/[.06]">
        <div className="flex items-baseline justify-between gap-3"><b className="text-[12px] text-sky-900 dark:text-sky-100">{name}</b><span className="text-[9px] font-extrabold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400">{type}</span></div>
        <p className="mt-1 text-[11px] leading-4 text-slate-600 dark:text-slate-300">{useCase}</p>
      </div>)}
    </div>
  </aside>
}
