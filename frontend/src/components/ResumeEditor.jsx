import { useState, useEffect, useMemo, useLayoutEffect, useRef } from 'react'
import AtsScore from './AtsScore.jsx'
import Loader from './Loader.jsx'
import { fieldsToLatex, readFields, writeFields, fromLatexValue, applyFields } from '../lib/latexSync.js'
import { fetchResume, fetchTemplates, saveResume, downloadLatex, fetchLatexText, saveLatexText, resetLatexText, previewPdfRequest, previewLatexRequest } from '../lib/resume.js'
import { sampleResumeData } from '../lib/resumeSample.js'
import { isLoggedIn } from '../lib/auth.js'

// Ctrl/Cmd+P shows only the preview, on US Letter with the same margins. Other parts of the editor are hidden.
const PRINT_CSS = `
@page { size: letter; margin: 0.5in; }
@media print {
  html, body, .resume-shell { background: white !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important; }
  .no-print, .resume-form-col { display: none !important; }
  .resume-grid { display: block !important; }
  .resume-preview-wrap { display: block !important; position: static !important; max-height: none !important; overflow: visible !important;
    background: white !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
  #resume-print { width: 7.5in !important; max-width: none !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
  .break-inside-avoid { break-inside: avoid; }
  .break-after-avoid { break-after: avoid; }
}
`

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950'
const btnGhost = 'rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
const btnDanger = 'rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'

const label = (text) => <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{text}</span>

// Edits one resume: details in sections, saved to the database; LaTeX preview and .tex download.
export default function ResumeEditor({ id }) {
  const [resume, setResume] = useState(null)
  const [title, setTitle] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates] = useState([])
  const [data, setData] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)   // { ok, text }
  const [mode, setMode] = useState('editable')      // 'editable' (form) or 'latex' (edit the LaTeX source)
  const [latexDraft, setLatexDraft] = useState(null)
  const [latexEdited, setLatexEdited] = useState(false)
  const [latexDirty, setLatexDirty] = useState(false)
  const [latexMsg, setLatexMsg] = useState(null)
  const [mobile, setMobile] = useState('edit')   // phones: edit or preview, one at a time
  const [panel, setPanel] = useState('design')   // right panel: 'design' (instant) or 'pdf' (live LaTeX compile)
  const [fitOne, setFitOne] = useState(true)      // "Fit to 1 page" (default): scale down just enough to fit one Letter page
  const [fitScale, setFitScale] = useState(1)
  const [fitHeight, setFitHeight] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) return
    Promise.all([fetchResume(id), fetchTemplates()]).then(([r, t]) => {
      setResume(r); setTitle(r.title); setTemplateId(String(r.templateId)); setData(r.data); setTemplates(t)
    }).catch(e => setNotice({ ok: false, text: e.message }))
  }, [id])

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const warn = (e) => { if (dirty || latexDirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, latexDirty])

  const change = (fn) => { setData(d => fn(d)); setDirty(true) }
  const setHeader = (k, v) => change(d => ({ ...d, header: { ...d.header, [k]: v } }))
  const setSection = (k, v) => change(d => ({ ...d, [k]: v }))
  const patchItem = (k, i, patch) => change(d => ({ ...d, [k]: d[k].map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }))
  const addItem = (k, item) => change(d => ({ ...d, [k]: [...(d[k] || []), item] }))
  const removeItem = (k, i) => change(d => ({ ...d, [k]: d[k].filter((_, idx) => idx !== i) }))
  const moveItem = (k, i, dir) => change(d => {
    const arr = [...d[k]]; const j = i + dir
    if (j < 0 || j >= arr.length) return d
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return { ...d, [k]: arr }
  })

  // Form -> LaTeX: a simple field changed, so its line in the LaTeX is rewritten.
  // LaTeX -> form: a line changed in the LaTeX, so the form field follows it.
  const syncFromLatex = useRef(false)
  const fieldsJson = JSON.stringify(fieldsToLatex(data))
  useEffect(() => {
    if (syncFromLatex.current) { syncFromLatex.current = false; return }
    if (latexDraft === null) return
    const next = writeFields(latexDraft, fieldsToLatex(data))
    if (next !== latexDraft) { setLatexDraft(next); setLatexDirty(true) }
  }, [fieldsJson])

  useEffect(() => {
    if (mode !== 'latex' || latexDraft === null) return
    const found = readFields(latexDraft)
    const formLatex = fieldsToLatex(data)
    const changed = Object.keys(found).filter(v => found[v] !== formLatex[v])
    if (!changed.length) return
    syncFromLatex.current = true
    setData(d => applyFields(d, Object.fromEntries(changed.map(v => [v, fromLatexValue(v, found[v])]))))
    setDirty(true)
  }, [latexDraft])

  const payload = useMemo(() => ({ title, templateId: Number(templateId), data }), [title, templateId, data])
  const layout = templates.find(t => String(t.id) === String(templateId))?.layout

  // Measure the resume at print width and find the scale that fits one page.
  useLayoutEffect(() => {
    if (!fitOne) { setFitScale(1); setFitHeight(0); return }
    const el = document.getElementById('resume-content')
    if (!el) return
    const previousT = el.style.transform, previousW = el.style.width
    el.style.transform = 'none'
    el.style.width = '720px'
    const contentHeight = el.offsetHeight
    el.style.transform = previousT
    el.style.width = previousW
    // Target 940px (a bit under the 960px page) so rounding never pushes a line onto a second page.
    const s = Math.min(1, 940 / contentHeight)
    setFitScale(s)
    setFitHeight(contentHeight * s)
  }, [data, fitOne, layout])

  const save = async () => {
    setBusy(true); setNotice(null)
    try {
      const r = await saveResume(id, payload)
      setResume(r); setDirty(false); setNotice({ ok: true, text: 'Saved.' })
    } catch (e) { setNotice({ ok: false, text: e.message }) }
    finally { setBusy(false) }
  }

  const loadLatex = async () => {
    try {
      const current = await fetchLatexText(id)
      setLatexDraft(current.latex); setLatexEdited(current.edited); setLatexDirty(false); setLatexMsg(null)
    } catch (e) { setLatexMsg({ ok: false, text: e.message }) }
  }

  // Switching modes never throws away edits. Going to LaTeX first saves the form, so the
  // generated LaTeX matches it; an unsaved LaTeX draft is kept as it is.
  const switchMode = async (next) => {
    if (next === mode) return
    if (next === 'latex') {
      if (dirty) await save()
      if (latexDraft === null || (!latexDirty && !latexEdited)) await loadLatex()
    }
    setMode(next)
  }

  const saveLatex = async () => {
    try {
      await saveLatexText(id, latexDraft)
      setLatexEdited(true); setLatexDirty(false); setLatexMsg({ ok: true, text: 'LaTeX saved. The PDF on the right shows it.' })
    } catch (e) { setLatexMsg({ ok: false, text: e.message }) }
  }

  const resetLatex = async () => {
    if (!window.confirm('Drop your LaTeX edits and go back to the form?')) return
    try {
      await resetLatexText(id)
      await loadLatex()
      setLatexMsg({ ok: true, text: 'Back to the form. The LaTeX now follows it.' })
    } catch (e) { setLatexMsg({ ok: false, text: e.message }) }
  }

  // Downloads a Letter-size PDF of exactly what the preview shows (same content, same fit). No print dialog.
  const downloadPdf = async () => {
    if (dirty) await save()
    const content = document.getElementById('resume-content')
    if (!content) return
    if (!content.offsetParent) { setMobile('preview'); await new Promise(r => setTimeout(r, 150)) }
    const scale = fitOne ? fitScale : 1
    // Copy of the preview content with the same inline layout: 720/scale wide, scaled by `scale`.
    const copy = content.cloneNode(true)
    // Placed on top of the page while the PDF is made. The wrapper is transparent: a coloured cover fades the capture.
    const box = document.createElement('div')
    // Black text on white: the copy sits outside the preview's text-black class, so it must set its own colour.
    box.setAttribute('style', 'position:relative;width:720px;background:#fff;color:#000;overflow:hidden;')
    box.appendChild(copy)
    const wrap = document.createElement('div')
    wrap.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;')
    wrap.appendChild(box)
    document.body.appendChild(wrap)
    // A little extra height so the last line's descenders aren't clipped.
    box.style.height = `${Math.ceil(copy.scrollHeight * scale) + 12}px`
    setBusy(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      await html2pdf().set({
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `${(title || 'resume').replace(/[^\w.-]+/g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: '.break-inside-avoid' },
      }).from(box).save()
      setNotice({ ok: true, text: 'PDF downloaded.' })
    } catch (e) {
      setNotice({ ok: false, text: `Could not create the PDF: ${e.message}` })
    } finally {
      wrap.remove()
      setBusy(false)
    }
  }

  const download = async () => {
    if (dirty) await save()
    downloadLatex(id, title).catch(e => setNotice({ ok: false, text: e.message }))
  }

  if (!isLoggedIn()) return <Shell><p className="text-slate-500">Log in to edit your resume.</p></Shell>
  if (!data) return <Shell>{notice ? <p className="text-sm text-red-600">{notice.text}</p> : <Loader label="Opening your resume…" />}</Shell>

  const h = data.header || {}
  const links = h.links || []

  return (
    <Shell>
      <style>{PRINT_CSS}</style>
      {/* Top bar */}
      <div className="no-print sticky top-0 z-10 -mx-6 mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-100/95 px-6 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <input className={`${input} max-w-xs font-semibold`} value={title} onChange={e => { setTitle(e.target.value); setDirty(true) }} maxLength={120} aria-label="Resume name" />
        <select className={`${input} max-w-[14rem]`} value={templateId} onChange={e => { setTemplateId(e.target.value); setDirty(true) }} aria-label="Template">
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className={`text-xs ${dirty ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{dirty ? 'Unsaved changes' : resume ? `Saved ${new Date(resume.updatedAt).toLocaleTimeString()}` : ''}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => setFitOne(v => !v)} aria-pressed={fitOne}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${fitOne ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
            {fitOne ? 'Fit to 1 page ✓' : 'Fit to 1 page'}
          </button>
          <div className="inline-flex rounded-lg bg-slate-200 p-0.5 dark:bg-slate-800" role="group" aria-label="Editing mode">
            {[['editable', 'Editable'], ['latex', 'LaTeX']].map(([k, label]) => (
              <button key={k} onClick={() => switchMode(k)} aria-pressed={mode === k}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${mode === k ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}>{label}</button>
            ))}
          </div>
          <button onClick={download} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Download .tex</button>
          <button onClick={save} disabled={busy || !dirty} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {notice && <p className={`no-print mb-4 text-sm ${notice.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{notice.text}</p>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
        <p>Write **bold**, [link text](https://url) and → for arrows. Other symbols are handled for you.</p>
        <button onClick={() => { if (window.confirm('Replace everything here with the sample resume?')) { setData(sampleResumeData()); setDirty(true) } }} className="font-medium text-blue-600 hover:underline dark:text-blue-400">Load sample</button>
      </div>

      <div className="no-print mb-4 flex gap-2 lg:hidden">
        {[['edit', 'Edit form'], ['preview', 'Live PDF']].map(([v, label]) => (
          <button key={v} onClick={() => setMobile(v)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${mobile === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{label}</button>
        ))}
      </div>

      <div className="resume-grid grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
      {mode === 'latex' ? (
      <div className={`resume-form-col space-y-4 ${mobile === 'preview' ? 'hidden lg:block' : ''}`}>
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">LaTeX source</h3>
            <div className="flex gap-2">
              <button onClick={resetLatex} disabled={!latexEdited} className={`${btnGhost} disabled:opacity-40`}>Reset to form</button>
              <button onClick={saveLatex} disabled={!latexDirty || latexDraft === null} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Save LaTeX</button>
            </div>
          </div>
          <p className={`mb-3 rounded-lg px-3 py-2 text-xs ${latexEdited ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {latexEdited
              ? 'This is your own LaTeX. Changes in the form do not update it until you reset.'
              : 'This LaTeX is generated from the form. Edit it here, and it becomes your own LaTeX.'}
          </p>
          <textarea
            value={latexDraft ?? ''}
            onChange={e => { setLatexDraft(e.target.value); setLatexDirty(true) }}
            spellCheck={false}
            className="min-h-[70vh] w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          />
          {latexMsg && <p className={`mt-3 text-sm ${latexMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{latexMsg.text}</p>}
        </section>
      </div>
      ) : (
      <div className={`resume-form-col space-y-5 ${mobile === 'preview' ? 'hidden lg:block' : ''}`}>
        <AtsScore data={data} />

        {/* Header */}
        <section className={card}>
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Header</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>{label('Full name')}<input className={input} value={h.name || ''} onChange={e => setHeader('name', e.target.value)} /></label>
            <label>{label('Headline')}<input className={input} value={h.headline || ''} onChange={e => setHeader('headline', e.target.value)} /></label>
            <label>{label('Location')}<input className={input} value={h.location || ''} onChange={e => setHeader('location', e.target.value)} /></label>
            <label>{label('Extra line (e.g. relocation)')}<input className={input} value={h.extra || ''} onChange={e => setHeader('extra', e.target.value)} /></label>
            <label>{label('Email')}<input type="email" className={input} value={h.email || ''} onChange={e => setHeader('email', e.target.value)} /></label>
            <label>{label('Phone')}<input className={input} value={h.phone || ''} onChange={e => setHeader('phone', e.target.value)} /></label>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              {label('Links')}
              <button onClick={() => setHeader('links', [...links, { label: '', url: '' }])} className={btnGhost}>+ Add link</button>
            </div>
            <div className="space-y-2">
              {links.map((l, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <input className={input} placeholder="Label" value={l.label || ''} onChange={e => setHeader('links', links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <input className={input} placeholder="https://" value={l.url || ''} onChange={e => setHeader('links', links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                  <button onClick={() => setHeader('links', links.filter((_, j) => j !== i))} className={btnDanger}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className={card}>
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Summary</h3>
          <textarea className={`${input} min-h-[7rem]`} value={data.summary || ''} onChange={e => setSection('summary', e.target.value)} />
        </section>

        {/* Skills */}
        <section className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Technical skills</h3>
            <button onClick={() => addItem('skills', { label: '', value: '' })} className={btnGhost}>+ Add row</button>
          </div>
          <div className="space-y-2">
            {(data.skills || []).map((s, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto_auto_auto]">
                <input className={input} placeholder="Category" value={s.label || ''} onChange={e => patchItem('skills', i, { label: e.target.value })} />
                <input className={input} placeholder="Skills, comma separated" value={s.value || ''} onChange={e => patchItem('skills', i, { value: e.target.value })} />
                <button onClick={() => moveItem('skills', i, -1)} className={btnGhost} aria-label="Move up">↑</button>
                <button onClick={() => moveItem('skills', i, 1)} className={btnGhost} aria-label="Move down">↓</button>
                <button onClick={() => removeItem('skills', i)} className={btnDanger}>Remove</button>
              </div>
            ))}
          </div>
        </section>

        {/* Experience */}
        <Entries title="Experience" items={data.experience || []} onAdd={() => addItem('experience', { role: '', start: '', end: '', company: '', companyUrl: '', meta: '', location: '', bullets: [] })}
          onRemove={(i) => removeItem('experience', i)} onMove={(i, d) => moveItem('experience', i, d)}
          render={(e, i) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input className={input} placeholder="Role" value={e.role || ''} onChange={ev => patchItem('experience', i, { role: ev.target.value })} />
              <input className={input} placeholder="Company" value={e.company || ''} onChange={ev => patchItem('experience', i, { company: ev.target.value })} />
              <input className={input} placeholder="Company link (optional)" value={e.companyUrl || ''} onChange={ev => patchItem('experience', i, { companyUrl: ev.target.value })} />
              <input className={input} placeholder="Short description (tech, industry)" value={e.meta || ''} onChange={ev => patchItem('experience', i, { meta: ev.target.value })} />
              <input className={input} placeholder="Start, e.g. Mar 2025" value={e.start || ''} onChange={ev => patchItem('experience', i, { start: ev.target.value })} />
              <input className={input} placeholder="End (blank = Present)" value={e.end || ''} onChange={ev => patchItem('experience', i, { end: ev.target.value })} />
              <input className={input} placeholder="Location" value={e.location || ''} onChange={ev => patchItem('experience', i, { location: ev.target.value })} />
              <Bullets value={e.bullets} onChange={b => patchItem('experience', i, { bullets: b })} />
            </div>
          )} />

        {/* Projects */}
        <Entries title="Projects" items={data.projects || []} onAdd={() => addItem('projects', { name: '', url: '', tech: '', date: '', bullets: [] })}
          onRemove={(i) => removeItem('projects', i)} onMove={(i, d) => moveItem('projects', i, d)}
          render={(p, i) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input className={input} placeholder="Project name" value={p.name || ''} onChange={ev => patchItem('projects', i, { name: ev.target.value })} />
              <input className={input} placeholder="Link (optional)" value={p.url || ''} onChange={ev => patchItem('projects', i, { url: ev.target.value })} />
              <input className={input} placeholder="Technologies" value={p.tech || ''} onChange={ev => patchItem('projects', i, { tech: ev.target.value })} />
              <input className={input} placeholder="Date, e.g. 2026" value={p.date || ''} onChange={ev => patchItem('projects', i, { date: ev.target.value })} />
              <Bullets value={p.bullets} onChange={b => patchItem('projects', i, { bullets: b })} />
            </div>
          )} />

        {/* Education */}
        <Entries title="Education" items={data.education || []} onAdd={() => addItem('education', { degree: '', dates: '', school: '', location: '' })}
          onRemove={(i) => removeItem('education', i)} onMove={(i, d) => moveItem('education', i, d)}
          render={(e, i) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input className={input} placeholder="Degree" value={e.degree || ''} onChange={ev => patchItem('education', i, { degree: ev.target.value })} />
              <input className={input} placeholder="Dates" value={e.dates || ''} onChange={ev => patchItem('education', i, { dates: ev.target.value })} />
              <input className={input} placeholder="School" value={e.school || ''} onChange={ev => patchItem('education', i, { school: ev.target.value })} />
              <input className={input} placeholder="Location" value={e.location || ''} onChange={ev => patchItem('education', i, { location: ev.target.value })} />
            </div>
          )} />

        {/* Section names: rename any heading */}
        <section className={card}>
          <h3 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Section names</h3>
          <p className="mb-3 text-xs text-slate-400">Leave blank to use the default name.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[['summary', 'Summary'], ['skills', 'Technical Skills'], ['experience', 'Experience'], ['projects', 'Projects'], ['education', 'Education'], ['achievements', 'Achievements']].map(([k, def]) => (
              <label key={k}>{label(def)}
                <input className={input} placeholder={def} value={data.sectionTitles?.[k] || ''}
                  onChange={e => setSection('sectionTitles', { ...(data.sectionTitles || {}), [k]: e.target.value })} />
              </label>
            ))}
          </div>
        </section>

        {/* Custom sections */}
        <Entries title="Custom sections" items={data.custom || []} onAdd={() => addItem('custom', { title: '', text: '', bullets: [] })}
          onRemove={(i) => removeItem('custom', i)} onMove={(i, d) => moveItem('custom', i, d)}
          render={(c, i) => (
            <div className="grid grid-cols-1 gap-2">
              <input className={input} placeholder="Section name, e.g. Certifications" value={c.title || ''} onChange={ev => patchItem('custom', i, { title: ev.target.value })} />
              <textarea className={`${input} min-h-[3rem]`} placeholder="Intro text (optional)" value={c.text || ''} onChange={ev => patchItem('custom', i, { text: ev.target.value })} />
              <Bullets value={c.bullets} onChange={b => patchItem('custom', i, { bullets: b })} />
            </div>
          )} />

        {/* Achievements */}
        <section className={card}>
          <h3 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Achievements</h3>
          <p className="mb-3 text-xs text-slate-400">One per line.</p>
          <textarea className={`${input} min-h-[6rem]`} value={(data.achievements || []).join('\n')} onChange={e => setSection('achievements', e.target.value.split('\n'))} />
        </section>
      </div>

      )}

      {/* Live PDF: compiled from the form (Editable) or from the LaTeX source (LaTeX) */}
      <div className={`resume-preview-wrap min-w-0 w-full max-w-full rounded-xl bg-slate-300 p-2 sm:p-4 dark:bg-slate-800 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-auto ${mobile === 'edit' ? 'hidden lg:block' : ''}`}>
        {mode === 'latex'
          ? <LivePdf title={title} pdfKey={`latex:${latexDraft ?? ''}`} run={(signal) => previewLatexRequest(latexDraft ?? '', signal)} />
          : <LivePdf title={title} pdfKey={`form:${JSON.stringify(payload)}`} run={(signal) => previewPdfRequest({ templateId: Number(templateId), data }, signal)} />}
      </div>
      </div>

    </Shell>
  )
}

// Bullet points, one per line.
function Bullets({ value, onChange }) {
  return (
    <div className="sm:col-span-2">
      {label('Bullet points (one per line)')}
      <textarea className={`${input} min-h-[6rem]`} value={(value || []).join('\n')} onChange={e => onChange(e.target.value.split('\n'))} />
    </div>
  )
}

// A repeating section: add, reorder and remove entries.
function Entries({ title, items, onAdd, onRemove, onMove, render }) {
  return (
    <section className={card}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <button onClick={onAdd} className={btnGhost}>+ Add</button>
      </div>
      <div className="space-y-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex justify-end gap-1">
              <button onClick={() => onMove(i, -1)} className={btnGhost} aria-label="Move up">↑</button>
              <button onClick={() => onMove(i, 1)} className={btnGhost} aria-label="Move down">↓</button>
              <button onClick={() => onRemove(i)} className={btnDanger}>Remove</button>
            </div>
            {render(it, i)}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Nothing here yet.</p>}
      </div>
    </section>
  )
}

// Live PDF: compiles on the server 1.2s after the last change. `run(signal)` makes the request.
function LivePdf({ title, pdfKey, run }) {
  const [url, setUrl] = useState(null)
  const [pdf, setPdf] = useState(null)     // the compiled PDF blob, for download
  const [status, setStatus] = useState('Compiling…')
  const [error, setError] = useState('')
  const [log, setLog] = useState('')
  const [retry, setRetry] = useState(0)     // bumped to re-run after the server was busy
  const [liked, setLiked] = useState(null)  // answer to "do you like it?"
  const [expanded, setExpanded] = useState(true)   // PDF fills the screen; open by default

  useEffect(() => {
    const ctrl = new AbortController()
    setStatus('Compiling…')
    const timer = setTimeout(async () => {
      try {
        const res = await run(ctrl.signal)
        if (res.status === 429) { setStatus('Busy, retrying…'); setTimeout(() => setRetry(r => r + 1), 2000); return }
        if (!res.ok) {
          const b = await res.json().catch(() => ({}))
          setError(b.error || 'Compile failed'); setLog(b.log || ''); setStatus('error'); return
        }
        const blob = await res.blob()
        setPdf(blob)
        setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob) })
        setError(''); setLog(''); setStatus('ready')
      } catch (e) {
        if (e.name !== 'AbortError') { setError('Could not compile right now.'); setStatus('error') }
      }
    }, 1200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [pdfKey, retry])

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  // Downloads the PDF on screen, exactly as compiled.
  const download = () => {
    if (!pdf) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(pdf)
    a.download = `${(title || 'resume').replace(/[^\w.-]+/g, '-')}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-slate-100 p-4 dark:bg-slate-900' : 'rounded-2xl bg-white p-3 shadow-xl ring-2 ring-blue-500/40 dark:bg-slate-900'}>
      <div className="no-print mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {status === 'ready' ? 'Live PDF · compiled from your details' : status}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(e => !e)} data-track="resume_pdf_expand" className="rounded-lg border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">{expanded ? 'Close full view' : 'Full view'}</button>
          <button onClick={download} disabled={!pdf} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Download PDF</button>
        </div>
      </div>
      {status !== 'ready' && status !== 'Compiling…' && (
        <div className="no-print mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">The preview isn't compiling right now.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={() => setRetry(r => r + 1)} data-track="resume_preview_retry" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Retry compile</button>
            <span className="text-xs text-slate-600 dark:text-slate-300">Do you like the resume builder so far?</span>
            <button onClick={() => setLiked(true)} data-track="resume_feedback_yes" aria-pressed={liked === true} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200">👍 Yes</button>
            <button onClick={() => setLiked(false)} data-track="resume_feedback_no" aria-pressed={liked === false} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200">👎 Not really</button>
          </div>
          {liked !== null && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{liked ? 'Thanks, glad it helps!' : 'Thanks for telling us. Tell us what felt off and we will look into it.'}</p>}
        </div>
      )}
      {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {log && <pre className="mb-2 max-h-40 overflow-auto rounded-lg bg-white selection:bg-blue-500/30 selection:text-slate-900 p-2 text-[11px] text-red-800">{log}</pre>}
      {url && <iframe title="Live PDF preview" src={url} className={`block w-full max-w-full rounded-lg bg-white ${expanded ? 'min-h-0 flex-1' : 'h-[85vh]'}`} />}
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="resume-shell min-h-screen bg-slate-100 p-6 dark:bg-slate-900">
      <div className="mx-auto max-w-[1600px]">
        <div className="no-print mb-4 flex items-center justify-between">
          <a href="/resume" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← All resumes</a>
        </div>
        {children}
      </div>
    </div>
  )
}
