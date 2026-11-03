import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { suggestEdit, uploadImage, isLoggedIn } from '../lib/auth.js'
import Markdown from './Markdown.jsx'
import DiffView from './DiffView.jsx'

/**
 * "Suggest an edit" — a reader proposes a better answer; it goes to the admin
 * queue instead of changing the live question. The reader is notified of the
 * decision through the bell in the sidebar.
 */
export default function SuggestEdit({ question }) {
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [pane, setPane] = useState('preview')   // preview | diff | off
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const mdRef = useRef(null)
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')

  // Reset (and re-seed from the live text) whenever the question changes.
  useEffect(() => {
    setOpen(false); setSent(''); setError('')
    setAnswer(question.answer || '')
    setTitle(question.question || question.title || '')
    setNote('')
  }, [question.id])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''   // allow re-picking the same file
    if (!file) return
    setUploading(true); setError('')
    try {
      const url = await uploadImage(file)
      setAnswer((a) => (a ? a.replace(/\s*$/, '') + '\n\n' : '') + `![image](${url})\n`)
    } catch (err) {
      setError(err.message)
    } finally { setUploading(false) }
  }

  // Load a .md file as the suggested answer (same limits as the admin editor).
  async function handleMarkdown(e) {
    const file = e.target.files?.[0]
    e.target.value = ''   // allow re-picking the same file
    if (!file) return
    setError('')
    if (!/\.(md|markdown|mdown|txt)$/i.test(file.name)) { setError('Choose a Markdown (.md) file.'); return }
    if (file.size > 2 * 1024 * 1024) { setError('Markdown file exceeds 2 MB.'); return }
    // The box starts with the published answer and may hold edits: don't replace it silently.
    if (answer.trim() && !window.confirm(`Replace the answer with the contents of "${file.name}"?`)) return
    try {
      const raw = await file.text()
      setAnswer(raw.replace(/```[ \t]+text[ \t]*(\r?\n|$)/g, '```text$1'))
      setPane(p => (p === 'off' ? 'preview' : p))
    } catch {
      setError('Could not read that file.')
    }
  }

  if (!isLoggedIn()) return null

  const changed = answer.trim() !== (question.answer || '').trim()
    || title.trim() !== (question.question || question.title || '').trim()

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      // Only the question text and answer are reader-editable; `title` (the internal
      // label) stays whatever the admin set.
      const cleanedAnswer = answer ? answer.replace(/```[ \t]+text[ \t]*(\r?\n|$)/g, '```text$1') : answer
      const res = await suggestEdit(question.id, { question: title, answer: cleanedAnswer, note })
      setSent(res.message)
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  if (sent) {
    return (
      <div role="status" className="w-full mt-3 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        {sent}
      </div>
    )
  }

  if (!open) {
    return (
      <div className="flex">
        <button
          onClick={() => setOpen(true)}
          aria-label="Suggest an edit"
          className="inline-flex min-h-8 sm:min-h-10 items-center gap-1.5 text-xs font-semibold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Propose a better answer — an admin reviews it before it goes live"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="hidden sm:inline">Suggest an edit</span>
        </button>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  // Editing happens in a full-screen dialog: the article column is only ~3xl wide,
  // which leaves the Markdown box and its live view too narrow to work in.
  //
  // Portalled to <body>: the enclosing .paper has backdrop-blur, which makes it the
  // containing block for position:fixed, so inset-0 would cover the article instead
  // of the viewport and the dialog would sit wherever that article happened to be.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm"
         onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <form
        onSubmit={submit}
        className="w-full max-w-7xl max-h-full flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Suggest an edit</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your version goes to an admin. If it's approved it replaces the published answer and you'll be notified.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Load a Markdown file as the whole suggested answer. */}
            <input ref={mdRef} type="file" accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain" onChange={handleMarkdown} className="hidden" />
            <button
              type="button"
              onClick={() => mdRef.current?.click()}
              title="Load a Markdown (.md) file as your suggested answer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6H16a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v9" />
              </svg>
              Upload .md
            </button>

            {/* Upload an image and drop it into the answer as Markdown. */}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Upload an image and insert it into the answer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
              </svg>
              {uploading ? 'Uploading…' : 'Image'}
            </button>

            <div className="flex gap-1">
              {[['preview', 'Live view'], ['diff', 'Changes'], ['off', 'Hide']].map(([m, label]) => (
                <button key={m} type="button" onClick={() => setPane(m)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${pane === m ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">Cancel</button>
          </div>
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Question" className={inputCls} />

        {/* The editor grows to fill the dialog; both panes scroll on their own. */}
        <div className={`flex-1 min-h-0 grid grid-cols-1 gap-3 ${pane === 'off' ? '' : 'lg:grid-cols-2'}`}>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer (Markdown)"
            className={`${inputCls} font-mono text-xs h-full min-h-[16rem] resize-none`} />
          {pane === 'preview' && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 overflow-y-auto min-h-[16rem]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Live view</p>
              {answer.trim()
                ? <Markdown text={answer} />
                : <p className="text-sm italic text-slate-400">Your answer renders here as you type…</p>}
            </div>
          )}
          {pane === 'diff' && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 overflow-y-auto min-h-[16rem]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Your changes</p>
              <DiffView before={question.answer || ''} after={answer} />
            </div>
          )}
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
          placeholder="Why is this better? (optional, helps the admin decide)" className={inputCls} />

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button type="submit" disabled={busy || !changed}
          className="w-full py-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow disabled:opacity-50">
          {busy ? 'Sending…' : changed ? 'Send for review' : 'Make a change first'}
        </button>
      </form>
    </div>,
    document.body
  )
}
