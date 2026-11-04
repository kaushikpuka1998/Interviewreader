const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

async function json(res, fallback) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || fallback)
  }
  return res.json()
}

export const fetchEmailRecipients = () =>
  fetch(`${API_BASE}/admin/emails/recipients`).then(r => json(r, 'Failed to load recipients'))

export const fetchDigestStatus = () =>
  fetch(`${API_BASE}/admin/emails/digest`).then(r => json(r, 'Failed to load digest status'))

export const fetchChallengeReminder = () =>
  fetch(`${API_BASE}/admin/emails/challenge-reminder`).then(r => json(r, 'Failed to load the challenge reminder status'))

export const retryChallengeReminder = () =>
  fetch(`${API_BASE}/admin/emails/challenge-reminder/retry`, { method: 'POST' }).then(r => json(r, 'Failed to start the resend'))

export const fetchEmailLog = () =>
  fetch(`${API_BASE}/admin/emails/log`).then(r => json(r, 'Failed to load the send log'))

export const sendAnnouncement = (payload) =>
  fetch(`${API_BASE}/admin/emails/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => json(r, 'Send failed'))
