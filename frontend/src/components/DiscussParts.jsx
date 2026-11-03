import { useState } from 'react'
import Pic from './Pic.jsx'
import { CATEGORIES, ago, voteDiscussion } from '../lib/discuss.js'
import { isLoggedIn } from '../lib/auth.js'

const toneOf = c => CATEGORIES.find(x => x.key === c)?.tone || ''
const iconOf = c => CATEGORIES.find(x => x.key === c)?.icon || '💬'

// ▲ score ▼ rail. Anyone can look; voting needs an account (onNeedAuth opens the sign-in dialog).
export function VoteRail({ d, onChange, onNeedAuth, horizontal = false }) {
  const [busy, setBusy] = useState(false)
  const cast = async v => {
    if (!isLoggedIn()) return onNeedAuth?.()
    if (busy) return
    setBusy(true)
    try { onChange(await voteDiscussion(d.id, d.myVote === v ? 0 : v)) } catch { /* keep the old score */ } finally { setBusy(false) }
  }
  const btn = on => `flex h-7 w-7 items-center justify-center rounded-lg text-sm transition ${on ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-emerald-500/15 hover:text-emerald-600'}`
  return (
    <div className={`flex shrink-0 items-center gap-1 ${horizontal ? 'flex-row' : 'flex-col'}`}>
      <button type="button" aria-label="Upvote" aria-pressed={d.myVote === 1} onClick={() => cast(1)} className={btn(d.myVote === 1)}>▲</button>
      <span className={`min-w-[1.5rem] text-center text-sm font-bold tabular-nums ${d.score > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.score < 0 ? 'text-rose-500' : 'text-slate-500'}`}>{d.score}</span>
      <button type="button" aria-label="Downvote" aria-pressed={d.myVote === -1} onClick={() => cast(-1)} className={`${btn(false)} ${d.myVote === -1 ? '!bg-rose-500 !text-white' : 'hover:!bg-rose-500/15 hover:!text-rose-500'}`}>▼</button>
    </div>
  )
}

export function Avatar({ author, size = 'h-9 w-9' }) {
  const anon = author?.anonymous
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${anon ? 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'}`} aria-hidden="true">
      {anon ? '🕶️' : <Pic src={author?.picture} fallback={(author?.name || '?').slice(0, 1).toUpperCase()} />}
    </span>
  )
}

export function Chips({ d }) {
  const chip = 'rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${toneOf(d.category)}`}>{iconOf(d.category)} {CATEGORIES.find(c => c.key === d.category)?.label}</span>
      {d.company && <span className={chip}>🏢 {d.company}</span>}
      {d.role && <span className={chip}>{d.role}</span>}
      {d.level && <span className={chip}>{d.level}</span>}
      {d.yoe != null && <span className={chip}>{d.yoe} yrs exp</span>}
      {d.ctc && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">₹ {d.ctc}</span>}
    </div>
  )
}

export function PostCard({ d, onChange, onNeedAuth }) {
  return (
    <article className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-400/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <VoteRail d={d} onChange={onChange} onNeedAuth={onNeedAuth} />
      <a href={`/discuss/${d.id}`} className="min-w-0 flex-1" data-track="discuss_open_post">
        <Chips d={d} />
        <h3 className="mt-2 text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">{d.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{d.body}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Avatar author={d.author} size="h-6 w-6 text-[11px]" />
          <span className="font-medium text-slate-700 dark:text-slate-300">{d.author?.name || 'Member'}</span>
          <span>· {ago(d.createdAt)}</span>
          <span className="ml-auto flex gap-3"><span title="Comments">💬 {d.commentCount ?? 0}</span><span title="Views">👁 {d.views}</span></span>
        </div>
      </a>
    </article>
  )
}
