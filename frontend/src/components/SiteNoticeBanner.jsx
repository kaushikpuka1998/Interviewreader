import { useEffect, useState } from 'react'
import { fetchSiteNotice, useFeature } from '../lib/features.js'

// A deliberately non-dismissible notice: admins use it for maintenance or a
// known outage, so a visitor should keep seeing it while the flag is enabled.
export default function SiteNoticeBanner() {
  const active = useFeature('site_notice', false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!active) return
    let mounted = true
    fetchSiteNotice().then(n => { if (mounted) setMessage(n.message || '') }).catch(() => {})
    return () => { mounted = false }
  }, [active])
  if (!active) return null

  return (
    <div role="status" className="relative z-40 flex-none border-b border-amber-300/30 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-sm">
      <span className="inline-flex items-center justify-center gap-2">
        <svg className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
        <span>{message || 'We’re performing maintenance or investigating a known issue. Some features may be temporarily unavailable.'}</span>
      </span>
    </div>
  )
}
