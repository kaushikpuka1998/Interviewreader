import { useState, useEffect, useCallback } from 'react'
import Loader from './Loader.jsx'
import { fetchAnalytics, fetchSignups, fetchOnline } from '../lib/analytics.js'

// When the admin last acknowledged the signup list — used to badge new joiners.
const SEEN_KEY = 'ir_signups_seen_at'

function Stat({ label, value, sub, tone }) {
  const tones = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    violet: 'text-violet-600 dark:text-violet-400',
  }
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone] || 'text-slate-900 dark:text-slate-100'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
    </div>
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
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Views per day</h3>
      <div className="flex items-end gap-1 h-28">
        {daily.map((d) => (
          <div key={d.date} className="flex-1 min-w-0 group relative flex flex-col justify-end h-full">
            <div
              className="w-full rounded-t bg-gradient-to-t from-blue-500 to-indigo-400 min-h-[2px] transition-opacity group-hover:opacity-80"
              style={{ height: `${(d.views / max) * 100}%` }}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 z-10">
              {d.date}: {d.views} views · {d.visitors} visitors
            </span>
          </div>
        ))}
      </div>
    </div>
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Unique audience</h3>
        <span className="text-[11px] text-slate-400">last {days} days</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div>
          <p className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">{unique.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">unique visitors</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{identifiedUsers.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">signed-in users</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{engagedVisitors.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">read 2+ questions</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{viewsPerVisitor}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">views per visitor</p>
        </div>
      </div>

      <div className="space-y-4">
        <SplitBar
          a={newVisitors} b={returningVisitors}
          aLabel="New" bLabel="Returning"
          aTone="bg-violet-500"
        />
        <SplitBar
          a={signedInViews} b={anonymousViews}
          aLabel="Signed-in views" bLabel="Anonymous views"
          aTone="bg-blue-500"
        />
      </div>

      <p className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{identifiedUsers.toLocaleString()}</span>
        {' '}of{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{registeredMembers.toLocaleString()}</span>
        {' '}members were active ({signedInPct}%)
      </p>
    </div>
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
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Reading depth on top questions</h3>
        {!topQuestions?.length ? <p className="text-sm text-slate-400">No question views yet.</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {topQuestions.map(q => (
              <li key={q.id} className="py-2.5">
                <p className="text-sm text-slate-800 dark:text-slate-100 break-words" title={q.title}>{q.title}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>{q.views} views</span>
                  <span>{q.avgScroll == null ? '–' : `${q.avgScroll}%`} scroll</span>
                  <span>{fmtSecs(q.avgSeconds)} avg time</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <BarList title="Most clicked" rows={engagement.topClicks || []} labelKey="label" valueKey="clicks" empty="No clicks recorded yet." />

        <div className={card}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Member activity</h3>
          {!members.length ? <p className="text-sm text-slate-400">No signed-in activity yet.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[40rem] overflow-y-auto">
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> Online now
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">{total} total · {online.members.length} signed in · {online.visitors} visitor{online.visitors === 1 ? '' : 's'}</span>
      </div>
      {online.members.length === 0 ? (
        <p className="text-sm text-slate-400">No signed-in members online right now.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {online.members.map(m => (
            <li key={m.email} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 truncate text-slate-800 dark:text-slate-100">
                {m.name || m.email}
                {m.name && <span className="ml-2 text-xs text-slate-400">{m.email}</span>}
              </span>
              <span className="flex flex-shrink-0 items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {m.username && <a href={`/u/${m.username}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">profile ↗</a>}
                {ago(m.lastSeen)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <div className="space-y-5">
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

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                days === d ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <button onClick={load} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Refresh
        </button>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Views today" value={t.viewsToday ?? 0} tone="blue" />
        <Stat label={`Views (${data.windowDays}d)`} value={t.viewsInWindow ?? 0} sub={`${(t.totalViews ?? 0).toLocaleString()} all time`} />
        <Stat label="Visitors" value={t.uniqueInWindow ?? 0} sub={`${(t.uniqueVisitors ?? 0).toLocaleString()} all time`} tone="violet" />
        <Stat label="Members" value={s.total ?? 0} sub={`+${s.today ?? 0} today · +${s.thisWeek ?? 0} this week`} tone="green" />
      </div>

      <AudienceBlock audience={data.audience} days={data.windowDays} />

      <EngagementBlock engagement={data.engagement} topQuestions={data.topQuestions} />

      <DailyChart daily={data.daily} />

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
