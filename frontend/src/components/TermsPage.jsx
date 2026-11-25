import { useEffect } from 'react'
import TermsContent from './TermsContent.jsx'
import Footer from './Footer.jsx'
import { setPageSeo } from '../lib/seo.js'

export default function TermsPage() {
  useEffect(() => { setPageSeo({ title: 'Terms & Conditions | InterviewReader', description: 'Terms of use, privacy, cookies, data retention and grievance officer details for Interview Reader.', path: '/terms' }) }, [])
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <a href="/questions" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">← Back to questions</a>
        <h1 className="mb-4 mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">Terms &amp; Conditions</h1>
        <div className="rounded-2xl bg-white p-6 dark:bg-slate-950"><TermsContent /></div>
      </main>
      <Footer />
    </div>
  )
}
