// Every request to our API sends the HttpOnly session cookies and keeps the session alive. Done once here
// instead of in each of the ~100 fetch calls, so a new call can't forget it. Requests to other hosts are
// left untouched. Imported first in main.jsx, before any module can fetch.
//
// The access cookie lasts minutes; the refresh cookie (sent only to /auth) renews it. A signed-in page
// refreshes just before the access token runs out, and once more if a request still comes back 401.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const USER_KEY = 'ir_user'
const EXP_KEY = 'ir_session_exp'   // when the access cookie expires (epoch ms); not a secret
const nativeFetch = window.fetch.bind(window)

// Saves the profile and access expiry from a login, sign-up or refresh response.
export function saveSession({ email, name, admin, premium, accessExpiresAt, picture }) {
  localStorage.setItem(USER_KEY, JSON.stringify({ email, name, admin: !!admin, premium: !!premium, picture: picture || null }))
  if (accessExpiresAt) localStorage.setItem(EXP_KEY, String(accessExpiresAt))
}

let refreshing = null
// One refresh at a time per tab; every request waiting on it shares the result. True when renewed.
export function refreshSession() {
  refreshing ||= nativeFetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async res => {
      if (res.ok) { saveSession(await res.json()); return true }
      // No usable refresh token (e.g. signed in before refresh tokens existed): don't retry on every request.
      localStorage.setItem(EXP_KEY, String(Date.now() + 5 * 60_000))
      return false
    })
    .catch(() => false)
    .finally(() => { refreshing = null })
  return refreshing
}

window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || String(input)
  if (!url.startsWith(API_BASE)) return nativeFetch(input, init)
  const send = () => nativeFetch(input, { credentials: 'include', ...init })
  const managed = !!localStorage.getItem(USER_KEY) && !url.startsWith(`${API_BASE}/auth/`)
  if (managed && Date.now() > Number(localStorage.getItem(EXP_KEY) || 0) - 30_000) await refreshSession()
  const res = await send()
  if (res.status === 401 && managed && await refreshSession()) return send()
  return res
}
