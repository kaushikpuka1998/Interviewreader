// Daily streak and points (+25 login, +50 first read of a question, +100 first accepted solve, streak milestones).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

async function call(path, method = 'GET') {
  const res = await fetch(`${API_BASE}/points${path}`, { method, credentials: 'include' })
  if (!res.ok) throw new Error('Could not load points')
  return res.json()
}

export const fetchPoints = () => call('/me')

// The first signed-in visit of a day (India time) counts the day: streak + 25 points. Asked once per day per browser;
// the server makes repeats harmless anyway.
const todayIst = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)
export async function checkInToday() {
  const key = 'ir_checkin'
  const day = todayIst()
  if (localStorage.getItem(key) === day) return { data: await fetchPoints(), fresh: false }
  const data = await call('/checkin', 'POST')
  localStorage.setItem(key, day)
  return { data, fresh: data.awarded > 0 }
}

// The streak page: recent point events (with what they were for) and the days checked in.
export const fetchPointHistory = () => call('/history')
