import { useEffect, useState } from 'react'
import { sessionId } from '../lib/analytics.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const PING_MS = 30000

// "N online": every open page pings the server every 30 seconds. Tabs in one browser share a session id,
// and signed-in people are counted by account, so one person is counted once.
export default function OnlineCount() {
  const [online, setOnline] = useState(null)

  useEffect(() => {
    let alive = true
    const headers = { 'Content-Type': 'application/json' }
    const tick = async () => {
      try {
        await fetch(`${API_BASE}/presence/ping`, {
          method: 'POST', headers, credentials: 'include', body: JSON.stringify({ sessionId: sessionId() }),
        })
        const res = await fetch(`${API_BASE}/presence/count`, { credentials: 'include' })
        const data = await res.json()
        if (alive) setOnline(data.online)
      } catch {
        // The count is a nice-to-have. If the server is unreachable, the badge stays hidden.
      }
    }
    tick()
    const timer = setInterval(tick, PING_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [])

  if (online == null) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400" title="People with a page open right now">
      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
      {online} Online
    </span>
  )
}
