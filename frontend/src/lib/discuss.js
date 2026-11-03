// API helpers for /discuss: interview experiences, compensation reports and general discussion.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method, credentials: 'include', ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status })
  return data
}

export const fetchDiscussions = ({ sort = 'new', category = 'all', company = '', page = 0 } = {}) =>
  call(`/public/discussions?sort=${sort}&category=${category}&page=${page}${company ? `&company=${encodeURIComponent(company)}` : ''}`)
export const fetchTrending = () => call('/public/discussions/trending')
export const fetchDiscussion = id => call(`/public/discussions/${id}`)
export const createDiscussion = body => call('/discussions', 'POST', body)
export const updateDiscussion = (id, body) => call(`/discussions/${id}`, 'PUT', body)
export const editDiscussionComment = (id, cid, body) => call(`/discussions/${id}/comments/${cid}`, 'PUT', { body })
export const voteDiscussion = (id, value) => call(`/discussions/${id}/vote`, 'POST', { value })
export const deleteDiscussion = id => call(`/discussions/${id}`, 'DELETE')

export const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🗂️' },
  { key: 'experience', label: 'Interview experience', icon: '🎤', tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { key: 'compensation', label: 'Compensation', icon: '💰', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { key: 'general', label: 'General', icon: '💬', tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
]

export const ago = t => {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  if (m < 43200) return `${Math.round(m / 1440)} d ago`
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fetchComments = id => call(`/public/discussions/${id}/comments`)
export const addDiscussionComment = (id, body, parentId, anonymous) => call(`/discussions/${id}/comments`, 'POST', { body, parentId, anonymous })
export const deleteDiscussionComment = (id, cid) => call(`/discussions/${id}/comments/${cid}`, 'DELETE')

// Admin moderation
export const fetchAdminDiscussions = ({ status = '', category = '', q = '', sort = 'new', page = 0 } = {}) =>
  call(`/admin/discussions?status=${status}&category=${category}&sort=${sort}&page=${page}&q=${encodeURIComponent(q)}`)
export const adminHideAuthor = email => call('/admin/discussions/author/hide', 'POST', { email })
export const adminDiscussionAction = (id, action) => call(`/admin/discussions/${id}/${action}`, 'POST', {})
export const fetchAdminDiscussionComments = id => call(`/admin/discussions/${id}/comments`)
export const adminCommentAction = (cid, action) => call(`/admin/discussion-comments/${cid}/${action}`, 'POST', {})
