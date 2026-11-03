import { useEffect, useState } from 'react'
import { fetchEngagementBreakdown } from '../lib/analytics.js'

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
    <span className="text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">{Number(value ?? 0).toLocaleString('en-IN')}</span>
  </div>
)
const Card = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
    <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
    {children}
  </section>
)

// Admin: engagement across the key loops — the daily challenge, code practice, read-only vs solver mix, and referrals.
export default function EngagementPanel() {
  const [days, setDays] = useState(30)
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { setD(null); setErr(''); fetchEngagementBreakdown(days).then(setD).catch(e => setErr(e.message)) }, [days])
  if (err) return <p className="text-sm text-red-600">{err}</p>
  if (!d) return <p className="text-sm text-slate-500">Loading…</p>
  const split = d.split || {}
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <span>Last</span>
        <select className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900" value={days} onChange={e => setDays(Number(e.target.value))}>
          {[7, 30, 90].map(n => <option key={n} value={n}>{n} days</option>)}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="🔥 Daily challenge">
          <Row label="Page visitors" value={d.daily.pageVisitors} />
          <Row label="Signed-in page visits" value={d.daily.pageMembers} />
          <Row label="Members who read today's" value={d.daily.readEvents} />
          <Row label="Members who solved today's" value={d.daily.solveEvents} />
          <Row label="Did both the same day" value={d.daily.bothSameDay} />
          <Row label="Daily check-ins (streak)" value={d.daily.checkins} />
          <Row label="Promo / card opens" value={d.daily.promoOpens} />
        </Card>

        <Card title="💻 Code practice">
          <Row label="Submitters" value={d.practice.submitters} />
          <Row label="Submissions" value={d.practice.submissions} />
          <Row label="Members with ≥1 accepted" value={d.practice.solvers} />
          <Row label="Distinct problems solved" value={d.practice.solvedProblems} />
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">By language</div>
            <ul className="space-y-1 text-sm">
              {(d.practice.byLanguage || []).map(l => (
                <li key={l.language} className="flex justify-between tabular-nums"><span>{l.language}</span><span className="text-slate-500">{l.accepted}/{l.submissions} accepted</span></li>
              ))}
              {(!d.practice.byLanguage || d.practice.byLanguage.length === 0) && <li className="text-xs text-slate-500">No submissions yet.</li>}
            </ul>
          </div>
        </Card>

        <Card title="🧭 Reader vs solver mix">
          <Row label="Active (did either)" value={split.active} />
          <Row label="Read only" value={split.read_only} />
          <Row label="Solve only" value={split.solve_only} />
          <Row label="Did both" value={split.both} />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">A read is a qualifying read of a question. A solve is a first accepted submission for a problem.</p>
        </Card>

        <Card title="🌗 Dark vs light mode">
          {(() => {
            const t = d.theme || {}
            const ds = Number(t.dark_sessions || 0), ls = Number(t.light_sessions || 0), dm = Number(t.dark_members || 0), lm = Number(t.light_members || 0)
            const pct = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : 0)
            const bar = (a, b) => (
              <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="bg-slate-800 dark:bg-slate-200" style={{ width: `${pct(a, b)}%` }} />
                <div className="bg-amber-400" style={{ width: `${100 - pct(a, b)}%` }} />
              </div>
            )
            return (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visitors (sessions)</div>
                <Row label={`🌙 Dark · ${pct(ds, ls)}%`} value={ds} />
                <Row label={`☀️ Light · ${pct(ls, ds)}%`} value={ls} />
                {bar(ds, ls)}
                <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Signed-in members</div>
                <Row label={`🌙 Dark · ${pct(dm, lm)}%`} value={dm} />
                <Row label={`☀️ Light · ${pct(lm, dm)}%`} value={lm} />
                {bar(dm, lm)}
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Each visitor or member is counted once, by the theme on their latest tracked view. Views before this was added have no theme.</p>
              </>
            )
          })()}
        </Card>

        <Card title="🎁 Referrals">
          <Row label="Members who referred someone" value={d.referrals.referrers} />
          <Row label="Signups from referrals" value={d.referrals.referredSignups} />
          <Row label="Referred & now active" value={d.referrals.activeReferred} />
        </Card>
      </div>

      <Card title="Top solvers">
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {(d.practice.topSolvers || []).map(r => (
            <li key={r.email} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate">{r.name || r.email} <span className="text-xs text-slate-500">{r.email}</span></span>
              <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">{r.solved} solved · {r.submissions} runs</span>
            </li>
          ))}
          {(!d.practice.topSolvers || d.practice.topSolvers.length === 0) && <li className="py-2 text-xs text-slate-500">Nobody has solved a problem in this window yet.</li>}
        </ul>
      </Card>

      <Card title="Top referrers">
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {(d.referrals.topReferrers || []).map(r => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate">{r.name || r.email} <span className="text-xs text-slate-500">{r.email}</span></span>
              <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">{r.referrals} referrals · {r.active} active</span>
            </li>
          ))}
          {(!d.referrals.topReferrers || d.referrals.topReferrers.length === 0) && <li className="py-2 text-xs text-slate-500">Nobody has referred anyone in this window yet.</li>}
        </ul>
      </Card>
    </div>
  )
}
