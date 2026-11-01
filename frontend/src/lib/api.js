// Backend API integration for the questions service.
import { getAllCachedQuestions } from './offlineStore.js'

// Cached questions are the whole synced set, so signed-out callers only get the free topics
// (saved from /questions/stats by the app). Signed-in callers get everything.
function visibleOffline(items) {
  if (localStorage.getItem('ir_token')) return items
  const free = JSON.parse(localStorage.getItem('ir_free_techs') || '[]')
  return items.filter(q => free.includes(q.tech))
}

export const PAGE = 50
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// True for a dropped connection, not for a real server error (4xx/5xx) — those
// should still surface normally rather than silently falling back to stale data.
function isOffline(err) {
  return !navigator.onLine || err instanceof TypeError
}

export async function fetchQuestion(id) {
  const token = localStorage.getItem('ir_token')
  try {
    const res = await fetch(`${API_BASE}/questions/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 404) {
      const err = new Error('Question not found')
      err.notFound = true           // App shows the 404 state for a bad link
      throw err
    }
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}))
      const err = new Error(body.message || 'Sign in to read this question')
      err.signupRequired = true     // App keeps the URL and shows the sign-in prompt for this question
      err.tech = body.tech
      throw err
    }
    if (!res.ok) throw new Error('Failed to fetch question')
    return await res.json()
  } catch (err) {
    if (err.signupRequired || !isOffline(err)) throw err
    const cached = visibleOffline(await getAllCachedQuestions()).find(q => q.id === id)
    if (cached) return cached
    throw err
  }
}

export async function fetchQuestions(opts) {
  const { tech, category, difficulty, company, search, status, visitedIds, readIds, flaggedIds, importantIds, page = 0, size = PAGE } = opts
  // Always send IDs when status filter is active for correct pagination
  const shouldSendIds = status && status !== 'all'

  const params = new URLSearchParams()
  if (tech && tech !== 'all') params.set('tech', tech)
  if (category && category !== 'all') params.set('category', category)
  if (difficulty && difficulty !== 'all') params.set('difficulty', difficulty)
  if (company && company !== 'all') params.set('company', company)
  if (search) params.set('search', search)
  if (status && status !== 'all') params.set('status', status)
  if (shouldSendIds && visitedIds && visitedIds.length > 0) params.set('visitedIds', visitedIds.join(','))
  if (shouldSendIds && readIds && readIds.length > 0) params.set('readIds', readIds.join(','))
  if (shouldSendIds && flaggedIds && flaggedIds.length > 0) params.set('flaggedIds', flaggedIds.join(','))
  if (shouldSendIds && importantIds && importantIds.length > 0) params.set('importantIds', importantIds.join(','))
  params.set('page', page)
  params.set('size', size)
  const token = localStorage.getItem('ir_token')
  try {
    const res = await fetch(`${API_BASE}/questions?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}))
      const err = new Error(body.message || 'Create a free account to view this topic')
      err.signupRequired = true          // App shows the sign-up prompt instead of an error
      err.tech = body.tech
      throw err
    }
    if (!res.ok) throw new Error('Failed to fetch questions')
    return await res.json()
  } catch (err) {
    if (err.signupRequired || !isOffline(err)) throw err
    return fetchQuestionsOffline(opts)
  }
}

// Mirrors the backend's filter semantics over the whole IndexedDB-cached dataset,
// so browsing (not editing) keeps working once the network drops.
async function fetchQuestionsOffline({ tech, category, difficulty, company, search, status, visitedIds, readIds, flaggedIds, importantIds, page = 0, size = PAGE }) {
  const all = visibleOffline(await getAllCachedQuestions())
  const visited = new Set(visitedIds || []), read = new Set(readIds || []), flagged = new Set(flaggedIds || []), important = new Set(importantIds || [])
  const q = (search || '').trim().toLowerCase()

  const content = all.filter(item => {
    if (tech && tech !== 'all' && item.tech !== tech) return false
    if (category && category !== 'all' && item.category !== category) return false
    if (difficulty && difficulty !== 'all' && item.difficulty !== difficulty) return false
    if (q && !(item.title?.toLowerCase().includes(q) || item.question?.toLowerCase().includes(q) || item.answer?.toLowerCase().includes(q))) return false
    if (status === 'visited' && !visited.has(item.id)) return false
    if (status === 'solved' && !read.has(item.id)) return false
    if (status === 'flagged' && !flagged.has(item.id)) return false
    if (status === 'important' && !important.has(item.id)) return false
    if (status === 'unsolved' && read.has(item.id)) return false
    // Company reports aren't in the offline cache — can't filter by it while offline.
    if (company && company !== 'all') return false
    return true
  })

  const start = page * size
  return {
    content: content.slice(start, start + size),
    number: page,
    totalElements: content.length,
    totalPages: Math.max(1, Math.ceil(content.length / size)),
  }
}

export async function fetchCategories(tech) {
  const token = localStorage.getItem('ir_token')
  const res = await fetch(`${API_BASE}/questions/categories?tech=${tech}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return []
  return res.json()
}

export async function fetchStats() {
  const token = localStorage.getItem('ir_token')
  const res = await fetch(`${API_BASE}/questions/stats`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return { total: 0, byTech: {} }
  return res.json()
}
