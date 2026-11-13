import { registerSW } from 'virtual:pwa-register'

// Picks up a new release without anyone pressing a hard refresh.
//  1. The service worker is checked for a new version every few minutes and whenever the tab comes back into view. A new worker
//     takes over at once (autoUpdate), and the page reloads itself when that happens.
//  2. Fallback for browsers where the worker is stuck or missing: the page shell is fetched uncached and, when the hashed script it
//     points to differs from the one running, the page reloads.
//  3. A lazy chunk that 404s because it belonged to the old release triggers a reload (once) instead of a blank screen.
// A reload waits while the member is typing (a focused input or textarea), so no draft is lost; it happens on the next check.
const CHECK_MS = 5 * 60 * 1000
const RELOAD_KEY = 'ir_update_reload_at'

const busyTyping = () => {
  const el = document.activeElement
  return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)
}

function reloadSoon() {
  // Never loop: at most one automatic reload per minute.
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
  if (Date.now() - last < 60_000) return
  const go = () => {
    if (busyTyping()) { setTimeout(go, 15_000); return }
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    location.reload()
  }
  go()
}

const runningScript = () => [...document.scripts].map(s => s.src).find(src => /\/assets\/index-[^/]+\.js/.test(src))

async function shellChanged() {
  try {
    const res = await fetch('/index.html', { cache: 'no-store' })
    if (!res.ok) return false
    const m = (await res.text()).match(/\/assets\/index-[^"']+\.js/)
    const current = runningScript()
    return !!(m && current && !current.endsWith(m[0]))
  } catch { return false }
}

export function startAutoUpdate() {
  if (import.meta.env.DEV) return
  let registration
  const check = async () => {
    try { await registration?.update() } catch { /* offline: try again later */ }
    if (await shellChanged()) reloadSoon()
  }
  if ('serviceWorker' in navigator) {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, r) { registration = r },
    })
  }
  setInterval(check, CHECK_MS)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  window.addEventListener('online', check)
  window.addEventListener('vite:preloadError', e => { e.preventDefault(); reloadSoon() })
  setTimeout(check, 20_000)
}
