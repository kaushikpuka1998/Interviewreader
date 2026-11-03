import { useEffect } from 'react'

// UTM tags (utm_source, utm_medium, utm_campaign, utm_content) from the landing URL, e.g.
// https://site/?utm_source=college_x&utm_campaign=sept_drive. Last tagged visit wins; it's kept
// in localStorage so tags survive the in-app URL rewrite and later visits until replaced.
const UTM_PARAMS = { utm_source: 'utmSource', utm_medium: 'utmMedium', utm_campaign: 'utmCampaign', utm_content: 'utmContent' }
const UTM_KEY = 'ir_utm'
// Our own links (see resumeBuilderLink) use utm_source=app. They describe where a click came from
// inside the app, so they must not replace a visitor's campaign tags.
const INTERNAL_SOURCE = 'app'

function urlTags() {
  const p = new URLSearchParams(typeof location !== 'undefined' ? location.search : '')
  return Object.entries(UTM_PARAMS).reduce((acc, [k, v]) => (p.get(k) ? { ...acc, [v]: p.get(k).slice(0, 100) } : acc))
}

const initialTags = urlTags()
if (Object.keys(initialTags).length && initialTags.utmSource !== INTERNAL_SOURCE) {
  localStorage.setItem(UTM_KEY, JSON.stringify(initialTags))
}

// Link to the resume builder with a tag for where the click came from (e.g. 'sidebar', 'profile').
export function resumeBuilderLink(placement) {
  return `/resume?utm_source=${INTERNAL_SOURCE}&utm_medium=resume_builder&utm_content=${encodeURIComponent(placement)}`
}

// A friend's invite link (?ref=code) is kept until the visitor signs up, so both of them get the reward.
const REF_KEY = 'ir_ref'
try {
  const r = new URLSearchParams(location.search).get('ref')
  if (r && /^[a-z0-9]{4,12}$/i.test(r)) localStorage.setItem(REF_KEY, r.toLowerCase())
} catch { /* storage blocked: no reward, nothing else breaks */ }
export const getRef = () => { try { return localStorage.getItem(REF_KEY) || undefined } catch { return undefined } }

export function getUtm() {
  try { return JSON.parse(localStorage.getItem(UTM_KEY) || '{}') } catch { return {} }
}

// Lightweight first-party analytics. No cookies and no IP: visitors are counted
// with a random session id kept in localStorage, so the backend stores no PII.

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const SESSION_KEY = 'ir_session_id'

export function sessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now().toString(36))
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function device() {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

// The referrer that brought the visitor to the site, captured once on load —
// client-side navigation would otherwise overwrite it with our own URL.
const initialReferrer = typeof document !== 'undefined' ? document.referrer || '' : ''

// Don't double-count the same question in one session/page-load.
const sent = new Set()

export function trackView({ path, questionId } = {}) {
  try {
    const key = questionId || path || location.pathname
    if (sent.has(key)) return
    sent.add(key)

    const body = JSON.stringify({
      path: path || location.pathname,
      questionId: questionId || null,
      referrer: initialReferrer,
      sessionId: sessionId(),
      device: device(),
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      // Internal tags describe this view only; campaign tags come from storage.
      ...(urlTags().utmSource === INTERNAL_SOURCE ? urlTags() : getUtm()),
    })

    // keepalive lets the view survive page unload; the session cookie attributes it to the account.
    fetch(`${API_BASE}/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // analytics must never break the page
  }
}

// --- engagement events: reads (scroll depth + time) and clicks ---

const queue = []
let flushTimer = null

export function flushEvents() {
  clearTimeout(flushTimer); flushTimer = null
  if (!queue.length) return
  const body = JSON.stringify(queue.splice(0, 50))
  fetch(`${API_BASE}/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
  if (queue.length) flushEvents()
}

// Records a named click, such as a code language being picked. Shows up in the admin "top clicks" list.
export function trackClick(label) {
  trackEvent({ type: 'click', label })
}

function trackEvent(evt) {
  try {
    queue.push({ ...evt, sessionId: sessionId() })
    if (!flushTimer) flushTimer = setTimeout(flushEvents, 15000)
  } catch { /* never break the page */ }
}

// Label a click by its control: explicit data-track, then aria-label/title, then visible text.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (location.pathname.startsWith('/admin')) return
    const el = e.target.closest?.('[data-track], button, a, [role="button"]')
    if (!el) return
    const label = (el.dataset.track || el.getAttribute('aria-label') || el.title || el.innerText || '')
      .replace(/\s+/g, ' ').trim().slice(0, 80)
    if (label) trackEvent({ type: 'click', label })
  }, { capture: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents()
  })
}

/**
 * Records how long a question was actually on screen (tab visible) and how far its
 * answer was scrolled. Emits one `read` event when the question changes, the
 * component unmounts, or the tab is hidden (the only reliable signal before close).
 */
export function useReadTracking(questionId, scrollRef) {
  useEffect(() => {
    if (!questionId) return
    let maxScroll = 0
    let seconds = 0
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : null

    const el = scrollRef.current
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      const pct = max <= 0 ? 100 : Math.round((el.scrollTop / max) * 100)
      if (pct > maxScroll) maxScroll = pct
    }
    // Content shorter than the pane counts as fully seen; measure once it has rendered.
    const measure = setTimeout(() => el && onScroll(), 500)
    el?.addEventListener('scroll', onScroll, { passive: true })

    const emit = () => {
      if (visibleSince) { seconds += (Date.now() - visibleSince) / 1000; visibleSince = null }
      if (seconds >= 2) trackEvent({ type: 'read', questionId, scrollPct: maxScroll, seconds: Math.round(seconds) })
      seconds = 0
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { emit(); flushEvents() }
      else visibleSince = Date.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimeout(measure)
      el?.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      emit()
    }
  }, [questionId])
}

// --- admin reads ---

export async function fetchAnalytics(days = 30) {
  const res = await fetch(`${API_BASE}/analytics/summary?days=${days}`)
  if (!res.ok) throw new Error(res.status === 403 ? 'Admin access required' : 'Failed to load analytics')
  return res.json()
}

// Admin: visitor-to-member funnel, with likely bots left out, split by source and device.
export async function fetchFunnel(days = 30) {
  const res = await fetch(`${API_BASE}/analytics/funnel?days=${days}`)
  if (!res.ok) throw new Error('Failed to load the funnel')
  return res.json()
}

// Admin: who is online right now. Members by name and email, visitors as a count.
export async function fetchOnline() {
  const res = await fetch(`${API_BASE}/analytics/online`)
  if (!res.ok) throw new Error('Failed to load who is online')
  return res.json()
}

export async function fetchSignups(since, limit = 20) {
  const q = new URLSearchParams({ limit: String(limit) })
  if (since) q.set('since', since)
  const res = await fetch(`${API_BASE}/analytics/signups?${q}`)
  if (!res.ok) throw new Error('Failed to load signups')
  return res.json()
}

// Admin: who is using the daily challenge, who only reads vs only solves, code practice usage, and top referrers.
export async function fetchEngagementBreakdown(days = 30) {
  const res = await fetch(`${API_BASE}/analytics/engagement?days=${days}`)
  if (!res.ok) throw new Error('Failed to load engagement breakdown')
  return res.json()
}
