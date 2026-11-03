import { useState, useEffect } from 'react'
import Loader from './Loader.jsx'
import { sampleResumeData } from '../lib/resumeSample.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const SECTIONS = ['header', 'summary', 'skills', 'experience', 'projects', 'education', 'achievements']
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const card = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950'

// Keeps only the preamble. A pasted full document loses its body: the app builds that from the member's details.
const trimDocument = (text) => {
  const at = text.indexOf('\\begin{document}')
  const cut = at >= 0 ? at : text.indexOf('\\end{document}')
  return cut < 0 ? text : text.slice(0, cut).trimEnd() + '\n'
}
const errorOf = async (res, fallback) => (await res.json().catch(() => ({}))).error || fallback

const BLANK = { id: null, name: '', description: '', layout: SECTIONS.join(','), preamble: '' }
const STARTER = `% Paste a full preamble here: everything before \\begin{document}.
\\documentclass[10pt]{article}
\\usepackage[a4paper,margin=0.5in]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage{enumitem}
\\pagestyle{empty}
\\newcommand{\\resumeItem}[1]{\\item\\small{#1}}
\\newcommand{\\resumeSubheading}[4]{\\textbf{#1} \\hfill #2 \\\\ \\textit{\\small #3} \\hfill \\textit{\\small #4}\\par}
\\newcommand{\\resumeProjectHeading}[2]{\\textbf{#1} \\hfill #2\\par}
\\newcommand{\\resumeSubHeadingListStart}{}
\\newcommand{\\resumeSubHeadingListEnd}{}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=0.2in, topsep=0pt, itemsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}}
`

// Admin: list templates, add or edit one, check it with a live PDF, save or delete.
export default function ResumeTemplatesAdmin() {
  const [list, setList] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)   // { ok, text }
  const [log, setLog] = useState('')

  const load = () => fetch(`${API_BASE}/admin/resume-templates`)
    .then(r => r.json()).then(setList).catch(() => setMsg({ ok: false, text: 'Could not load templates.' }))
  useEffect(() => { load() }, [])
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  const edit = (t) => { setForm({ ...t }); setPdfUrl(null); setMsg(null); setLog('') }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const layoutSections = form.layout.split(',').map(s => s.trim()).filter(Boolean)
  const toggleSection = (sec) => {
    const next = layoutSections.includes(sec) ? layoutSections.filter(s => s !== sec) : [...layoutSections, sec]
    set('layout', next.join(','))
  }

  const save = async () => {
    setBusy(true); setMsg(null); setLog('')
    const preamble = trimDocument(form.preamble)
    const trimmed = preamble !== form.preamble
    if (trimmed) set('preamble', preamble)
    const body = JSON.stringify({ name: form.name, description: form.description, layout: form.layout, preamble })
    try {
      const res = await fetch(form.id ? `${API_BASE}/admin/resume-templates/${form.id}` : `${API_BASE}/admin/resume-templates`, {
        method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body,
      })
      if (!res.ok) throw new Error(await errorOf(res, 'Save failed'))
      const saved = await res.json()
      setForm({ ...saved })
      setMsg({ ok: true, text: trimmed
        ? 'Template saved. The document body after \\begin{document} was removed; the app builds it from the member\'s details.'
        : 'Template saved. Members see it in their template list.' })
      load()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
    finally { setBusy(false) }
  }

  const remove = async () => {
    if (!form.id || !window.confirm(`Delete "${form.name}"? This cannot be undone.`)) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`${API_BASE}/admin/resume-templates/${form.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await errorOf(res, 'Could not delete'))
      setForm(BLANK); setPdfUrl(null); setMsg({ ok: true, text: 'Template deleted.' }); load()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
    finally { setBusy(false) }
  }

  // Compiles the template with sample details, without saving it.
  const check = async () => {
    setBusy(true); setMsg(null); setLog('')
    const preamble = trimDocument(form.preamble)
    if (preamble !== form.preamble) set('preamble', preamble)
    try {
      const res = await fetch(`${API_BASE}/admin/resume-templates/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: form.layout, preamble, data: sampleResumeData() }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setMsg({ ok: false, text: b.error || 'Compile failed' }); setLog(b.log || ''); setPdfUrl(null); return
      }
      const blob = await res.blob()
      setPdfUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob) })
      setMsg({ ok: true, text: 'Compiled. Check the PDF, then save.' })
    } catch (e) { setMsg({ ok: false, text: e.message }) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className={`${card} h-fit`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Templates</h3>
          <button onClick={() => { setForm({ ...BLANK, preamble: STARTER }); setPdfUrl(null); setMsg(null) }} className="text-xs font-semibold text-blue-600 dark:text-blue-400">+ New</button>
        </div>
        {!list ? <Loader compact /> : (
          <ul className="space-y-1">
            {list.map(t => (
              <li key={t.id}>
                <button onClick={() => edit(t)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${form.id === t.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}>{t.name}</button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={`${card} space-y-4`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-500">Name
            <input className={`${input} mt-1`} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Modern Two-Column" maxLength={120} />
          </label>
          <label className="text-xs font-medium text-slate-500">Description
            <input className={`${input} mt-1`} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Shown to members when they pick a template" maxLength={300} />
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Sections, in order (use the arrows to reorder)</p>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map(sec => {
              const on = layoutSections.includes(sec)
              return (
                <button key={sec} type="button" onClick={() => toggleSection(sec)} aria-pressed={on}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{sec}</button>
              )
            })}
          </div>
          {layoutSections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
              {layoutSections.map((s, i) => (
                <span key={s} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  {i + 1}. {s}
                  <button type="button" onClick={() => { if (i > 0) { const a = [...layoutSections]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set('layout', a.join(',')) } }} aria-label={`Move ${s} up`}>↑</button>
                  <button type="button" onClick={() => { if (i < layoutSections.length - 1) { const a = [...layoutSections]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; set('layout', a.join(',')) } }} aria-label={`Move ${s} down`}>↓</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <label className="block text-xs font-medium text-slate-500">LaTeX preamble (everything before \begin{'{'}document{'}'})
          <textarea className={`${input} mt-1 min-h-[16rem] font-mono text-xs`} value={form.preamble} onChange={e => set('preamble', e.target.value)} spellCheck={false} />
        </label>

        {msg && <p className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</p>}
        {log && <pre className="max-h-40 overflow-auto rounded-lg bg-red-50 selection:bg-blue-500/30 selection:text-slate-900 dark:selection:text-slate-100 p-3 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-300">{log}</pre>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button onClick={remove} disabled={busy || !form.id} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 disabled:opacity-40 dark:text-red-400">Delete</button>
          <div className="flex gap-2">
            <button onClick={check} disabled={busy || !form.preamble.trim()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">Check PDF</button>
            <button onClick={save} disabled={busy || !form.name.trim() || !form.preamble.trim() || layoutSections.length === 0} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : 'Save template'}</button>
          </div>
        </div>

        {pdfUrl && <iframe title="Template PDF check" src={pdfUrl} className="h-[70vh] w-full rounded-lg bg-white" />}
      </section>
    </div>
  )
}
