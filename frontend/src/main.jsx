import './lib/apiFetch.js'   // must stay first: makes every API request carry the session cookie
import React, { Suspense, lazy, useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
const App = lazy(() => import('./App.jsx'))
const AdminPage = lazy(() => import('./components/AdminPage.jsx'))
const ProfilePage = lazy(() => import('./components/ProfilePage.jsx'))
const PublicProfilePage = lazy(() => import('./components/PublicProfilePage.jsx'))
const ProblemsPage = lazy(() => import('./components/ProblemsPage.jsx'))
const LeaderboardPage = lazy(() => import('./components/LeaderboardPage.jsx'))
const StreakPage = lazy(() => import('./components/StreakPage.jsx'))
const DiscussPage = lazy(() => import('./components/DiscussPage.jsx'))
const DiscussDetailPage = lazy(() => import('./components/DiscussDetailPage.jsx'))
import { DailyPromoGate } from './components/DailyPromo.jsx'
const ResumePage = lazy(() => import('./components/ResumePage.jsx'))
const ResumeEditor = lazy(() => import('./components/ResumeEditor.jsx'))
import HomePage from './components/HomePage.jsx'
import Footer from './components/Footer.jsx'
const SheetPage = lazy(() => import('./components/SheetPage.jsx'))
const InterviewPage = lazy(() => import('./components/InterviewPage.jsx'))
const LiveInterview = lazy(() => import('./components/LiveInterview.jsx'))
const TermsPage = lazy(() => import('./components/TermsPage.jsx'))
const FeedbackPage = lazy(() => import('./components/FeedbackPage.jsx'))
const QuestionOfTheDayPage = lazy(() => import('./components/QuestionOfTheDayPage.jsx'))
const PremiumPage = lazy(() => import('./components/PremiumPage.jsx'))
import FeedbackButton from './components/FeedbackButton.jsx'
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage.jsx'))
import { trackView } from './lib/analytics.js'
import { syncSession } from './lib/auth.js'
const PracticePage = lazy(() => import('./components/PracticePage.jsx'))
const RoadmapsPage = lazy(() => import('./components/RoadmapsPage.jsx'))
const DesignPracticePage = lazy(() => import('./components/DesignPracticePage.jsx'))
import { useFeature } from './lib/features.js'

// Every page except the home page is its own chunk (React.lazy), so a first visit to / doesn't download the reader, admin,
// code editor, resume builder and the rest. Home, the footer and the small shared pieces stay in the main bundle.

// Shown in place of a page whose feature is switched off in the admin Feature flags tab.
function Paused({ what }) {
  return (
    <div className="min-h-screen bg-slate-100 p-6 dark:bg-slate-900">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-slate-950">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{what} is paused</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">It's temporarily unavailable. Please check back later.</p>
        <a href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">← Back to the app</a>
      </div>
    </div>
  )
}

// Renders the page only while its feature flag is on.
function Gate({ flag, what, children }) {
  const on = useFeature(flag)
  return on ? children : <Paused what={what} />
}
import './index.css'

// Patch fetch to always include credentials for API_BASE requests
const originalFetch = window.fetch;
window.fetch = function() {
  let [resource, config] = arguments;
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api';
  if (typeof resource === 'string' && resource.startsWith(apiBase)) {
    config = config || {};
    config.credentials = 'include';
    arguments[1] = config;
  }
  return originalFetch.apply(this, arguments);
};

// ponytail: raw pathname check at the entry point — avoids adding react-router just for a wildcard
const TRACKED_PAGES = ['/admin', '/profile', '/leaderboard', '/streak', '/resume', '/u/', '/reset-password', '/practice', '/roadmaps',
  '/interview', '/problems', '/sheets/', '/terms', '/feedback', '/question-of-the-day', '/premium', '/discuss']

function Routes() {
  const [path, setPath] = useState(() => typeof window !== 'undefined' ? window.location.pathname : '/')

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Question pages are tracked by App. Every other page here needs its own page view,
  // otherwise the analytics never see it (e.g. the resume builder).
  useEffect(() => {
    if (path === '/' || TRACKED_PAGES.some(p => path === p || path.startsWith(p))) trackView({ path })
  }, [path])

  // Dedicated admin route (create / edit / delete questions).
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminPage />

  // User profile / progress dashboard.
  if (path === '/profile' || path.startsWith('/profile/')) return <ProfilePage />

  if (path === '/') return <HomePage />

  if (path === '/roadmaps' || path.startsWith('/roadmaps/')) return <RoadmapsPage />

  if (path.startsWith('/sheets/')) return <Gate flag="code_practice" what="The DSA sheets"><SheetPage slug={path.split('/')[2]} /></Gate>

  // Solo system design practice (no interviewer). Before the /interview routes so it isn't taken for one.
  if (path === '/interview/practice') return <DesignPracticePage />

  if (path.startsWith('/interview/live/')) return <Gate flag="mock_interview" what="Mock interviews"><LiveInterview id={path.split('/')[3]} /></Gate>

  if (path === '/interview') return <Gate flag="mock_interview" what="Mock interviews"><InterviewPage /></Gate>

  if (path === '/terms') return <TermsPage />

  if (path === '/feedback') return <FeedbackPage />

  if (path === '/question-of-the-day') return <QuestionOfTheDayPage />

  if (path === '/premium') return <PremiumPage />

  if (path === '/leaderboard') return <LeaderboardPage />
  if (path === '/streak') return <StreakPage />
  if (path === '/discuss') return <DiscussPage />
  if (path.startsWith('/discuss/')) return <DiscussDetailPage id={path.split('/')[2]} />

  // Practice coding: questions with a code box that runs on the server.
  if (path === '/practice') return <Gate flag="code_practice" what="Practice coding"><PracticePage /></Gate>

  // All coding problems on one page, with search and filters.
  if (path === '/problems') return <Gate flag="code_practice" what="The problem list"><ProblemsPage /></Gate>

  // Resume builder: list, and one resume's editor.
  if (path === '/resume') return <Gate flag="resume_builder" what="The resume builder"><ResumePage /></Gate>
  if (path.startsWith('/resume/')) return <Gate flag="resume_builder" what="The resume builder"><ResumeEditor id={path.split('/')[2]} /></Gate>

  // Public progress page for any member (no sign-in needed).
  if (path.startsWith('/u/')) return <PublicProfilePage username={decodeURIComponent(path.split('/')[2] || '')} />

  // Password reset page.
  if (path === '/reset-password' || path.startsWith('/reset-password')) return <ResetPasswordPage />

  // Pass the live pathname; App resolves it to a question slug (or shows the in-reader 404).
  return <App path={path === '/questions' ? '/' : path} onPathChange={setPath} />
}

// Pages that do not lay out their own footer (home, terms, practice, and the reader do) get one underneath.
const NEEDS_FOOTER = ['/admin', '/profile', '/leaderboard', '/problems', '/resume', '/u/', '/reset-password', '/sheets', '/interview', '/interview/live', '/roadmaps']

function Router() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  const page = <><Suspense fallback={<div className="min-h-screen bg-slate-100 dark:bg-slate-900" />}><Routes /></Suspense><FeedbackButton /><DailyPromoGate /></>
  return NEEDS_FOOTER.some(p => path === p || path.startsWith(p === '/u/' ? p : p + '/')) ? (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col [&>div]:flex-1 [&>div]:!min-h-0">{page}</div>
      <Footer />
    </div>
  ) : page
}

syncSession()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
