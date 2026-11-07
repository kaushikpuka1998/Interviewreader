import { isLoggedIn } from '../lib/auth.js'

// Floating "Feedback" tab for signed-in members; it opens the feedback page (not a pop-up).
// A slim vertical tab on the right edge, halfway down, so it never covers the bottom action bars
// (the reader's Next button, editors, the cookie/footer strip).
// Hidden on the feedback page itself, in Admin, and where it would cover a full-screen tool.
const HIDDEN_ON = ['/feedback', '/admin', '/practice', '/interview/live', '/resume/']

export default function FeedbackButton() {
  const path = window.location.pathname
  if (!isLoggedIn() || HIDDEN_ON.some(p => path === p || path.startsWith(p))) return null
  return (
    <a href="/feedback" data-track="feedback_float_open" aria-label="Give feedback" title="Give feedback"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-900/25 transition-[padding,background-color] hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:bottom-auto lg:left-auto lg:right-0 lg:top-1/2 lg:-translate-y-1/2 lg:flex-col lg:gap-1.5 lg:rounded-l-xl lg:rounded-r-none lg:px-1.5 lg:py-3 lg:hover:pr-2.5 xl:px-2 xl:py-4">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l2.5-3H19a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v11.5" />
      </svg>
      <span className="tracking-wide [writing-mode:vertical-rl] rotate-180">Feedback</span>
    </a>
  )
}
