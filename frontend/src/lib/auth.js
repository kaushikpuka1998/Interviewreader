import { clearQuestionCache } from './offlineStore.js'
import { getUtm } from './analytics.js'
// Auth + per-user progress against the backend. 
// Uses HttpOnly cookies for authentication.

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const USER_KEY = 'ir_user'

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}
export function isLoggedIn() { return !!getUser() }

function setSession({ token, email, name, admin, premium }) {
  // ponytail: Safari blocks the cross-site cookie, so keep a Bearer fallback.
  // Drop this once the API is served from the same site as the frontend.
  if (token) localStorage.setItem('ir_token', token)
  localStorage.setItem(USER_KEY, JSON.stringify({ email, name, admin: !!admin, premium: !!premium }))
}

// Clears the session first, then reloads (or goes to `redirect` when given). Callers that
// navigate away must await this, or the page leaves before the session is cleared.
export async function logout({ redirect } = {}) {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem('ir_token')
  // Saved profile data and code drafts belong to the account that's leaving.
  Object.keys(localStorage).filter(k => k.startsWith('ir_dash_') || k.startsWith('ir_draft_')).forEach(k => localStorage.removeItem(k))
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
  } catch (e) {
    console.error('Logout request failed', e)
  }
  await clearQuestionCache().catch(() => {})
  if (redirect) window.location.href = redirect
  else window.location.reload()
}

function authHeaders() {
  const token = localStorage.getItem('ir_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseError(res) {
  try { return (await res.json()).error } catch { return null }
}

export async function checkUsername(username) {
  const res = await fetch(`${API_BASE}/auth/username-available?username=${encodeURIComponent(username)}`)
  return res.json()
}

export async function fetchNotes() {
  const res = await fetch(`${API_BASE}/profile/notes`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) throw new Error('Could not load your notes')
  return res.json()
}

// id === null creates a note; otherwise updates that note.
export async function saveNote(id, { title, body }) {
  const res = await fetch(`${API_BASE}/profile/notes${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title, body }), credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || 'Could not save the note')
  return res.json()
}

export async function removeNote(id) {
  const res = await fetch(`${API_BASE}/profile/notes/${id}`, { method: 'DELETE', headers: authHeaders(), credentials: 'include' })
  if (!res.ok) throw new Error('Could not delete the note')
}

export async function updateUsername(username) {
  const res = await fetch(`${API_BASE}/profile/username`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username }), credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || 'Could not change username')
  return res.json()
}

export async function register({ email, password, name, country, city, username, termsAccepted, dateOfBirth, guardianName, guardianEmail, guardianConsent }) {
  const { utmSource, utmCampaign } = getUtm()
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, country, city, utmSource, utmCampaign, username, termsAccepted, dateOfBirth, guardianName, guardianEmail, guardianConsent }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || 'Registration failed')
  const data = await res.json()
  setSession(data)
  return data
}

export async function login({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || 'Login failed')
  const data = await res.json()
  setSession(data)
  return data
}

// --- per-user progress ---

export async function fetchProgress() {
  const res = await fetch(`${API_BASE}/progress`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) return { visited: [], read: [], flagged: [], important: [] }
  return res.json()
}

export function markVisitedRemote(id) {
  return fetch(`${API_BASE}/progress/visited/${encodeURIComponent(id)}`, { method: 'POST', headers: authHeaders(), credentials: 'include' })
}
export function markReadRemote(id) {
  return fetch(`${API_BASE}/progress/read/${encodeURIComponent(id)}`, { method: 'POST', headers: authHeaders(), credentials: 'include' })
}
export async function toggleFlaggedRemote(id) {
  const res = await fetch(`${API_BASE}/progress/flagged/${encodeURIComponent(id)}`, { method: 'POST', headers: authHeaders(), credentials: 'include' })
  if (!res.ok) throw new Error('Could not update flag')
  return res.json()
}

export async function toggleImportantRemote(id) {
  const res = await fetch(`${API_BASE}/progress/important/${encodeURIComponent(id)}`, { method: 'POST', headers: authHeaders(), credentials: 'include' })
  if (!res.ok) throw new Error('Could not update important mark')
  return res.json()
}

// Push guest localStorage progress into the account after login.
export function mergeProgress({ visited, read }) {
  return fetch(`${API_BASE}/progress/merge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ visited, read }),
    credentials: 'include'
  })
}

// --- user profile ---

export async function fetchProfile() {
  const res = await fetch(`${API_BASE}/profile/me`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res) || 'Failed to load profile')
  return res.json()
}

export async function updateLocation({ country, city }) {
  const res = await fetch(`${API_BASE}/profile/location`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ country, city }), credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || 'Failed to save location')
  return res.json()
}

// kind: 'solved' | 'visited' | 'flagged' | 'important'
export async function fetchProfileQuestions(kind) {
  const res = await fetch(`${API_BASE}/profile/questions/${kind}`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

// --- "was this asked in an interview?" company reports ---

export async function fetchQuestionCompanies(questionId) {
  const res = await fetch(`${API_BASE}/questions/${encodeURIComponent(questionId)}/companies`, {
    headers: authHeaders(), credentials: 'include'
  })
  if (!res.ok) return []
  return res.json()
}

export async function searchCompanies(q) {
  const res = await fetch(`${API_BASE}/companies?q=${encodeURIComponent(q || '')}`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function reportCompany(questionId, company, askedOn) {
  const res = await fetch(`${API_BASE}/questions/${encodeURIComponent(questionId)}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ company, askedOn }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || 'Could not save that')
  return res.json()
}

export async function unreportCompany(questionId, company) {
  const res = await fetch(
    `${API_BASE}/questions/${encodeURIComponent(questionId)}/companies/${encodeURIComponent(company)}`,
    { method: 'DELETE', headers: authHeaders(), credentials: 'include' }
  )
  if (!res.ok) throw new Error('Could not remove that')
  return res.json()
}

// --- suggested edits ---

export async function suggestEdit(questionId, { title, question, answer, note }) {
  const res = await fetch(`${API_BASE}/questions/${encodeURIComponent(questionId)}/suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title, question, answer, note }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || 'Could not send that suggestion')
  return res.json()
}

export async function reportDuplicate(questionId, note) {
  const res = await fetch(`${API_BASE}/questions/${encodeURIComponent(questionId)}/duplicate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ note }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || 'Could not send that report')
  return res.json()
}

// --- admin: duplicate report queue ---

export async function fetchDuplicateReports(status = 'PENDING') {
  const res = await fetch(`${API_BASE}/duplicate-reports?status=${status}`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function fetchDuplicateReportCounts() {
  const res = await fetch(`${API_BASE}/duplicate-reports/counts`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) return { pending: 0, dismissed: 0, resolved: 0 }
  return res.json()
}

export async function deleteQuestionForDuplicate(reportId) {
  const res = await fetch(`${API_BASE}/duplicate-reports/${reportId}/delete-question`, { method: 'POST', headers: authHeaders(), credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res) || 'Could not delete the question')
  return res.json()
}

export async function dismissDuplicateReport(reportId) {
  const res = await fetch(`${API_BASE}/duplicate-reports/${reportId}/dismiss`, { method: 'POST', headers: authHeaders(), credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res) || 'Could not dismiss the report')
  return res.json()
}

export async function fetchMySuggestions() {
  const res = await fetch(`${API_BASE}/suggestions/mine`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) return { unseen: 0, items: [] }
  return res.json()
}

export function markSuggestionsSeen() {
  return fetch(`${API_BASE}/suggestions/mine/seen`, { method: 'POST', headers: authHeaders(), credentials: 'include' })
}

// --- admin: review queue ---

export async function fetchSuggestions(status = 'PENDING') {
  const res = await fetch(`${API_BASE}/suggestions?status=${status}`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function fetchSuggestionCounts() {
  const res = await fetch(`${API_BASE}/suggestions/counts`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) return { pending: 0, approved: 0, rejected: 0 }
  return res.json()
}

export async function reviewSuggestion(id, decision, adminNote) {
  const res = await fetch(`${API_BASE}/suggestions/${id}/${decision}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ adminNote }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || `Failed (${res.status})`)
  return res.json()
}

// --- admin: publish questions ---

export async function createQuestion(input) {
  const res = await fetch(`${API_BASE}/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || `Failed (${res.status})`)
  return res.json()
}

export async function createQuestionsBulk(inputs) {
  const res = await fetch(`${API_BASE}/questions/bulk`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(inputs),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || `Failed (${res.status})`)
  return res.json()
}

export async function updateQuestion(id, input) {
  const res = await fetch(`${API_BASE}/questions/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || `Failed (${res.status})`)
  return res.json()
}

export async function deleteQuestion(id) {
  const res = await fetch(`${API_BASE}/questions/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: { ...authHeaders() },
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || `Failed (${res.status})`)
}

export async function uploadImage(file) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${API_BASE}/images`, {
    method: 'POST', headers: { ...authHeaders() }, body,
    credentials: 'include'
  })
  if (!res.ok) throw new Error(await parseError(res) || `Upload failed (${res.status})`)
  return (await res.json()).url
}

// Profile, lists and flagged questions in one request.
export async function fetchDashboard() {
  const res = await fetch(`${API_BASE}/profile/dashboard`, { headers: authHeaders(), credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res) || 'Failed to load your profile')
  return res.json()
}
