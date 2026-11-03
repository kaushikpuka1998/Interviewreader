import ProfileGrowth from './ProfileGrowth.jsx'
import ShareLinkedIn from './ShareLinkedIn.jsx'
import { useState, useEffect, useRef } from 'react'
import Pic from './Pic.jsx'
import PublicDetailsDialog from './PublicDetailsDialog.jsx'
import { isLoggedIn, getUser, logout, fetchDashboard, fetchProfileQuestions, updateLocation } from '../lib/auth.js'
import { fetchQuestions } from '../lib/api.js'
import { fetchSolvedIds } from '../lib/code.js'
import { fetchCodingProblems } from '../lib/codingProblems.js'
import { slugify } from '../lib/slug.js'
import { techBadge, difficultyBadge, techLabel } from '../lib/badges.js'
import AuthModal from './AuthModal.jsx'
import LeagueBadge from './LeagueBadge.jsx'
import TopBar from './TopBar.jsx'
import PieChart, { toHex, countBy } from './PieChart.jsx'
import Markdown from './Markdown.jsx'
import ActivityHeatmap from './ActivityHeatmap.jsx'
import { resumeBuilderLink } from '../lib/analytics.js'
import { updateUsername, fetchNotes, saveNote, removeNote, uploadAvatar, removeAvatar } from '../lib/auth.js'
import { cancelSubscription, cancelPracticePlan, cancelInterviewPlan, PREMIUM_PLAN_NAMES } from '../lib/billing.js'
import { fetchInterviewQuota } from '../lib/interviews.js'
import { fetchPracticeQuota } from '../lib/designPractice.js'
import { fetchPoints } from '../lib/points.js'

export const TECH_COLOR = {
  java: 'bg-orange-500', react: 'bg-cyan-500', node: 'bg-green-500', sql: 'bg-purple-500',
  hld: 'bg-indigo-500', kafka: 'bg-slate-500', golang: 'bg-sky-500',
}
export const DIFF_COLOR = {
  Basic: 'bg-green-500', Intermediate: 'bg-amber-500', Advanced: 'bg-rose-500', Experienced: 'bg-purple-500',
}

// "Where are you from?" — what the user typed wins; otherwise shows the IP-based guess.
const NOTE_MAX = 5000
const NOTE_TITLE_MAX = 120

// One note: a formatted view, or an editor with a live Markdown preview beside it.
// Opens the form for the optional details shown on the public profile; reloads after saving so the page and its preview are current.
function PublicDetailsButton({ details, username }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30">
        {details ? 'Edit public details' : 'Add public details'}
      </button>
      {open && <PublicDetailsDialog details={details} username={username} onClose={() => setOpen(false)} onSaved={() => window.location.reload()} />}
    </>
  )
}

// Profile picture: choose a file (PNG, JPEG or GIF, any size up to 5 MB; the server crops it square and shrinks it) or remove the upload.
// A Google sign-in picture is used until a picture is uploaded. The page reloads after a change so the top bar shows it too.
function PhotoControls({ hasUploaded, hasAny }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)
  const run = async (fn) => {
    setBusy(true); setError('')
    try { await fn(); window.location.reload() } catch (e) { setError(e.message); setBusy(false) }
  }
  const btn = 'rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30'
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/gif" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(() => uploadAvatar(f)) }} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={btn}>{busy ? 'Saving…' : hasAny ? 'Change photo' : 'Add photo'}</button>
      {hasUploaded && <button type="button" disabled={busy} onClick={() => run(removeAvatar)} className={btn}>Remove photo</button>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  )
}

function NoteEditor({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [body, setBody] = useState(initial?.body || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setBusy(true); setError('')
    try { await onSave({ title, body }) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-950 p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value.slice(0, NOTE_TITLE_MAX))}
          placeholder="Note title"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <span className="text-xs tabular-nums text-slate-400">{body.length}/{NOTE_MAX}</span>
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
        <button onClick={save} disabled={busy || !body.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <p className="mb-3 text-xs text-slate-400">Only you can see this. Markdown works: # heading, **bold**, - lists, `code`.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value.slice(0, NOTE_MAX))}
          rows={14}
          placeholder={'# Topic\n\n- Point one\n- Point two'}
          className="min-h-[18rem] w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="min-h-[18rem] overflow-auto rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
          {body.trim() ? <Markdown text={body} /> : <p className="text-sm text-slate-400">Preview appears here.</p>}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

// The member's private notes: a list of formatted notes, with add, edit and delete.
function PersonalNotes() {
  const [notes, setNotes] = useState(null)
  const [editing, setEditing] = useState(null)   // null | 'new' | note id
  const [error, setError] = useState('')

  useEffect(() => {
    fetchNotes().then(setNotes).catch(e => setError(e.message))
  }, [])

  const save = async (id, data) => {
    const saved = await saveNote(id, data)
    setNotes(list => id ? list.map(n => (n.id === id ? saved : n)) : [saved, ...list])
    setEditing(null)
  }
  const remove = async (id) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return
    try { await removeNote(id); setNotes(list => list.filter(n => n.id !== id)) }
    catch (e) { setError(e.message) }
  }

  if (error && !notes) return <p className="text-sm text-slate-500">{error}</p>
  if (!notes) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My notes <span className="text-slate-400 font-normal">({notes.length})</span></h2>
        {editing !== 'new' && (
          <button onClick={() => setEditing('new')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">New note</button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {editing === 'new' && <NoteEditor onSave={(d) => save(null, d)} onCancel={() => setEditing(null)} />}

      {notes.length === 0 && editing !== 'new' && (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
          No notes yet. Keep track of what you're preparing for, goals, or things to revisit.
        </p>
      )}

      {notes.map(n => editing === n.id ? (
        <NoteEditor key={n.id} initial={n} onSave={(d) => save(n.id, d)} onCancel={() => setEditing(null)} />
      ) : (
        <article key={n.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</h3>
              <p className="text-xs text-slate-400">Updated {new Date(n.updatedAt).toLocaleString()}</p>
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => setEditing(n.id)} className="font-medium text-blue-600 hover:underline dark:text-blue-400">Edit</button>
              <button onClick={() => remove(n.id)} className="font-medium text-red-600 hover:underline dark:text-red-400">Delete</button>
            </div>
          </div>
          <Markdown text={n.body} />
        </article>
      ))}
    </section>
  )
}

// Public handle for the /u/ link. Changing it retires the old link.
function UsernameEditor({ username, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(username || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault(); setError(''); setBusy(true)
    try { const r = await updateUsername(value.trim()); onSaved(r.username); setEditing(false) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  if (editing) return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className="text-xs text-slate-500">/u/</span>
      <input className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-40" value={value} onChange={e => setValue(e.target.value)} aria-label="Username" />
      <button type="submit" disabled={busy} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Save</button>
      <button type="button" onClick={() => { setValue(username || ''); setEditing(false); setError('') }} className="text-xs text-slate-500 hover:underline">Cancel</button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </form>
  )
  return (
    <div className="flex items-center gap-2">
      {username ? (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">/u/{username}</span>
      ) : (
        <span className="text-xs text-slate-400">No username yet</span>
      )}
      <button onClick={() => setEditing(true)} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">Change</button>
    </div>
  )
}

function LocationEditor({ profile }) {
  const [editing, setEditing] = useState(false)
  const [loc, setLoc] = useState({ country: profile.country || '', city: profile.city || '', locationSource: profile.locationSource || '' })
  const [form, setForm] = useState(loc)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault(); setError('')
    if (!form.country.trim() || !form.city.trim()) return setError('Both country and city are required')
    try { const saved = await updateLocation(form); setLoc(saved); setForm(saved); setEditing(false) }
    catch (err) { setError(err.message) }
  }

  const input = 'px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-28'
  if (editing) return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-1.5 mt-1">
      <input className={input} placeholder="Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} aria-label="Country" />
      <input className={input} placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} aria-label="City" />
      <button type="submit" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Save</button>
      <button type="button" onClick={() => { setForm(loc); setEditing(false) }} className="text-xs text-slate-500 hover:underline">Cancel</button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </form>
  )
  const place = [loc.city, loc.country].filter(Boolean).join(', ')
  return (
    <p className="text-xs text-slate-400 mt-0.5">
      {place ? <>📍 {place}{loc.locationSource === 'ip' && ' (detected)'}</> : 'Location not set'}
      {' · '}
      <button onClick={() => setEditing(true)} className="text-blue-600 dark:text-blue-400 hover:underline">
        {place ? 'Edit' : 'Add location'}
      </button>
    </p>
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent || 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function ProgressBar({ label, total, solved, color }) {
  const pct = total ? Math.round((solved / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-slate-500 dark:text-slate-400">{solved}/{total} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color || 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Fixed height so the lists line up; long lists scroll inside their card.
// fixed={false} sizes the card to its contents (used for the full-width Important card).
function QuestionList({ title, items, emptyText, fixed = true, bare = false }) {
  if (bare) {
    // Inside the tabbed panel: no card or heading, just the rows filling the panel and scrolling.
    return items.length === 0
      ? <p className="text-sm text-slate-400">{emptyText}</p>
      : (
        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {items.map(q => (
            <li key={q.id}>
              <a href={`/${slugify(q.question || q.title)}?id=${q.id}`} className="group flex items-center justify-between gap-3 py-1.5">
                <span className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">{q.title}</span>
                <span className="flex flex-shrink-0 gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${techBadge(q.tech)}`}>{techLabel(q.tech)}</span>
                  {q.difficulty && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${difficultyBadge(q.difficulty)}`}>{q.difficulty}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )
  }
  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 ${fixed ? 'h-[26rem]' : ''}`}>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">{title} <span className="text-slate-400 font-normal">({items.length})</span></h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className={`divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto ${fixed ? 'min-h-0 flex-1' : 'max-h-80'}`}>
          {items.map((q) => (
            <li key={q.id} className="py-2">
              <a href={`/${slugify(q.question || q.title)}?id=${q.id}`} className="block group">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {q.title}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${techBadge(q.tech)}`}>
                    {techLabel(q.tech)}
                  </span>
                  {q.difficulty && (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${difficultyBadge(q.difficulty)}`}>
                      {q.difficulty}
                    </span>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Last dashboard this browser saw for the account: shown at once, refreshed in the background.
const readDashboardCache = () => {
  try {
    const email = getUser()?.email
    return email ? JSON.parse(localStorage.getItem(`ir_dash_${email}`) || 'null') : null
  } catch { return null }
}

export default function ProfilePage() {
  const [cache] = useState(() => (isLoggedIn() ? readDashboardCache() : null))
  const [profile, setProfile] = useState(() => cache?.me ?? null)
  const [solved, setSolved] = useState(() => cache?.solved ?? [])
  const [visited, setVisited] = useState(() => cache?.visited ?? [])
  const [coding, setCoding] = useState(null)   // { solved, total } for the coding problems
  const [visitedLoaded, setVisitedLoaded] = useState(false)   // the visited list loads when its tab is opened
  // Which tab of the bottom panel is open; /profile?tab=notes (from the account menu) opens that tab.
  const [listFilter, setListFilter] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    return ['solved', 'visited', 'flagged', 'important', 'notes'].includes(t) ? t : 'solved'
  })
  useEffect(() => {
    if (listFilter !== 'visited' || visitedLoaded) return
    let alive = true
    fetchProfileQuestions('visited').then(list => { if (alive) { setVisited(list); setVisitedLoaded(true) } })
    return () => { alive = false }
  }, [listFilter, visitedLoaded])
  const [flagged, setFlagged] = useState(() => cache?.flagged ?? [])
  const [important, setImportant] = useState(() => cache?.important ?? [])
  const [loading, setLoading] = useState(() => !cache)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [handle, setHandle] = useState('')
  useEffect(() => { if (profile?.username) setHandle(profile.username) }, [profile])

  useEffect(() => {
    if (!isLoggedIn()) return
    Promise.all([fetchSolvedIds(), fetchCodingProblems()])
      .then(([ids, all]) => setCoding({ solved: ids.length, total: all.length }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isLoggedIn()) { setLoading(false); return }
    let cancelled = false
    fetchDashboard()
      .then((d) => {
        if (cancelled) return
        setProfile(d.me); setSolved(d.solved); setImportant(d.important); setFlagged(d.flagged)
        setLoading(false)
        localStorage.setItem(`ir_dash_${d.me.email}`, JSON.stringify(d))
      })
      .catch((e) => { if (!cancelled) { if (!cache) setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (!isLoggedIn()) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300 mb-4">Log in to view your profile and progress.</p>
        <AuthModal onClose={() => { window.location.href = '/' }} onSuccess={() => window.location.reload()} />
      </Shell>
    )
  }

  if (loading) return <Shell><ProfileSkeleton /></Shell>
  if (error) return <Shell><p className="text-red-500">{error}</p></Shell>
  if (!profile) return <Shell><p className="text-slate-500">No profile data.</p></Shell>

  const { username, name, email, totalQuestions, visitedCount, solvedCount, byTech = [], byDifficulty = [], memberSince } = profile
  const copyLink = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/u/${handle}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    })
  }
  const solvedPct = totalQuestions ? Math.round((solvedCount / totalQuestions) * 100) : 0

  const tabs = [
    ['solved', 'Solved', solved.length], ['visited', 'Visited', visitedCount], ['flagged', 'Flagged', flagged.length],
    ['important', 'Important', important.length], ['notes', 'Notes'],
  ]
  const topics = byTech.filter(t => t.solved > 0).sort((x, y) => y.solved - x.solved)

  // One screen on desktop: identity, six small stats, two breakdown cards, then a tabbed panel that scrolls inside itself.
  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <a href="/leaderboard" title="View leaderboard" className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white hover:opacity-90">
          <Pic src={profile.picture} fallback={(name || email || '?').trim().charAt(0).toUpperCase()} />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{name || 'Learner'}</h1>
            <span className="break-all text-xs text-slate-500 dark:text-slate-400">{email}</span>
            {memberSince && <span className="text-xs text-slate-400">since {new Date(memberSince).toLocaleDateString()}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <PhotoControls hasUploaded={!!profile.hasUploadedPicture} hasAny={!!profile.picture} />
            <PublicDetailsButton details={profile.details} username={handle} />
            <UsernameEditor username={handle} onSaved={setHandle} />
            {handle && (
              <>
                <button onClick={copyLink} className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30">
                  {copied ? 'Link copied!' : 'Copy link'}
                </button>
                <a href={`/u/${handle}`} target="_blank" rel="noopener noreferrer" aria-label="Open your public profile" title="Open your public profile" className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30">
                  Open ↗
                </a>
              </>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400"><LocationEditor profile={profile} /></span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <PremiumStatus profile={profile} />
          <PracticePlanStatus />
          <InterviewPlanStatus />
          {profile.league && (
            <a href="/leaderboard" title="View leaderboard" className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
              <LeagueBadge league={profile.league} size="xs" />
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{profile.league}</span>
                <span className="block text-[11px] tabular-nums text-slate-500 dark:text-slate-400">{profile.weeklyXp} points this week</span>
              </span>
            </a>
          )}
          <a href={resumeBuilderLink('profile')} className="whitespace-nowrap rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-95">Build your resume →</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ['Solved', solvedCount, `${solvedPct}% of ${totalQuestions}`, 'text-green-600 dark:text-green-400'],
          ['Visited', visitedCount, `of ${totalQuestions}`, 'text-blue-600 dark:text-blue-400'],
          ['Flagged', flagged.length, '', 'text-amber-600 dark:text-amber-400'],
          ['Important', important.length, '', 'text-rose-600 dark:text-rose-400'],
          ['Remaining', Math.max(totalQuestions - solvedCount, 0), '', ''],
          ['Coding solved', coding ? coding.solved : '—', coding ? `of ${coding.total}` : '', 'text-emerald-600 dark:text-emerald-400'],
          ['Topics', topics.length, `of ${byTech.length}`, 'text-violet-600 dark:text-violet-400'],
        ].map(([label, value, sub, accent]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`text-2xl font-bold leading-tight tabular-nums ${accent || 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{sub || '\u00a0'}</p>
          </div>
        ))}
      </div>

      <ProfileGrowth username={handle} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StreakCard />
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Solved by technology</h3>
          {topics.length === 0 ? <p className="text-sm text-slate-400">Nothing solved yet.</p> : (
            <div className="max-h-24 space-y-1.5 overflow-y-auto pr-1">
              {topics.map(t => <ProgressBar key={t.tech} label={techLabel(t.tech)} solved={t.solved} total={t.total} color={TECH_COLOR[t.tech]} />)}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Solved by difficulty</h3>
          <div className="max-h-24 space-y-1.5 overflow-y-auto pr-1">
            {['Basic', 'Intermediate', 'Advanced'].map(d => byDifficulty.find(x => x.difficulty === d)).filter(Boolean).map(d => (
              <ProgressBar key={d.difficulty} label={d.difficulty} solved={d.solved} total={d.total} color={DIFF_COLOR[d.difficulty]} />
            ))}
          </div>
        </div>
      </div>

      {/* Always visible: the activity calendar sits above the tabs */}
      <div className="flex"><ActivityHeatmap compact /></div>

      <div className="flex h-36 min-h-[7.5rem] flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 lg:h-auto lg:flex-1">
        <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Your activity">
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={listFilter === key}
              onClick={() => setListFilter(key)}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${listFilter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
            >
              {label}{count !== undefined && <span className="tabular-nums opacity-80"> ({count})</span>}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {listFilter === 'solved' && <QuestionList bare items={solved} emptyText="Nothing solved yet — mark questions as read to track them." />}
          {listFilter === 'visited' && <QuestionList bare items={visited} emptyText={visitedLoaded ? 'No visited questions yet.' : 'Loading visited questions…'} />}
          {listFilter === 'flagged' && <QuestionList bare items={flagged} emptyText="No flagged questions yet." />}
          {listFilter === 'important' && <QuestionList bare items={important} emptyText="No questions marked important yet." />}
          {listFilter === 'notes' && <PersonalNotes />}
        </div>
      </div>
    </Shell>
  )
}

// Mirrors the real layout's sizes so something substantial paints immediately,
// instead of the page's biggest content waiting on the network (hurts LCP).
function ProfileSkeleton() {
  const block = 'animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60'
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-40 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-56 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${block} h-24`} />)}
      </div>
      <div className={`${block} h-16 mb-8`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className={`${block} h-48`} />
        <div className={`${block} h-48`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${block} h-64`} />
        <div className={`${block} h-64`} />
        <div className={`${block} h-64`} />
      </div>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4">
        {children}
      </div>
    </div>
  )
}

// Streak and points: current and best streak, this week's points by kind, the next milestone.
const KIND = { login: ['📅', 'Daily sign-ins'], read: ['📖', 'New questions read'], solve: ['💻', 'Problems solved'], streak: ['🔥', 'Streak bonuses'] }
function StreakCard() {
  const [d, setD] = useState(null)
  useEffect(() => { fetchPoints().then(setD).catch(() => {}) }, [])
  return (
    <div className="rounded-xl border border-orange-200/70 bg-gradient-to-br from-orange-50 to-white p-3 dark:border-orange-500/20 dark:from-orange-500/10 dark:to-slate-950">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Streak & points</h3>
        <span className="flex gap-3 text-[11px] font-semibold"><a href="/streak" className="text-orange-600 hover:underline dark:text-orange-400">History →</a><a href="/leaderboard" className="text-orange-600 hover:underline dark:text-orange-400">Leaderboard →</a></span>
      </div>
      {!d ? <p className="text-sm text-slate-400">Loading…</p> : (
        <>
          <div className="flex items-end gap-4">
            <div><p className="text-2xl font-bold tabular-nums text-orange-500">🔥 {d.streak}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">day streak · best {d.best}</p></div>
            <div><p className="text-2xl font-bold tabular-nums text-amber-500">⭐ {d.weekPoints}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">this week · {d.totalPoints} all time</p></div>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
            {Object.entries(KIND).map(([k, [icon, label]]) => (
              <li key={k} className="flex justify-between"><span>{icon} {label}</span><span className="font-semibold tabular-nums">{d.weekBreakdown?.[k]?.points || 0}</span></li>
            ))}
          </ul>
          {d.nextMilestone && <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{d.nextMilestone.daysLeft} more day{d.nextMilestone.daysLeft > 1 ? 's' : ''} to a {d.nextMilestone.days}-day streak: <span className="font-semibold text-amber-600 dark:text-amber-400">+{d.nextMilestone.bonus}</span></p>}
          {d.username && (
            <ShareLinkedIn progress={{ username: d.username, streak: d.best, points: d.totalPoints }} label="Share my progress certificate"
              className="mt-3 w-full justify-center !min-h-0 py-2 text-xs font-semibold" />
          )}
        </>
      )}
    </div>
  )
}

// Premium (paid roadmaps): pass and end date. Cancel only applies to the older recurring subscription. Non-members get a link to the upsell.
function PremiumStatus({ profile }) {
  const [status, setStatus] = useState(profile.subscriptionStatus)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const until = profile.premiumUntil ? new Date(profile.premiumUntil).toLocaleDateString() : ''
  if (!profile.premium) {
    return <a href="/roadmaps" className="rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 px-2.5 py-1 text-xs font-bold text-white hover:opacity-90">★ Get Premium</a>
  }
  const cancel = async () => {
    if (!window.confirm(`Cancel Premium? You keep access until ${until || 'the end of this billing period'}.`)) return
    setBusy(true); setErr('')
    try { setStatus((await cancelSubscription()).status) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 px-2.5 py-1 text-xs dark:border-amber-500/30">
      <span className="font-bold text-amber-600 dark:text-amber-400">★ Premium{profile.premiumPlan ? ` · ${PREMIUM_PLAN_NAMES[profile.premiumPlan] || profile.premiumPlan}` : ''}</span>
      {until && profile.premiumPlan !== 'lifetime' && <span className="text-slate-500 dark:text-slate-400">{status === 'active' ? 'renews' : 'until'} {until}</span>}
      {status === 'active' && (
        <button onClick={cancel} disabled={busy} className="text-slate-400 underline hover:text-rose-500 disabled:opacity-50">{busy ? 'Cancelling…' : 'Cancel'}</button>
      )}
      {err && <span className="text-rose-500">{err}</span>}
    </span>
  )
}

// Peer mock interview plan (separate from Premium, which includes a few a month): left this period, renewal, cancel.
function InterviewPlanStatus() {
  const [quota, setQuota] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { fetchInterviewQuota().then(setQuota).catch(() => {}) }, [])
  if (!quota || quota.unlimited || !quota.plan) return null
  const until = quota.periodEnd ? new Date(quota.periodEnd).toLocaleDateString() : ''
  const cancelled = quota.status === 'cancelled'
  const cancel = async () => {
    if (!window.confirm(`Cancel your interview plan? Your remaining interviews stay bookable until ${until}.`)) return
    setBusy(true); setErr('')
    try { await cancelInterviewPlan(); setQuota(await fetchInterviewQuota()) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-300/60 px-2.5 py-1 text-xs dark:border-blue-500/30">
      <a href="/interview" className="font-bold text-blue-600 hover:underline dark:text-blue-400">🎤 Interviews {quota.planInterviews}</a>
      <span className="text-slate-500 dark:text-slate-400">{quota.planLeft}/{quota.planInterviews} left · {cancelled ? 'ends' : 'renews'} {until}</span>
      {!cancelled && <button onClick={cancel} disabled={busy} className="text-slate-400 underline hover:text-rose-500 disabled:opacity-50">{busy ? 'Cancelling…' : 'Cancel'}</button>}
      {err && <span className="text-rose-500">{err}</span>}
    </span>
  )
}

// System design practice plan (separate from Premium): attempts left this month, renewal, cancel.
function PracticePlanStatus() {
  const [quota, setQuota] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { fetchPracticeQuota().then(setQuota).catch(() => {}) }, [])
  if (!quota || quota.unlimited) return null
  if (!quota.plan) {
    return <a href="/interview/practice" className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">🎙 Design practice · {quota.freeLeft} free left</a>
  }
  const until = quota.periodEnd ? new Date(quota.periodEnd).toLocaleDateString() : ''
  const cancelled = quota.status === 'cancelled'
  const cancel = async () => {
    if (!window.confirm(`Cancel your practice plan? Your remaining attempts stay usable until ${until}.`)) return
    setBusy(true); setErr('')
    try { await cancelPracticePlan(); setQuota(await fetchPracticeQuota()) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-300/60 px-2.5 py-1 text-xs dark:border-violet-500/30">
      <a href="/interview/practice" className="font-bold text-violet-600 hover:underline dark:text-violet-400">🎙 Practice {quota.planAttempts}</a>
      <span className="text-slate-500 dark:text-slate-400">{quota.planLeft}/{quota.planAttempts} left · {cancelled ? 'ends' : 'renews'} {until}</span>
      {!cancelled && <button onClick={cancel} disabled={busy} className="text-slate-400 underline hover:text-rose-500 disabled:opacity-50">{busy ? 'Cancelling…' : 'Cancel'}</button>}
      {err && <span className="text-rose-500">{err}</span>}
    </span>
  )
}
