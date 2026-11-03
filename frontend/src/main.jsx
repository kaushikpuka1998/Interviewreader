import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AdminPage from './components/AdminPage.jsx'
import ProfilePage from './components/ProfilePage.jsx'
import PublicProfilePage from './components/PublicProfilePage.jsx'
import ProblemsPage from './components/ProblemsPage.jsx'
import LeaderboardPage from './components/LeaderboardPage.jsx'
import ResumePage from './components/ResumePage.jsx'
import ResumeEditor from './components/ResumeEditor.jsx'
import HomePage from './components/HomePage.jsx'
import Footer from './components/Footer.jsx'
import SheetPage from './components/SheetPage.jsx'
import InterviewPage from './components/InterviewPage.jsx'
import LiveInterview from './components/LiveInterview.jsx'
import TermsPage from './components/TermsPage.jsx'
import ResetPasswordPage from './components/ResetPasswordPage.jsx'
import { trackView } from './lib/analytics.js'
import PracticePage from './components/PracticePage.jsx'
import RoadmapsPage from './components/RoadmapsPage.jsx'
import DesignPracticePage from './components/DesignPracticePage.jsx'
import { useFeature } from './lib/features.js'

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
const TRACKED_PAGES = ['/admin', '/profile', '/leaderboard', '/resume', '/u/', '/reset-password', '/practice', '/roadmaps',
  '/interview', '/problems', '/sheets/', '/terms']

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

  if (path === '/leaderboard') return <LeaderboardPage />

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
  const page = <Routes />
  return NEEDS_FOOTER.some(p => path === p || path.startsWith(p === '/u/' ? p : p + '/')) ? (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col [&>div]:flex-1 [&>div]:!min-h-0">{page}</div>
      <Footer />
    </div>
  ) : page
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
