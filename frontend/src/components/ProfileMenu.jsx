import { useEffect, useRef, useState } from 'react'
import Pic from './Pic.jsx'

// The avatar in the top bar opens this menu (instead of jumping straight to the profile): who you are, your Premium
// status, shortcuts into your profile and practice, then admin, appearance and sign out.
const TILES = [
  ['Progress', '/profile', '📊'],
  ['Flagged', '/profile?tab=flagged', '🚩'],
  ['Important', '/profile?tab=important', '⭐'],
  ['Notes', '/profile?tab=notes', '📝'],
  ['Design practice', '/interview/practice', '🎙️'],
  ['Mock interviews', '/interview', '🎤'],
]

const Icon = ({ d }) => (
  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
)

export default function ProfileMenu({ user, initial, onProfile, isDark, onToggleDark, onAdmin, onLogout, onPremium }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const name = user?.name?.trim() || user?.email || 'Your account'
  const row = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5'

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" title="Account"
        className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-sm font-bold text-white transition-shadow dark:bg-blue-500 ${open || onProfile ? 'ring-2 ring-blue-300/70' : 'hover:ring-2 hover:ring-blue-300/40'}`}>
        <Pic src={user?.picture} fallback={initial} />
      </button>

      {open && (
        <div role="menu" aria-label="Account"
          className="premium-fade fixed inset-x-2 top-16 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[22rem] dark:border-slate-700 dark:bg-slate-900">
          {/* The header opens the profile. The Premium call-to-action sits outside the link (no button inside a link). */}
          <div className="flex items-center gap-3">
            <a href="/profile" role="menuitem" onClick={() => setOpen(false)} title="View your profile"
              className="group -m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-white/5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white transition-shadow group-hover:ring-2 group-hover:ring-blue-300/60"><Pic src={user?.picture} fallback={initial} /></span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300">{name}</span>
                {user?.premium
                  ? <span className="block text-sm font-semibold text-amber-600 dark:text-amber-400">★ Premium member</span>
                  : <span className="block text-xs text-slate-500 dark:text-slate-400">View your profile</span>}
              </span>
              <span aria-hidden="true" className="ml-auto shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600">→</span>
            </a>
          </div>
          {!user?.premium && (
            <button type="button" onClick={() => { setOpen(false); onPremium() }}
              className="mt-2 w-full rounded-lg bg-amber-500/10 px-3 py-1.5 text-left text-sm font-medium text-amber-600 ring-1 ring-amber-500/20 hover:bg-amber-500/20 dark:text-amber-400">
              ★ Access all features with Premium →
            </button>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {TILES.map(([label, href, icon]) => (
              <a key={label} href={href} role="menuitem" onClick={() => setOpen(false)}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-100 px-1 py-3 text-center text-xs font-medium text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
                <span className="text-2xl leading-none" aria-hidden="true">{icon}</span>
                {label}
              </a>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700/70">
            {user?.admin && (
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onAdmin() }} className={row}>
                <Icon d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /> Admin dashboard
              </button>
            )}
            <a href="/leaderboard" role="menuitem" onClick={() => setOpen(false)} className={row}>
              <Icon d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" /> Leaderboard
            </a>
            <a href="/resume" role="menuitem" onClick={() => setOpen(false)} className={row}>
              <Icon d="M7 3h7l5 5v13H7V3zM14 3v5h5M10 13h6M10 17h6" /> Resume builder
            </a>
            <button type="button" role="menuitemcheckbox" aria-checked={isDark} onClick={onToggleDark} className={`${row} justify-between`}>
              <span className="flex items-center gap-3"><Icon d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v18" /> Dark mode</span>
              <span className={`relative h-5 w-9 rounded-full transition-colors ${isDark ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${isDark ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>
            <button type="button" role="menuitem" onClick={onLogout} className={`${row} text-rose-600 dark:text-rose-400`}>
              <Icon d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
