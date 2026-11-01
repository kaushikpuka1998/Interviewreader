import { isLoggedIn, getUser, logout } from '../lib/auth.js'
import { useEffect, useState } from 'react'
import { useFeatures } from '../lib/features.js'
import Notifications from './Notifications.jsx'
import AuthModal from './AuthModal.jsx'

// Shared top bar (LeetCode style): brand and page links on the left, theme toggle, notifications, avatar and log out on the right.
// Used on every full page. The home reader passes its own user and handlers (props below); other pages use the stored session.
// [label, href, feature flag that must be on, flag that turns on the "New" badge]
const NAV = [
  ['Questions', '/questions'],
  ['Problems (Coding)', '/problems', 'code_practice', 'new_badge_code_practice'],
  ['Practice', '/practice', 'code_practice', 'new_badge_code_practice'],
  ['Roadmaps', '/roadmaps', null, null, true],
  ['Interview', '/interview', 'mock_interview', 'new_badge_interview'],
  ['Leaderboard', '/leaderboard'],
  ['Resume', '/resume', 'resume_builder', 'new_badge_resume_builder'],
]

function NavLink({ label, href, flag, badge, premium, path, features, mobile = false }) {
  if (flag && features[flag] === false) return null
  const active = href === '/questions'
    ? !['/', '/problems', '/practice', '/leaderboard', '/resume', '/terms', '/interview', '/roadmaps'].some(p => path === p || path.startsWith(p + '/')) && !['/admin', '/profile', '/u'].some(p => path.startsWith(p))
    : path === href || (href !== '/' && path.startsWith(href + '/'))
  const handleClick = (e) => {
    if (href === '/practice' && typeof window !== 'undefined' && window.location.pathname === '/practice' && window.location.search) {
      e.preventDefault()
      window.history.pushState({}, '', '/practice')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }
  return (
    <a
      href={href}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className={`whitespace-nowrap rounded-lg transition-colors ${mobile ? 'flex items-center px-3 py-2.5 text-base' : 'px-3 py-1.5'} ${active ? 'bg-blue-600/10 font-semibold text-blue-700 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
    >
      {label}
      {premium && <span className="ml-1.5 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">Premium</span>}
      {badge && features[badge] === true && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 align-middle text-[10px] font-bold text-amber-950">New</span>}
    </a>
  )
}

export default function TopBar({ user: userProp, isDark: isDarkProp, onToggleDark: onToggleProp, onLogin, onLogout, onAdmin }) {
  // The theme switch is on every page. The home reader passes its own state; elsewhere the bar flips the same
  // `dark` class and saved 'theme' value that the reader uses, so the choice carries between pages.
  const features = useFeatures()
  const [ownAuthOpen, setOwnAuthOpen] = useState(false) // pages that pass no onLogin get their own sign-in modal
  const [ownDark, setOwnDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const isDark = onToggleProp ? isDarkProp : ownDark
  const onToggleDark = onToggleProp || (() => {
    const next = !ownDark
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
    setOwnDark(next)
  })
  const user = userProp !== undefined ? userProp : getUser()
  const signedIn = userProp !== undefined ? !!userProp : isLoggedIn()
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  const onProfile = path === '/profile' || path.startsWith('/profile/')
  const goAdmin = onAdmin || (() => { window.location.href = '/admin' })
  const doLogout = onLogout || (() => logout({ redirect: '/' }))
  // Below lg the page links live in a menu panel; a phone can't fit seven links in the bar.
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])
  const links = mobile => NAV.map(([label, href, flag, badge, premium]) => (
    <NavLink key={href} label={label} href={href} flag={flag} badge={badge} premium={premium} path={path} features={features} mobile={mobile} />
  ))
  return (
    <>
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <button
          type="button" onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-nav"
          className="-ml-1 shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <a href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100" aria-label="Interview Reader home">
          <img src="/logo.svg" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="hidden whitespace-nowrap sm:inline">Interview Reader</span>
        </a>
        <nav className="hidden min-w-0 items-center gap-1 text-sm lg:flex" aria-label="Main">
          {links(false)}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {(
            <button onClick={onToggleDark} aria-label="Toggle dark mode" aria-pressed={isDark} title="Toggle dark mode" className="rounded-lg bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
              {isDark ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
          )}
          {signedIn && <Notifications />}
          {signedIn && user?.admin && (
            <button onClick={goAdmin} title="Open the admin dashboard" className="rounded-md bg-blue-600/10 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-600/20 dark:text-blue-300">Admin</button>
          )}
          {signedIn ? (
            <>
              <a href="/profile" aria-label="Your profile" title="Your profile" className={`flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white dark:bg-blue-500 ${onProfile ? 'ring-2 ring-blue-300/60' : ''}`}>{initial}</a>
              <button onClick={doLogout} className="whitespace-nowrap rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 dark:hover:bg-red-500">Log out</button>
            </>
          ) : (
            <button onClick={onLogin || (() => setOwnAuthOpen(true))} className="whitespace-nowrap rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-95">
              Log in<span className="hidden sm:inline"> / Sign up</span>
            </button>
          )}
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-slate-200 bg-white px-3 pb-3 pt-2 shadow-lg lg:hidden dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-0.5">{links(true)}</div>
        </nav>
      )}
    </header>
    {ownAuthOpen && <AuthModal onClose={() => setOwnAuthOpen(false)} onSuccess={() => window.location.reload()} />}
    </>
  )
}
