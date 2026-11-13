import { useState, useEffect, useCallback } from 'react'
import Loader from './Loader.jsx'
import { fetchAnalytics, fetchSignups, fetchOnline, fetchFunnel } from '../lib/analytics.js'

// When the admin last acknowledged the signup list — used to badge new joiners.
const SEEN_KEY = 'ir_signups_seen_at'

function Stat({ label, value, sub, tone }) {
  const tones = {
    blue: 'text-sky-600 dark:text-sky-300',
    green: 'text-emerald-600 dark:text-emerald-300',
    violet: 'text-violet-600 dark:text-violet-300',
  }
  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-white/15">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${
        tone === 'green' ? 'bg-emerald-400' : tone === 'violet' ? 'bg-violet-400' : 'bg-sky-400'
      }`} aria-hidden="true" />
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${tones[tone] || 'text-slate-950 dark:text-white'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </article>
  )
}

// Pie chart drawn as SVG arcs (no chart library). Rows: { [labelKey], [valueKey] }.
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b']

function PieChart({ title, rows, labelKey, valueKey, empty }) {
  const total = rows.reduce((sum, r) => sum + (r[valueKey] || 0), 0)
  const card = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'
  if (total === 0) {
    return (
      <div className={card}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">{title}</h3>
        <p className="text-sm text-slate-400">{empty}</p>
      </div>
    )
  }

  const cx = 60, cy = 60, r = 56
  let angle = -Math.PI / 2
  const slices = rows.filter(r => r[valueKey] > 0).map((row, i) => {
    const frac = row[valueKey] / total
    const color = PIE_COLORS[i % PIE_COLORS.length]
    let path
    if (frac >= 0.9999) {
      path = null   // one slice is the whole pie: draw a circle instead of an arc
    } else {
      const start = angle, end = angle + frac * 2 * Math.PI
      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start)
      const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end)
      path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`
      angle = end
    }
    return { label: row[labelKey] || 'unknown', value: row[valueKey], pct: Math.round(frac * 100), color, path }
  })

  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">{title}</h3>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 120 120" className="w-28 h-28 flex-shrink-0" role="img" aria-label={title}>
          {slices.map(s => s.path
            ? <path key={s.label} d={s.path} fill={s.color} stroke="white" strokeWidth="1" className="dark:stroke-slate-900"><title>{`${s.label}: ${s.value} (${s.pct}%)`}</title></path>
            : <circle key={s.label} cx={cx} cy={cy} r={r} fill={s.color}><title>{`${s.label}: ${s.value} (100%)`}</title></circle>
          )}
        </svg>
        <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
          {slices.map(s => (
            <li key={s.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 min-w-0">
                <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                <span className="truncate text-slate-700 dark:text-slate-200">{s.label}</span>
              </span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400 flex-shrink-0">{s.value.toLocaleString()} · {s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Horizontal bar list — used for referrers, questions and devices.
function BarList({ title, rows, labelKey, valueKey, empty }) {
  const max = Math.max(1, ...rows.map(r => r[valueKey]))
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-3 text-sm mb-0.5">
                <span className="truncate text-slate-700 dark:text-slate-200" title={String(r[labelKey])}>
                  {r[labelKey] || 'direct'}
                </span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {r[valueKey].toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{ width: `${(r[valueKey] / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Compact bar chart of daily views.
function DailyChart({ daily }) {
  if (!daily || daily.length === 0) return null
  const max = Math.max(1, ...daily.map(d => d.views))
  const width = 640, height = 220, pad = { top: 20, right: 12, bottom: 28, left: 38 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const pointAt = (d, i) => ({
    x: pad.left + (daily.length === 1 ? innerWidth / 2 : (i / (daily.length - 1)) * innerWidth),
    y: pad.top + innerHeight - (d.views / max) * innerHeight,
  })
  const points = daily.map(pointAt)
  const line = points.map(p => `${p.x},${p.y}`).join(' ')
  const area = `M ${points[0].x} ${pad.top + innerHeight} L ${points.map(p => `${p.x} ${p.y}`).join(' L ')} L ${points[points.length - 1].x} ${pad.top + innerHeight} Z`
  const labels = [daily[0], daily[Math.floor((daily.length - 1) / 2)], daily[daily.length - 1]].filter(Boolean)
  const totalViews = daily.reduce((sum, d) => sum + d.views, 0)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.02] sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-300">Traffic trend</p>
          <h3 className="mt-1 text-base font-bold text-slate-950 dark:text-white">Daily views</h3>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-slate-950 dark:text-white">{totalViews.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">total views</p>
        </div>
      </div>
      <div className="h-52">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label="Line chart showing daily views">
          {[0, 0.5, 1].map((mark) => {
            const y = pad.top + innerHeight - mark * innerHeight
            return <g key={mark}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeDasharray="3 4" /><text x={pad.left - 7} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px]">{Math.round(max * mark).toLocaleString()}</text></g>
          })}
          <defs>
            <linearGradient id="daily-views-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#daily-views-fill)" />
          <polyline points={line} fill="none" stroke="#14b8a6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => <g key={daily[i].date} className="group"><circle cx={p.x} cy={p.y} r="4" fill="#0f766e" stroke="white" strokeWidth="2" className="dark:stroke-[#0d1916]" /><title>{`${daily[i].date}: ${daily[i].views.toLocaleString()} views · ${daily[i].visitors.toLocaleString()} visitors`}</title></g>)}
          {labels.map((d) => {
            const i = daily.indexOf(d)
            const p = points[i]
            return <text key={d.date} x={p.x} y={height - 5} textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'} className="fill-slate-400 text-[10px]">{d.date.slice(5)}</text>
          })}
        </svg>
      </div>
    </section>
  )
}

// Split bar: two proportional segments with a shared legend.
function SplitBar({ a, b, aLabel, bLabel, aTone = 'bg-blue-500', bTone = 'bg-slate-300 dark:bg-slate-600' }) {
  const total = a + b
  const pct = total > 0 ? (a / total) * 100 : 0
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <div className={aTone} style={{ width: `${pct}%` }} />
        <div className={`${bTone} flex-1`} />
      </div>
      <div className="flex justify-between mt-1.5 text-xs">
        <span className="text-slate-600 dark:text-slate-300">
          {aLabel} <span className="tabular-nums font-semibold">{a.toLocaleString()}</span>
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {bLabel} <span className="tabular-nums font-semibold">{b.toLocaleString()}</span>
        </span>
      </div>
    </div>
  )
}

// Unique-audience panel: who the visitors were, not just how many hits.
function AudienceBlock({ audience, days }) {
  if (!audience) return null
  const {
    unique = 0, newVisitors = 0, returningVisitors = 0, engagedVisitors = 0,
    identifiedUsers = 0, signedInViews = 0, anonymousViews = 0,
    registeredMembers = 0, viewsPerVisitor = 0,
  } = audience
  const signedInPct = registeredMembers > 0 ? Math.round((identifiedUsers / registeredMembers) * 100) : 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.02] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">Audience health</p>
          <h3 className="mt-1 text-base font-bold text-slate-950 dark:text-white">Who is engaging</h3>
        </div>
        <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">{days} days</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-violet-50 p-3 dark:bg-violet-400/[0.07]"><p className="text-xl font-bold tabular-nums text-violet-700 dark:text-violet-300">{unique.toLocaleString()}</p><p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">unique visitors</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-400/[0.07]"><p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{engagedVisitors.toLocaleString()}</p><p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">read 2+ questions</p></div>
        <div><p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{identifiedUsers.toLocaleString()}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">signed-in users</p></div>
        <div><p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{viewsPerVisitor}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">views per visitor</p></div>
      </div>
      <div className="mt-5 space-y-4">
        <SplitBar a={newVisitors} b={returningVisitors} aLabel="New visitors" bLabel="Returning" aTone="bg-violet-500" />
        <SplitBar a={signedInViews} b={anonymousViews} aLabel="Signed-in views" bLabel="Anonymous views" aTone="bg-emerald-500" />
      </div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400"><span className="font-bold text-slate-700 dark:text-slate-200">{identifiedUsers.toLocaleString()}</span> of {registeredMembers.toLocaleString()} members were active <span className="font-bold text-emerald-700 dark:text-emerald-300">({signedInPct}%)</span></p>
    </section>
  )
}

const fmtSecs = (s) => (s == null ? '–' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`)

const STATUS_STYLE = {
  reading: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  browsing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'logged-in only': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

// What signed-in members actually do: read, skim, or just log in.
function EngagementBlock({ engagement, topQuestions }) {
  if (!engagement) return null
  const { avgScroll = 0, avgReadSeconds = 0, statusCounts = {}, members = [] } = engagement
  const card = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Avg scroll depth" value={`${avgScroll}%`} tone="blue" />
        <Stat label="Avg time / visitor" value={fmtSecs(avgReadSeconds)} tone="violet" />
        <Stat label="Reading" value={statusCounts.reading ?? 0} sub="30s+ or scrolled half" tone="green" />
        <Stat label="Browsing" value={statusCounts.browsing ?? 0} sub="opened, didn't read" />
        <Stat label="Logged in only" value={statusCounts.loggedInOnly ?? 0} sub="no activity after sign-in" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <PieChart
          title="Member status"
          rows={[
            { label: 'Reading', value: statusCounts.reading ?? 0 },
            { label: 'Browsing', value: statusCounts.browsing ?? 0 },
            { label: 'Logged in only', value: statusCounts.loggedInOnly ?? 0 },
          ]}
          labelKey="label"
          valueKey="value"
          empty="No signed-in member activity yet."
        />

        <div className={card}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Reading depth on top questions</h3>
          {!topQuestions?.length ? <p className="text-sm text-slate-400">No question views yet.</p> : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {topQuestions.map(q => (
                <li key={q.id} className="flex items-baseline justify-between gap-3 py-1.5">
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100" title={q.title}>{q.title}</p>
                  <p className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {q.views} views · {q.avgScroll == null ? '–' : `${q.avgScroll}%`} · {fmtSecs(q.avgSeconds)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <BarList title="Most clicked" rows={engagement.topClicks || []} labelKey="label" valueKey="clicks" empty="No clicks recorded yet." />

        <div className={card}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Member activity</h3>
          {!members.length ? <p className="text-sm text-slate-400">No signed-in activity yet.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {members.map(m => (
                <li key={m.email}>
                  {(() => {
                    // Members with a username open their public profile (new tab, so the dashboard stays put).
                    const body = (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800 dark:text-slate-100 truncate">
                            {m.name || m.email}
                            {m.username && <span className="ml-1.5 text-xs text-slate-400">@{m.username}</span>}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {m.location && <>📍 {m.location} · </>}{m.views} views · {fmtSecs(m.readSeconds)} read · {m.maxScroll}% scroll · {m.clicks} clicks
                          </p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[m.status] || ''}`}>
                          {m.status}
                        </span>
                        {m.username && <span aria-hidden="true" className="flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600">→</span>}
                      </>
                    )
                    return m.username ? (
                      <a href={`/u/${encodeURIComponent(m.username)}`} target="_blank" rel="noopener noreferrer"
                        title={`Open ${m.name || m.username}'s profile`}
                        className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        {body}
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 py-2" title="No username yet, so no public profile">{body}</div>
                    )
                  })()}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

// Live "who is online" card for the admin: signed-in members by name, anonymous visitors as a number. Refreshes every 15 seconds.
function OnlineNow() {
  const [online, setOnline] = useState(null)
  useEffect(() => {
    let alive = true
    const tick = () => fetchOnline().then(d => { if (alive) setOnline(d) }).catch(() => {})
    tick()
    const timer = setInterval(tick, 15000)
    return () => { alive = false; clearInterval(timer) }
  }, [])
  if (!online) return null
  const ago = iso => {
    const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
    return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
  }
  const total = online.members.length + online.visitors
  return (
    <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/[0.045]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">Live activity</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">{total} active now · {online.members.length} signed in · {online.visitors} visitor{online.visitors === 1 ? '' : 's'}</p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">Updates every 15s</span>
      </div>
      {online.members.length === 0 ? (
        <p className="mt-4 border-t border-emerald-200/70 pt-3 text-sm text-slate-600 dark:border-emerald-400/10 dark:text-slate-400">No signed-in members online right now.</p>
      ) : (
        <ul className="mt-4 divide-y divide-emerald-200/70 border-t border-emerald-200/70 dark:divide-emerald-400/10 dark:border-emerald-400/10">
          {online.members.map(m => (
            <li key={m.email} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                {m.name || m.email}
                {m.name && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{m.email}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {m.username && <a href={`/u/${m.username}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Profile ↗</a>}
                {ago(m.lastSeen)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const pct = (n, of) => (of ? `${Math.round((n * 100) / of)}%` : '–')

// Visitor → member funnel. Each bar is a share of real visitors; the drop from the previous step is shown beside it.
function FunnelBlock({ days }) {
  const [f, setF] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { setF(null); fetchFunnel(days).then(setF).catch(e => setError(e.message)) }, [days])
  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (!f) return <Loader compact label="Loading funnel…" />
  const t = f.totals
  const real = t.real_visitors
  const steps = [
    ['Real visitors', real],
    ['Opened a question', t.opened_question],
    ['Read properly (30s or half the page)', t.engaged_read],
    ['Read 3+ questions', t.read_three],
    ['Opened sign-up / log-in', t.opened_signup],
    ['Submitted sign-up', t.submitted_signup],
    ['Signed in', t.signed_in],
    ['Came back on another day', t.returned],
  ]
  const table = (title, col, rows) => (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.035]">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h4>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-[30rem] text-xs tabular-nums">
          <thead className="text-slate-500 dark:text-slate-400"><tr><th className="text-left font-semibold">{col}</th><th className="text-right font-semibold">Visitors</th><th className="text-right font-semibold">Bounce</th><th className="text-right font-semibold">Opened sign-up</th><th className="text-right font-semibold">Signed in</th></tr></thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {rows.map(r => (
              <tr key={r.k} className="border-t border-slate-100 dark:border-white/5">
                <td className="max-w-48 truncate py-2 pr-2 font-medium">{r.k}</td><td className="text-right">{r.visitors}</td>
                <td className="text-right">{pct(r.bounced, r.visitors)}</td><td className="text-right">{r.opened_signup}</td><td className="text-right">{r.signed_in}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.02]">
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.025] sm:px-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Acquisition</p>
            <h3 className="mt-1 text-base font-bold text-slate-950 dark:text-white">Conversion funnel <span className="font-medium text-slate-500 dark:text-slate-400">· {f.windowDays} days</span></h3>
          </div>
          <p className="max-w-3xl text-xs leading-5 text-slate-600 dark:text-slate-400">{t.visitors} visitors, {t.no_interaction} likely bots removed · {pct(t.bounced, real)} of real visitors left after one page · {f.newMembers} new members</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <ol className="space-y-3">
          {steps.map(([label, n], i) => {
            const percentage = pct(n, real)
            return (
              <li key={label} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(11rem,14rem)_1fr_7rem] sm:items-center">
                <span className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
                <span className="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10 sm:order-none sm:col-auto sm:h-2.5">
                  <span className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: percentage === '–' ? 0 : percentage }} />
                </span>
                <span className="text-right text-sm tabular-nums text-slate-700 dark:text-slate-200">
                  {n} <span className="text-slate-400">· {percentage}</span>
                  {i > 0 && i < 7 && steps[i - 1][1] > 0 && n <= steps[i - 1][1] && <span className="block text-[10px] font-semibold text-rose-500">−{100 - Math.round((n * 100) / steps[i - 1][1])}%</span>}
                </span>
              </li>
            )
          })}
        </ol>
        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {table('By source', 'Source', f.bySource)}
          {table('By device', 'Device', f.byDevice)}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <BarList title="Sign-up dialog opened from" rows={f.signupOpenedFrom} labelKey="k" valueKey="sessions" empty="Recorded from the next deploy onwards." />
          <BarList title="Sign-up / log-in errors" rows={f.authErrors} labelKey="k" valueKey="sessions" empty="No failed attempts recorded." />
        </div>
      </div>
    </section>
  )
}

export default function AnalyticsPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [signups, setSignups] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const seen = localStorage.getItem(SEEN_KEY)
      const [summary, sign] = await Promise.all([fetchAnalytics(days), fetchSignups(seen, 20)])
      setData(summary); setSignups(sign)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  const acknowledge = () => {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
    setSignups(s => ({ ...s, newSince: 0 }))
  }

  if (loading && !data) return <Loader compact label="Loading analytics…" />
  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (!data) return null

  const t = data.traffic || {}
  const s = data.signups || {}
  const newJoiners = signups?.newSince || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">Performance</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Analytics overview</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Understand audience growth, engagement, and conversion at a glance.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-emerald-400/50 dark:hover:text-emerald-300">
          <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {loading ? 'Refreshing' : 'Refresh data'}
        </button>
      </div>

      {/* New-joiner alert: only an admin ever sees this panel */}
      {newJoiners > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3">
          <p className="text-sm text-green-800 dark:text-green-300">
            <span className="font-semibold">{newJoiners} new {newJoiners === 1 ? 'person has' : 'people have'} joined</span>
            {' '}since you last checked.
          </p>
          <button onClick={acknowledge} className="text-xs font-semibold text-green-700 dark:text-green-400 hover:underline flex-shrink-0">
            Mark as seen
          </button>
        </div>
      )}

      <OnlineNow />

      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Reporting period</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-black/20" role="group" aria-label="Reporting period">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                days === d ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-500 dark:text-slate-950' : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Views today" value={t.viewsToday ?? 0} tone="blue" />
        <Stat label={`Views (${data.windowDays}d)`} value={t.viewsInWindow ?? 0} sub={`${(t.totalViews ?? 0).toLocaleString()} all time`} />
        <Stat label="Visitors" value={t.uniqueInWindow ?? 0} sub={`${(t.uniqueVisitors ?? 0).toLocaleString()} all time`} tone="violet" />
        <Stat label="Members" value={s.total ?? 0} sub={`+${s.today ?? 0} today · +${s.thisWeek ?? 0} this week`} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(22rem,0.8fr)]">
        <DailyChart daily={data.daily} />
        <AudienceBlock audience={data.audience} days={data.windowDays} />
      </div>

      <FunnelBlock days={days} />

      <EngagementBlock engagement={data.engagement} topQuestions={data.topQuestions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <BarList
          title="Campaigns (visits)"
          rows={(data.campaigns || []).map(c => ({ ...c, label: c.campaign ? `${c.source} · ${c.campaign}` : c.source }))}
          labelKey="label"
          valueKey="visitors"
          empty="No tagged visits yet. Share links with ?utm_source=…"
        />
        <BarList
          title="Resume builder entry points (visitors)"
          rows={(data.resumeBuilder || []).map(r => ({ ...r, label: r.placement.replace(/_/g, ' ') }))}
          labelKey="label"
          valueKey="visitors"
          empty="No resume builder visits yet. Clicks from the sidebar or profile show up here."
        />
        <BarList
          title="Campaigns (signups)"
          rows={(data.signupCampaigns || []).map(c => ({ ...c, label: c.campaign ? `${c.source} · ${c.campaign}` : c.source }))}
          labelKey="label"
          valueKey="signups"
          empty="No signups from tagged links yet."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BarList
          title="Where visitors come from"
          rows={data.referrers || []}
          labelKey="source"
          valueKey="views"
          empty="No traffic recorded yet."
        />
        <BarList
          title="Most viewed questions"
          rows={data.topQuestions || []}
          labelKey="title"
          valueKey="views"
          empty="No question views yet."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BarList
          title="Members by country"
          rows={data.countries || []}
          labelKey="country"
          valueKey="members"
          empty="No members yet."
        />
        <PieChart
          title="Devices"
          rows={data.devices || []}
          labelKey="device"
          valueKey="views"
          empty="No device data yet."
        />

        {/* Recent joiners */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Recent sign-ups</h3>
          {!signups?.users?.length ? (
            <p className="text-sm text-slate-400">Nobody has signed up yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
              {signups.users.map((u, i) => (
                <li key={u.email + i}>
                <a href={u.username ? `/u/${u.username}` : undefined} target="_blank" rel="noopener noreferrer" className="py-2 flex items-center gap-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 -mx-2 px-2 transition-colors" title="Open public profile">
                  <div className="w-7 h-7 flex-shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                    {(u.name || u.email || '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 dark:text-slate-100 truncate">{u.name || u.email}</p>
                    {u.name && <p className="text-xs text-slate-400 truncate">{u.email}</p>}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : ''}
                  </span>
                </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Visitors are counted with an anonymous session id. No IP addresses or cookies are stored.
      </p>
    </div>
  )
}
