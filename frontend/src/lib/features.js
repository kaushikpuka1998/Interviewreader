import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// Feature flags from the server. If the request fails, return no flags so features fall back to their defaults.
export async function fetchFeatures() {
  try {
    const res = await fetch(`${API_BASE}/features`)
    return res.ok ? res.json() : {}
  } catch {
    return {}
  }
}

export async function setFeature(key, enabled) {
  const res = await fetch(`${API_BASE}/admin/features/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new Error('Could not update the feature flag.')
  return res.json()
}

// Reads one feature flag. Returns true until the server answers, so a feature doesn't flicker off on load.
export function useFeature(key) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    let alive = true
    fetchFeatures().then(f => { if (alive) setOn(f[key] !== false) })
    return () => { alive = false }
  }, [key])
  return on
}

// All flags at once, for components that read several (the top bar). "new_badge_*" flags are off until the server says on.
export function useFeatures() {
  const [flags, setFlags] = useState({})
  useEffect(() => {
    let alive = true
    fetchFeatures().then(f => { if (alive) setFlags(f) })
    return () => { alive = false }
  }, [])
  return flags
}
