import { useEffect, useState } from 'react'
import { getUser, isLoggedIn, fetchProfilePrompt, markProfilePromptSeen, savePublicDetails } from '../lib/auth.js'
import { parseGithub, parseLinkedin } from '../lib/profileLinks.js'

const QUIET = ['/admin', '/profile', '/u/', '/interview/live', '/reset-password', '/terms']
const doneKey = () => `ir_profile_prompt_done:${(getUser()?.email || '').toLowerCase()}`
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

// A small floating card, shown once ever, to a signed-in member who has been reading questions or solving problems but has not added
// a college, GitHub or LinkedIn: it invites them to fill those in (they appear on their public profile). The server decides when it is
// due (see ProfileController#prompt) and remembers that it was shown, so it never returns, on any device.
export default function ProfilePromptGate() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!isLoggedIn() || QUIET.some(p => location.pathname.startsWith(p))) return
    try { if (localStorage.getItem(doneKey())) return } catch { return }
    let t, tries = 0, dead = false
    // Wait a while after the page opens, and never on top of another dialog (the login promos come first).
    const attempt = () => {
      if (dead) return
      if (document.querySelector('[role="dialog"]') && tries++ < 6) { t = setTimeout(attempt, 10000); return }
      fetchProfilePrompt().then(r => {
        if (dead) return
        if (r.done) { try { localStorage.setItem(doneKey(), '1') } catch { /* ask the server again next time */ } }
        else if (r.show) setOpen(true)
      }).catch(() => {})
    }
    t = setTimeout(attempt, 15000)
    return () => { dead = true; clearTimeout(t) }
  }, [])
  if (!open) return null
  return <ProfilePromptCard onClose={() => { try { localStorage.setItem(doneKey(), '1') } catch { /* it is also recorded on the server */ } setOpen(false) }} />
}

export function ProfilePromptCard({ onClose }) {
  const [f, setF] = useState({ college: '', github: '', linkedin: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const gh = parseGithub(f.github), li = parseLinkedin(f.linkedin)
  const any = f.college.trim() || f.github.trim() || f.linkedin.trim()
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }))
  const dismiss = () => { markProfilePromptSeen(); onClose() }
  const save = async e => {
    e.preventDefault()
    if (!any) return setError('Add at least one, or choose Maybe later.')
    if (!gh.ok || !li.ok) return setError(gh.error || li.error)
    setBusy(true); setError('')
    try {
      // Only these three are sent; anything else already on the profile is left alone.
      await savePublicDetails({ college: f.college, github: f.github, linkedin: f.linkedin })
      markProfilePromptSeen()
      setSaved(true)
    } catch (x) { setError(x.message); setBusy(false) }
  }
  return (
    <aside aria-label="Complete your profile" className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-emerald-700/20 bg-white shadow-2xl shadow-emerald-900/20 dark:border-slate-700 dark:bg-slate-900">
      <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl dark:bg-emerald-500/15" aria-hidden="true">{saved ? '✅' : '🎓'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{saved ? 'Profile updated' : 'Let others find you'}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{saved ? 'Your details now show on your public profile.' : "You're making progress. Add where you study and where to find you; it shows on your public profile."}</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Close" className="-mr-1 -mt-1 rounded p-1 text-lg leading-none text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">×</button>
        </div>
        {saved ? (
          <div className="mt-3 flex gap-2">
            <a href="/profile" onClick={onClose} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700">See my profile</a>
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Close</button>
          </div>
        ) : (
          <form onSubmit={save} className="mt-3 space-y-2">
            <input className={input} value={f.college} onChange={set('college')} maxLength={120} placeholder="🎓 College or university" aria-label="College" />
            <div>
              <input className={`${input} ${gh.ok ? '' : '!border-rose-500'}`} value={f.github} onChange={set('github')} maxLength={80} placeholder="GitHub username or link" aria-label="GitHub" autoComplete="off" />
              {!gh.ok && <p className="mt-0.5 text-[11px] text-rose-600">{gh.error}</p>}
            </div>
            <div>
              <input className={`${input} ${li.ok ? '' : '!border-rose-500'}`} value={f.linkedin} onChange={set('linkedin')} maxLength={160} placeholder="LinkedIn profile link" aria-label="LinkedIn" autoComplete="off" />
              {!li.ok && <p className="mt-0.5 text-[11px] text-rose-600">{li.error}</p>}
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex items-center gap-2 pt-1">
              <button type="submit" disabled={busy || !gh.ok || !li.ok} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" data-track="profile_prompt_save">{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" data-track="profile_prompt_later">Maybe later</button>
            </div>
          </form>
        )}
      </div>
    </aside>
  )
}
