import { useEffect } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import FeedbackForm from './FeedbackForm.jsx'
import { setPageSeo } from '../lib/seo.js'

// The feedback page, opened from the floating "Feedback" button, the footer link and the feedback emails.
export default function FeedbackPage() {
  useEffect(() => { setPageSeo({ title: 'Feedback | Interview Reader', description: 'Tell us what to improve on Interview Reader: issues you face, what to build next, and how it compares with the platforms you use.', path: '/feedback' }) }, [])
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Help us improve Interview Reader</h1>
        <p className="mb-6 mt-1 text-sm text-slate-600 dark:text-slate-400">Takes under a minute: tap the answers that fit. We read every response.</p>
        <FeedbackForm />
      </main>
      <Footer />
    </div>
  )
}
