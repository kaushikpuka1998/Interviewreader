import { useEffect, useState } from 'react'
import { fetchRevisionDue, markRevised, fetchReferral } from '../lib/engage.js'
import { slugify } from '../lib/slug.js'

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950'

function useCopy() {
  const [done, setDone] = useState('')
  return [done, (key, text) => navigator.clipboard?.writeText(text).then(() => { setDone(key); setTimeout(() => setDone(''), 1500) })]
}

// Questions you read (or flagged) come back after 3, 7, 16, 35 and 70 days, so they stick.
function RevisePanel() {
  const [data, setData] = useState(null)
  useEffect(() => { fetchRevisionDue().then(setData).catch(() => setData({ total: 0, items: [] })) }, [])
  const done = async id => {
    await markRevised(id).catch(() => {})
    setData(d => ({ total: Math.max(0, d.total - 1), items: d.items.filter(i => i.id !== id) }))
  }
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Revise today</h3>
        {data?.total > 0 && <span className="text-xs text-slate-500 dark:text-slate-400">{data.total} due</span>}
      </div>
      {!data ? <p className="mt-2 text-sm text-slate-400">Loading…</p> : data.items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">You're all caught up. Questions you read or flag come back here after 3, 7, 16, 35 and 70 days.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data.items.map(i => (
            <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
              <a href={`/${slugify(i.title)}?id=${i.id}`} className="min-w-0 truncate text-slate-800 hover:text-blue-600 hover:underline dark:text-slate-200">{i.flagged ? '🔖 ' : ''}{i.title}</a>
              <button type="button" onClick={() => done(i.id)} className="shrink-0 rounded-md border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200">Revised ✓</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReferralCard() {
  const [r, setR] = useState(null)
  const [copied, copy] = useCopy()
  useEffect(() => { fetchReferral().then(setR).catch(() => {}) }, [])
  if (!r) return <div className={card}><p className="text-sm text-slate-400">Loading…</p></div>
  const shareText = `I'm preparing for interviews on Interview Reader. Join with my link and we both get a week of Premium: ${r.link}`
  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Invite a friend: you both get {r.rewardDays} days of Premium</h3>
      <div className="mt-2 flex gap-2">
        <input readOnly value={r.link} onFocus={e => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-label="Your invite link" />
        <button type="button" onClick={() => copy('link', r.link)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">{copied === 'link' ? 'Copied ✓' : 'Copy'}</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:text-slate-200">WhatsApp</a>
        <a href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:text-slate-200">LinkedIn</a>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{r.joined} friend{r.joined === 1 ? '' : 's'} joined · {r.daysEarned} days earned (up to {r.maxRewards * r.rewardDays}).</p>
    </div>
  )
}

// The live streak as an image for a GitHub README, portfolio or resume.
function BadgeCard({ username }) {
  const [copied, copy] = useCopy()
  if (!username) return null
  // This site's own address: the web server forwards /share/* to the API (see the Caddyfile), like the LinkedIn share links.
  const src = `${window.location.origin}/share/u/${username}/streak.svg`
  const md = `[![Interview Reader streak](${src})](${window.location.origin}/u/${username})`
  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Streak badge for your README or resume</h3>
      <img src={src} alt="Your streak badge" className="mt-2 h-16" />
      <div className="mt-2 flex gap-2">
        <input readOnly value={md} onFocus={e => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-label="Markdown for the badge" />
        <button type="button" onClick={() => copy('md', md)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">{copied === 'md' ? 'Copied ✓' : 'Copy'}</button>
      </div>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Paste the Markdown into a README. The badge updates by itself as your streak grows.</p>
    </div>
  )
}

export default function ProfileGrowth({ username }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <RevisePanel />
      <ReferralCard />
      <BadgeCard username={username} />
    </div>
  )
}
