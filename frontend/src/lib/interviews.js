const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const headers = () => {
  const t = localStorage.getItem('ir_token')
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

async function call(path, options = {}) {
  const res = await fetch(`${API_BASE}/interviews${path}`, { ...options, headers: headers(), credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.quota = data.quota   // 402: out of interviews, with the plans to offer
    throw err
  }
  return data
}

// How many interviews the candidate can still book: free launch period, Premium's monthly ones, monthly plan.
export const fetchInterviewQuota = () => call('/quota')

export const fetchMyInterviews = () => call('/mine')
export const requestInterview = (type, resumeId, slot, wantsToInterview) => call('/request', { method: 'POST', body: JSON.stringify({ type, resumeId: resumeId || null, slot, wantsToInterview: !!wantsToInterview }) })
export const fetchAllInterviews = () => call('/admin/all')
export const adminTakeInterview = id => call(`/admin/${id}/take`, { method: 'POST' })

// A local date and time as typed in a datetime-local box, sent as an exact moment (UTC).
export const slotToIso = local => (local ? new Date(local).toISOString() : '')
export const formatSlot = iso => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'a time you agree on')
export const fetchUpcoming = () => call('/upcoming')
export const takeInterview = id => call(`/${id}/take`, { method: 'POST' })
export const acceptInterview = type => call('/accept', { method: 'POST', body: JSON.stringify({ type }) })
export const fetchInterviewResume = id => call(`/${id}/resume`)
export const searchQuestionOptions = (id, q) => call(`/${id}/question-options?q=${encodeURIComponent(q)}`)
export const setInterviewQuestions = (id, items) => call(`/${id}/questions`, { method: 'PUT', body: JSON.stringify({ items }) })
export const randomInterviewQuestions = id => call(`/${id}/questions/random`, { method: 'POST' })
export const fetchLive = id => call(`/${id}/live`)
export const startLive = id => call(`/${id}/live/start`, { method: 'POST' })
export const stepLive = (id, index) => call(`/${id}/live/step`, { method: 'POST', body: JSON.stringify({ index }) })
export const saveLiveEditor = (id, code, lang, output) => call(`/${id}/live/editor`, { method: 'POST', body: JSON.stringify({ code, lang, output }) })
export const giveFeedback = (id, rating, strengths, improve) => call(`/${id}/feedback`, { method: 'POST', body: JSON.stringify({ rating, strengths, improve }) })
export const saveCallLink = (id, url) => call(`/${id}/call-link`, { method: 'POST', body: JSON.stringify({ url }) })
export const saveWhiteboardLink = (id, url) => call(`/${id}/whiteboard-link`, { method: 'POST', body: JSON.stringify({ url }) })
export const reportNoShow = id => call(`/${id}/no-show`, { method: 'POST' })
export const completeInterview = id => call(`/${id}/complete`, { method: 'POST' })
export const cancelInterview = id => call(`/${id}/cancel`, { method: 'POST' })
export const saveDesignNotes = (id, notes) => call(`/${id}/live/design-notes`, { method: 'POST', body: JSON.stringify({ notes }) })
export const saveDesignImageUrl = (id, imageUrl) => call(`/${id}/live/design-image-url`, { method: 'POST', body: JSON.stringify({ imageUrl }) })

export const uploadDesignImage = async (id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  const token = localStorage.getItem('ir_token')
  const res = await fetch(`${API_BASE}/interviews/${id}/live/design-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    body: formData
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`)
  return data
}

export const TYPES = [
  ['CODING', 'Coding', 'Solve problems with the interviewer'],
  ['SYSTEM_DESIGN', 'System design', 'Design a system on a shared whiteboard'],
  ['RESUME', 'Resume discussion', 'Walk through your resume and experience'],
]
export const typeLabel = t => (TYPES.find(x => x[0] === t) || [t, t])[1]
