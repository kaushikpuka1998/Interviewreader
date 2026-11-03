import { sessionId } from './analytics.js'

// API helpers for the engagement features: answer feedback, comments, question of the day, revision, referral, trial.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method, ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status })
  return data
}

export const fetchHelpful = id => call(`/questions/${encodeURIComponent(id)}/helpful?sessionId=${sessionId()}`)
export const voteHelpful = (id, helpful, note) => call(`/questions/${encodeURIComponent(id)}/helpful`, 'POST', { helpful, note, sessionId: sessionId() })

export const fetchComments = id => call(`/questions/${encodeURIComponent(id)}/comments`)
export const addComment = (id, body) => call(`/questions/${encodeURIComponent(id)}/comments`, 'POST', { body })
export const deleteComment = (id, cid) => call(`/questions/${encodeURIComponent(id)}/comments/${cid}`, 'DELETE')
export const reportComment = cid => call(`/comments/${cid}/report`, 'POST', {})

export const fetchQotd = () => call('/public/qotd')
export const fetchRevisionDue = () => call('/revision/due')
export const markRevised = id => call(`/revision/${encodeURIComponent(id)}/done`, 'POST', {})
export const fetchReferral = () => call('/referral/me')
export const fetchTrial = () => call('/billing/trial')
export const startTrial = () => call('/billing/trial', 'POST', {})

// Admin
export const fetchAnswerFeedback = () => call('/admin/answer-feedback')
export const fetchAdminComments = filter => call(`/admin/comments?filter=${filter}`)
export const fetchCommentCounts = () => call('/admin/comments/counts')
export const moderateComment = (cid, action) => call(`/admin/comments/${cid}/${action}`, 'POST', {})
export const deleteCommentAdmin = cid => call(`/admin/comments/${cid}`, 'DELETE')
export const fetchProblemStatement = id => call(`/coding-problems/${id}`)
