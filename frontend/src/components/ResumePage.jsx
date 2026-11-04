import { useState, useEffect } from 'react'
import Loader from './Loader.jsx'
import { setPageSeo } from '../lib/seo.js'
import TopBar from './TopBar.jsx'
import AuthModal from './AuthModal.jsx'
import { isLoggedIn } from '../lib/auth.js'
import { fetchTemplates, fetchResumes, createResume, deleteResume } from '../lib/resume.js'
import { sampleResumeData, blankResumeData } from '../lib/resumeSample.js'

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

// Resume list: open, create (from a template, blank or from the sample), delete.
export default function ResumePage() {
  useEffect(() => { setPageSeo({ title: 'Free Resume Builder, LaTeX to PDF | Interview Reader', description: 'Build an ATS-friendly resume from free LaTeX templates and download it as a PDF in one click.', path: '/resume', jsonLd: undefined, noindex: true }) }, [])
  const [resumes, setResumes] = useState(null)
  const [templates, setTemplates] = useState([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: 'My resume', templateId: '', from: 'sample' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn()) return
    fetchResumes().then(setResumes).catch(e => setError(e.message))
    fetchTemplates().then(t => { setTemplates(t); setForm(f => ({ ...f, templateId: f.templateId || t[0]?.id || '' })) })
      .catch(e => setError(e.message))
  }, [])

  if (!isLoggedIn()) {
    return <Shell><SignInCard /></Shell>
  }

  const create = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const data = form.from === 'sample' ? sampleResumeData() : blankResumeData()
      const r = await createResume({ title: form.title, templateId: Number(form.templateId), data })
      window.location.href = `/resume/${r.id}`
    } catch (err) { setError(err.message); setBusy(false) }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this resume? This cannot be undone.')) return
    try { await deleteResume(id); setResumes(list => list.filter(r => r.id !== id)) }
    catch (err) { setError(err.message) }
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My resumes</h2>
        {!creating && <button onClick={() => setCreating(true)} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white sm:w-auto sm:py-1.5">New resume</button>}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {creating && (
        <form onSubmit={create} className="mb-6 space-y-3 rounded-2xl border border-blue-300 bg-white p-5 dark:border-blue-700 dark:bg-slate-950">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Resume name" maxLength={120} required />
            <select className={input} value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })} required>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {templates.find(t => String(t.id) === String(form.templateId))?.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{templates.find(t => String(t.id) === String(form.templateId)).description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
            <label className="flex items-center gap-2"><input type="radio" checked={form.from === 'sample'} onChange={() => setForm({ ...form, from: 'sample' })} /> Start from my current resume</label>
            <label className="flex items-center gap-2"><input type="radio" checked={form.from === 'blank'} onChange={() => setForm({ ...form, from: 'blank' })} /> Start blank</label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={busy || !form.templateId} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      )}

      {!resumes ? <Loader compact label="Loading your resumes…" /> : resumes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
          No resumes yet. Create one from a template and edit the details, or download it as LaTeX.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-slate-800 dark:bg-slate-950">
          {resumes.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <a href={`/resume/${r.id}`} className="break-words font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">{r.title}</a>
                <p className="text-xs text-slate-400">{r.templateName} · updated {new Date(r.updatedAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <a href={`/resume/${r.id}`} className="w-16 rounded-md border border-blue-200 px-2 py-1.5 text-center font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30">Open</a>
                <button onClick={() => remove(r.id)} className="w-16 rounded-md border border-red-200 px-2 py-1.5 text-center font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/30">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}

// Signed-out view: what the builder gives you, and one button to log in or sign up (the page reloads signed in).
function SignInCard() {
  const [open, setOpen] = useState(false)
  const perks = [
    ['📄', 'ATS-friendly templates', 'Clean LaTeX layouts that recruiters\' software reads correctly.'],
    ['⬇️', 'One-click PDF', 'Download a finished PDF, or the LaTeX source to edit anywhere.'],
    ['💾', 'Saved to your account', 'Keep several versions, one per role or company, and edit them any time.'],
  ]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl dark:bg-emerald-900/30" aria-hidden="true">📝</div>
      <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">Log in to build and keep your resumes</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">It is free. Create an account in a few seconds and your resumes are saved for you.</p>
      <ul className="mx-auto mt-6 grid gap-3 text-left sm:grid-cols-3">
        {perks.map(([icon, title, text]) => (
          <li key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xl" aria-hidden="true">{icon}</div>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{text}</p>
          </li>
        ))}
      </ul>
      <button onClick={() => setOpen(true)} className="mt-6 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700">Log in / Sign up</button>
      {open && <AuthModal onClose={() => setOpen(false)} onSuccess={() => window.location.reload()} />}
    </div>
  )
}

function Shell({ children }) {
  return (
    <>
      <TopBar />
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 dark:bg-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-100">Resume builder</h1>
          <div className="flex gap-4 text-sm">
            <a href="/profile" className="text-blue-600 hover:underline dark:text-blue-400">← Profile</a>
          </div>
        </div>
        {children}
      </div>
    </div>
    </>
  )
}
