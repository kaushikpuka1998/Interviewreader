import PremiumAdmin from './PremiumAdmin.jsx'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getUser, isLoggedIn, logout, fetchSuggestionCounts, fetchDuplicateReportCounts } from '../lib/auth.js'
import { createQuestion, createQuestionsBulk, updateQuestion, deleteQuestion, uploadImage } from '../lib/auth.js'
import { fetchQuestions } from '../lib/api.js'
import { fetchCodingProblemsExport } from '../lib/codingProblems.js'
import AuthModal from './AuthModal.jsx'
import Markdown from './Markdown.jsx'
import AnalyticsPanel from './AnalyticsPanel.jsx'
import EmailCenter from './EmailCenter.jsx'
import ResumeTemplatesAdmin from './ResumeTemplatesAdmin.jsx'
import FeatureFlagsPanel from './FeatureFlagsPanel.jsx'
import CodingProblemsAdmin from './CodingProblemsAdmin.jsx'
import SuggestionsPanel from './SuggestionsPanel.jsx'
import FeedbackPanel from './FeedbackPanel.jsx'
import InterviewsPanel from './InterviewsPanel.jsx'
import DuplicatesPanel from './DuplicatesPanel.jsx'
import DesignRubricsAdmin from './DesignRubricsAdmin.jsx'

const TECHS = ['java', 'react', 'node', 'sql', 'hld', 'kafka', 'golang', 'misc', 'angular', 'rails', 'behavioral']
const DIFFICULTIES = ['Basic', 'Intermediate', 'Advanced', 'Experienced']
const EMPTY = { id: '', tech: 'java', title: '', question: '', answer: '', difficulty: 'Basic', category: '' }
const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
const toolBtn = 'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

function Banner({ msg }) {
  if (!msg) return null
  return <p className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</p>
}

// Shared editable fields for both the Add tab and the Manage edit panel.
function EditorFields({ form, set, requireAnswer, answerRows = 12, onInsertImage, onLoadMarkdown }) {
  const fileRef = useRef(null)
  const mdRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [upErr, setUpErr] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setUploading(true); setUpErr('')
    try {
      const url = await uploadImage(file)
      onInsertImage(url) // parent appends the markdown into the answer
    } catch (err) {
      setUpErr(err.message)
    } finally { setUploading(false) }
  }

  // Load a .md file straight into the Answer field.
  async function handleMarkdownFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUpErr('')

    if (file.size > 2 * 1024 * 1024) {
      setUpErr('Markdown file exceeds 2 MB')
      return
    }
    // Don't silently destroy work already typed in the box.
    if (form.answer.trim() && !window.confirm(`Replace the current answer with the contents of "${file.name}"?`)) {
      return
    }
    try {
      const text = await file.text()
      onLoadMarkdown(text, file)
    } catch {
      setUpErr('Could not read that file')
    }
  }

  async function copyAnswer() {
    if (!form.answer) return
    try {
      await navigator.clipboard.writeText(form.answer)
    } catch {
      // Clipboard API needs a secure context; fall back to a temporary selection.
      const ta = document.createElement('textarea')
      ta.value = form.answer
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { setUpErr('Copy failed'); }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <select value={form.tech} onChange={set('tech')} className={inputCls}>
          {TECHS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={form.difficulty} onChange={set('difficulty')} className={inputCls}>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <input value={form.category} onChange={set('category')} placeholder="Category (optional)" className={inputCls} />
      <input required value={form.title} onChange={set('title')} placeholder="Title" className={inputCls} />
      <textarea value={form.question} onChange={set('question')} placeholder="Question (defaults to title if empty)" rows={3} className={inputCls} />

      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Answer (Markdown)</label>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {upErr && <span className="text-xs text-red-500">{upErr}</span>}

          {/* Load a .md file into the answer */}
          <input ref={mdRef} type="file" accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain" onChange={handleMarkdownFile} className="hidden" />
          <button
            type="button"
            onClick={() => mdRef.current?.click()}
            title="Load a Markdown file into the answer"
            className={toolBtn}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6H16a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v9" /></svg>
            Upload .md
          </button>

          {/* Copy the answer markdown */}
          <button
            type="button"
            onClick={copyAnswer}
            disabled={!form.answer}
            title="Copy the answer Markdown to the clipboard"
            className={toolBtn}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copy
              </>
            )}
          </button>

          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Upload an image and insert it into the answer"
            className={toolBtn}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" /></svg>
            {uploading ? 'Uploading…' : 'Image'}
          </button>
        </div>
      </div>
      <textarea required={requireAnswer} value={form.answer} onChange={set('answer')} placeholder="Answer (Markdown). Uploaded images are inserted as ![](url)." rows={answerRows} className={inputCls} />
    </div>
  )
}

function PreviewPanel({ form }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Preview — how it will render</p>
      <QuestionPreview form={form} />
    </div>
  )
}

// Renders the in-progress question the same way the reader will show it.
function QuestionPreview({ form }) {
  const title = form.title || 'Untitled question'
  const question = form.question || form.title
  return (
    <article>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">{form.tech}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{form.difficulty}</span>
        {form.category && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{form.category}</span>}
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">{title}</h2>
      {question && question !== title && <p className="text-slate-600 dark:text-slate-400 mb-3">{question}</p>}
      {form.answer
        ? <Markdown text={form.answer} />
        : <p className="text-sm italic text-slate-400">Answer preview appears here as you type…</p>}
    </article>
  )
}

export default function AdminPage() {
  const [user, setUser] = useState(() => getUser())
  const isAdmin = user && user.admin

  const [tab, setTab] = useState('single') // single | bulk | manage | suggestions | analytics
  // Which dataset the Export JSON tab shows. Lifted so the Coding problems tab can preselect it.
  const [exportSource, setExportSource] = useState('questions')
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null) // when set, form is editing an existing question
  const [bulk, setBulk] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { id, title } when confirming delete

  // manage list
  const [tech, setTech] = useState('java')
  const [search, setSearch] = useState('')
  const [list, setList] = useState([])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Append an uploaded image as Markdown into the answer.
  // Load a .md file into the answer. If the file opens with a single `# Heading`
  // and the title is still blank, use it to prefill title/question and drop it from
  // the body so the heading is not duplicated above the question text.
  const loadMarkdown = (text, file) => {
    setForm((f) => {
      let answer = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/```[ \t]+text[ \t]*(\r?\n|$)/g, '```text$1')
      let title = f.title

      const m = answer.match(/^\s*#\s+(.+?)\s*\n/)
      if (m && !f.title.trim()) {
        title = m[1].replace(/[`*_]/g, '').trim()
        answer = answer.slice(m[0].length).replace(/^\n+/, '')
      }
      if (!title.trim() && file) {
        title = file.name.replace(/\.(md|markdown|mdown|txt)$/i, '').replace(/[-_]+/g, ' ').trim()
      }
      return { ...f, answer, title, question: f.question || title }
    })
    setMsg({ ok: true, text: `Loaded ${file?.name || 'file'} into the answer` })
  }

  const insertImage = (url) => setForm((f) => ({
    ...f,
    answer: (f.answer ? f.answer.replace(/\s*$/, '') + '\n\n' : '') + `![image](${url})\n`,
  }))

  const loadList = useCallback(async () => {
    try {
      const data = await fetchQuestions({ tech, search: search || undefined, page: 0, size: 10000 })
      setList(data.content || [])
    } catch { setList([]) }
  }, [tech, search])

  useEffect(() => { if (isAdmin && tab === 'manage') loadList() }, [isAdmin, tab, loadList])
  // Items waiting for review, shown as a badge on their tab. Re-read on every tab switch, so a count drops
  // once you have reviewed items there.
  const [pending, setPending] = useState({})
  useEffect(() => {
    if (!isAdmin) return
    Promise.all([fetchSuggestionCounts(), fetchDuplicateReportCounts()])
      .then(([s, d]) => setPending({ suggestions: s.pending || 0, duplicates: d.pending || 0 }))
      .catch(() => {})
  }, [isAdmin, tab])

  async function submitSingle(e) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      const cleanForm = {
        ...form,
        answer: form.answer ? form.answer.replace(/```[ \t]+text[ \t]*(\r?\n|$)/g, '```text$1') : form.answer,
      }
      if (editingId) {
        const q = await updateQuestion(editingId, cleanForm)
        setMsg({ ok: true, text: `Updated "${q.title}"` })
      } else {
        const q = await createQuestion(cleanForm)
        setMsg({ ok: true, text: `Published "${q.title}" (id: ${q.id})` })
      }
      setForm(EMPTY); setEditingId(null); loadList()
    } catch (err) { setMsg({ ok: false, text: err.message }) } finally { setBusy(false) }
  }

  async function submitBulk(e) {
    e.preventDefault(); setBusy(true); setMsg(null)
    let parsed
    try {
      parsed = JSON.parse(bulk)
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array')
    } catch (err) { setBusy(false); return setMsg({ ok: false, text: 'Invalid JSON: ' + err.message }) }
    try {
      const cleaned = parsed.map(item => ({
        ...item,
        answer: item.answer ? item.answer.replace(/```[ \t]+text[ \t]*(\r?\n|$)/g, '```text$1') : item.answer,
      }))
      const res = await createQuestionsBulk(cleaned)
      setMsg({ ok: true, text: `Created ${res.created}, updated ${res.updated} question(s)` })
      setBulk('')
    } catch (err) { setMsg({ ok: false, text: err.message }) } finally { setBusy(false) }
  }

  // Load a question into the form. In the Manage tab we edit inline (no tab switch).
  function startEdit(q, { switchTab = true } = {}) {
    setForm({ id: q.id, tech: q.tech, title: q.title || '', question: q.question || '', answer: q.answer || '', difficulty: q.difficulty || 'Basic', category: q.category || '' })
    setEditingId(q.id)
    setMsg(null)
    if (switchTab) {
      setTab('single')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function remove(q) {
    setDeleteConfirm({ id: q.id, title: q.title })
  }


  async function confirmDelete() {
    if (!deleteConfirm) return
    try {
      await deleteQuestion(deleteConfirm.id)
      setMsg({ ok: true, text: `Deleted ${deleteConfirm.id}` })
      loadList()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setDeleteConfirm(null)
    }
  }

  // --- gates ---
  if (!isLoggedIn()) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300 mb-4">Log in with an admin account to manage questions.</p>
        <AuthModal onClose={() => { window.location.href = '/' }} onSuccess={() => setUser(getUser())} />
      </Shell>
    )
  }
  if (!isAdmin) {
    return (
      <Shell>
        <p className="text-red-600 dark:text-red-400">Your account ({user.email}) is not an admin. Ask an admin to add your email to <code>ADMIN_EMAILS</code>.</p>
        <button onClick={() => logout({ redirect: '/' })} className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">Log out</button>
      </Shell>
    )
  }

  return (
    <Shell tabWide={tab === "analytics"}>
      <div className="flex gap-2 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {[['single', editingId ? 'Edit' : 'Add'], ['bulk', 'Bulk (JSON)'], ['manage', 'Manage'], ['suggestions', 'Suggestions'], ['feedback-dashboard', 'Feedback dashboard'], ['feedback', 'Feedback'], ['interviews', 'Interviews'], ['duplicates', 'Duplicates'], ['analytics', 'Analytics'], ['emails', 'Emails'], ['templates', 'Resume templates'], ['coding', 'Coding problems'], ['rubrics', 'Design rubrics'], ['premium', 'Premium'], ['features', 'Feature flags'], ['export', 'Export JSON']].map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setMsg(null) }}
            className={`inline-flex shrink-0 items-center whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            {label}
            {pending[t] > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white"
                title={`${pending[t]} waiting for review`} aria-label={`${pending[t]} waiting for review`}>{pending[t] > 99 ? '99+' : pending[t]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-4"><Banner msg={msg} /></div>

      {tab === 'rubrics' && <DesignRubricsAdmin />}
      {tab === 'single' && (
        <form onSubmit={submitSingle}>
          {editingId && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Editing <code>{editingId}</code>.
              <button type="button" onClick={() => { setForm(EMPTY); setEditingId(null) }} className="ml-2 text-blue-600 dark:text-blue-400 hover:underline">Cancel edit</button>
            </p>
          )}

          <div className={showPreview ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 items-start' : ''}>
            {/* Left: editor fields */}
            <div className="space-y-3">
              <EditorFields form={form} set={set} requireAnswer={!editingId} onInsertImage={insertImage} onLoadMarkdown={loadMarkdown} />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none">
                <input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600" />
                Live preview
              </label>
            </div>

            {/* Right: live preview */}
            {showPreview && <PreviewPanel form={form} />}
          </div>

          <button type="submit" disabled={busy} className="w-full mt-4 py-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold shadow-lg hover:opacity-95 disabled:opacity-60">
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Publish question'}
          </button>
        </form>
      )}

      {tab === 'bulk' && (
        <form onSubmit={submitBulk} className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Paste a JSON array. Each item needs <code>tech</code>, <code>title</code>, <code>answer</code>; optional <code>question</code>, <code>difficulty</code>, <code>category</code>, <code>id</code>. Items whose <code>id</code> already exists are updated (only the fields you include); the rest are inserted.</p>
          <textarea required value={bulk} onChange={(e) => setBulk(e.target.value)} rows={16}
            placeholder={'[\n  { "tech": "java", "title": "What is JVM?", "answer": "..." }\n]'}
            className={`${inputCls} font-mono text-xs`} />
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold shadow-lg hover:opacity-95 disabled:opacity-60">
            {busy ? 'Uploading…' : 'Bulk upsert'}
          </button>
        </form>
      )}

      {tab === 'analytics' && <AnalyticsPanel />}
      {tab === 'emails' && <EmailCenter />}
      {tab === 'templates' && <ResumeTemplatesAdmin />}
      {tab === 'coding' && <CodingProblemsAdmin onExport={() => { setExportSource('coding'); setTab('export') }} />}
      {tab === 'features' && <FeatureFlagsPanel />}
      {tab === 'premium' && <PremiumAdmin />}

      {tab === 'suggestions' && <SuggestionsPanel />}
      {tab === 'feedback-dashboard' && <FeedbackPanel view="dashboard" />}
      {tab === 'feedback' && <FeedbackPanel view="responses" />}
      {tab === 'interviews' && <InterviewsPanel />}

      {tab === 'duplicates' && <DuplicatesPanel />}

      {tab === 'export' && <ExportPanel tech={tech} setTech={setTech} search={search} setSearch={setSearch} source={exportSource} setSource={setExportSource} />}

      {tab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-5 items-start">
          {/* Left: search + question list */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <select value={tech} onChange={(e) => setTech(e.target.value)} className={inputCls}>
                <option value="all">All Techs</option>
                {TECHS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className={`${inputCls} col-span-2`} />
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-[calc(100vh-8rem)] overflow-y-auto">
              {list.length === 0 && <li className="p-4 text-sm text-slate-500">No questions.</li>}
              {list.map((q) => (
                <li
                  key={q.id}
                  onClick={() => startEdit(q, { switchTab: false })}
                  className={`flex items-center justify-between gap-3 p-3 cursor-pointer transition-colors ${editingId === q.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{q.title}</p>
                    <p className="text-xs text-slate-400">{q.id} · {q.tech} · {q.difficulty}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(q) }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex-shrink-0"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: inline editor for the selected question */}
          <div className="lg:sticky lg:top-4">
            {editingId ? (
              <form onSubmit={submitSingle} className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Editing <code>{editingId}</code>.
                  <button type="button" onClick={() => { setForm(EMPTY); setEditingId(null) }} className="ml-2 text-blue-600 dark:text-blue-400 hover:underline">Cancel</button>
                </p>
                <EditorFields form={form} set={set} requireAnswer={false} answerRows={10} onInsertImage={insertImage} onLoadMarkdown={loadMarkdown} />
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none">
                  <input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600" />
                  Live preview
                </label>
                {showPreview && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 max-h-[50vh] overflow-y-auto">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Preview</p>
                    <QuestionPreview form={form} />
                  </div>
                )}
                <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold shadow-lg hover:opacity-95 disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-400">
                Select a question on the left to edit its question &amp; answer here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Delete question?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                  Are you sure you want to delete <strong className="font-semibold text-slate-900 dark:text-slate-100">"{deleteConfirm.title}"</strong>?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
              >
                Delete question
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children, tabWide }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 dark:bg-slate-900 p-3 sm:p-6">
      <div className={tabWide ? "max-w-6xl mx-auto" : "max-w-5xl mx-auto"}>
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Dashboard</h1>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to app
          </button>
        </div>
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

function ExportPanel({ tech, setTech, search, setSearch, source, setSource }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Extra security layer for Export Panel
  const [unlocked, setUnlocked] = useState(false)
  const [passInput, setPassInput] = useState('')
  const [passError, setPassError] = useState('')

  const handleUnlock = async (e) => {
    e.preventDefault()
    setPassError('')
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE || 'http://localhost:8082/api') + '/auth/export-code/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: passInput })
      })
      const data = await res.json()
      if (data.valid) {
        setUnlocked(true)
      } else {
        setPassError('Incorrect code')
      }
    } catch (err) {
      setPassError('Failed to verify code')
    }
  }

  const requestCode = async () => {
    try {
      setPassError('Requesting code...')
      await fetch((import.meta.env.VITE_API_BASE || 'http://localhost:8082/api') + '/auth/export-code/request', {
        method: 'POST'
      })
      setPassError('Code sent to your email!')
    } catch (err) {
      setPassError('Failed to request code')
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      if (source === 'coding') {
        // Already in the bulk import shape, so the file can be imported back without editing.
        setData(await fetchCodingProblemsExport())
      } else {
        const res = await fetchQuestions({ tech: tech === 'all' ? undefined : tech, search: search || undefined, page: 0, size: 100000 })
        setData(res.content || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (unlocked) {
      loadData()
    }
  }, [tech, search, unlocked, source])

  const handleDownload = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = source === 'coding' ? 'coding_problems.json' : 'exported_questions.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Security Check</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Please enter the daily unlock code sent to your email to access bulk data export.</p>
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input 
              type="text" 
              value={passInput} 
              onChange={(e) => setPassInput(e.target.value)} 
              placeholder="Enter daily code..." 
              className={inputCls}
              autoFocus
            />
          </div>
          {passError && <p className={`text-sm ${passError.includes('sent') ? 'text-green-500' : 'text-red-500'}`}>{passError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={requestCode} className="flex-1 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
              Send Code to Email
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
              Unlock Export
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {source === 'coding' ? 'Export Coding Problems' : 'Export Questions'}
          {data && <span className="ml-2 text-sm font-normal text-slate-500">{data.length} rows</span>}
        </h2>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
            {[['questions', 'Questions'], ['coding', 'Coding problems']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setSource(value); setData(null) }}
                className={`px-3 py-2 text-sm font-semibold transition-colors ${source === value ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            onClick={handleDownload}
            disabled={loading || !data || data.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            Download JSON
          </button>
        </div>
      </div>
      
      {source === 'coding' ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Every coding problem, in the bulk import shape, so this file can be imported back as-is.
          Titles are not unique, so a problem with duplicate rows appears more than once.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <select value={tech} onChange={(e) => setTech(e.target.value)} className={inputCls}>
            <option value="all">All Techs</option>
            {TECHS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className={`${inputCls} col-span-2`} />
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-hidden h-[600px] flex flex-col">
        {loading && !data ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Loading {source === 'coding' ? 'coding problems' : 'questions'}…</div>
        ) : (
          <textarea 
            readOnly 
            value={data ? JSON.stringify(data, null, 2) : ''} 
            className="w-full h-full p-4 font-mono text-xs bg-transparent border-none focus:ring-0 text-slate-800 dark:text-slate-300 resize-none"
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setUnlocked(false)} 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Lock Export
        </button>
        <span className="text-xs text-slate-500">{data ? `Total questions: ${data.length}` : ''}</span>
      </div>
    </div>
  )
}
