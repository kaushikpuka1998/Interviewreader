const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body), cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}

export const fetchMyMessages = () => call('/messages/mine')
export const adminMessages = () => call('/admin/messages')
export const sendMemberMessage = (m) => call('/admin/messages', 'POST', m)
export const closeMemberMessage = (id) => call(`/admin/messages/${id}/close`, 'POST')
