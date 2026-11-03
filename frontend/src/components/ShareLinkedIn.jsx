import { trackClick } from '../lib/analytics.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// "Share on LinkedIn". LinkedIn builds the post's preview card from the shared page's meta tags without running
// JavaScript, so questions are shared through the API's /share page, which carries the question's own title and
// image and forwards readers to the question. Other pages share their own URL (tagged for analytics).
export function linkedInShareUrl({ questionId, path }) {
  const target = questionId
    ? `${API_BASE}/share/q/${encodeURIComponent(questionId)}`
    : `${window.location.origin}${path}${path.includes('?') ? '&' : '?'}utm_source=linkedin&utm_medium=share`
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(target)}`
}

export default function ShareLinkedIn({ questionId, path, label = 'Share', className = '' }) {
  const open = () => {
    trackClick(`share_linkedin:${questionId ? 'question' : path.split('?')[0]}`)
    window.open(linkedInShareUrl({ questionId, path }), 'linkedin-share', 'width=600,height=640,noopener')
  }
  return (
    <button type="button" onClick={open} title="Share on LinkedIn" aria-label="Share on LinkedIn"
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0a66c2] px-2.5 text-sm font-medium text-white transition-colors hover:bg-[#004182] sm:min-h-11 sm:gap-2 sm:px-3 ${className}`}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
      </svg>
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}
