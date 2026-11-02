import { useEffect, useRef, useState } from 'react'
import Loader from './Loader.jsx'
import { fetchAdminCodingProblems, fetchAdminCodingProblem, saveCodingProblem, deleteCodingProblem, importCodingProblems, saveCodingProblemAnalysis } from '../lib/codingProblems.js'
import { uploadImage } from '../lib/auth.js'
import Markdown from './Markdown.jsx'

const TEMPLATE_LANGS = [['cpp', 'C++'], ['c', 'C'], ['python', 'Python'], ['ruby', 'Ruby'], ['rust', 'Rust'], ['csharp', 'C#'], ['php', 'PHP'], ['swift', 'Swift'], ['java', 'Java'], ['go', 'Go'], ['javascript', 'JavaScript']]
const BLANK_TEMPLATE = { language: 'cpp', starter: '', driver: '' }
const EMPTY = { title: '', difficulty: 'Basic', topics: '', statement: '', templates: [BLANK_TEMPLATE], tests: [{ input: '', expected: '', hidden: false }] }

// Old problems stored one C++ starter and driver; new ones store one entry per language.
function templatesOf(p) {
  if (p.templates) {
    try {
      const rows = Object.entries(JSON.parse(p.templates)).map(([language, t]) => ({ language, starter: t.starter || '', driver: t.driver || '', prelude: t.prelude || '' }))
      if (rows.length) return rows
    } catch { /* fall through to the old fields */ }
  }
  if (p.starterCode || p.driver) return [{ language: 'cpp', starter: p.starterCode || '', driver: p.driver || '' }]
  return [BLANK_TEMPLATE]
}
// One test per line: "2 3 => 5". Use / for a new input line, and start a line with [hidden] to keep it secret.
function parseBulk(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).flatMap(line => {
    const hidden = /^\[hidden\]/i.test(line)
    const body = line.replace(/^\[hidden\]\s*/i, '')
    const at = body.indexOf('=>')
    if (at < 0) return []
    return [{
      input: body.slice(0, at).split('/').map(x => x.trim()).join('\n').trim(),
      expected: body.slice(at + 2).trim(),
      hidden,
    }]
  })
}

// The format a bulk import file must follow. Shown on the admin page.
const SAMPLE_IMPORT = JSON.stringify([
  {
    title: 'Two Sum',
    difficulty: 'Basic',
    topics: 'Array, Hash Table',
    statement: 'Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target.',
    testCases: [{ input: '4\n2 7 11 15\n9', expected: '0 1' }, { input: '3\n3 2 4\n6', expected: '1 2', hidden: true }],
    templates: {
      python: {
        starter: 'class Solution:\n    def twoSum(self, nums, target):\n        pass',
        driver: "import sys\n\ndata = sys.stdin.read().split()\nn = int(data[0])\nnums = [int(x) for x in data[1:1 + n]]\ntarget = int(data[1 + n])\nprint(*Solution().twoSum(nums, target))",
      },
    },
  },
], null, 2)

// Imports many problems from one JSON file. Problems that fail the check are skipped and listed.
function BulkImport({ onImported, onExport }) {
  const fileRef = useRef(null)
  const [items, setItems] = useState(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setItems(null); setFileName(''); setResult(null); setError('')
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!Array.isArray(parsed)) { setError('The file must hold a list of problems, in [ ... ] brackets.'); return }
        setItems(parsed); setFileName(file.name)
      } catch {
        setError('That file is not valid JSON.')
      }
    }
    reader.readAsText(file)
  }

  const importAll = async () => {
    setBusy(true); setError(''); setResult(null)
    try {
      const r = await importCodingProblems(items)
      setResult(r); setItems(null); setFileName('')
      onImported()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import / export problems (JSON)</h2>
        <div className="flex gap-2">
          {onExport && (
            // Sends you to the Export JSON tab rather than downloading here, so bulk export stays
            // behind the daily unlock code that tab already asks for.
            <button type="button" onClick={onExport} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">Export all</button>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">Choose file</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile} className="hidden" aria-label="Choose a JSON file of problems" />
      <p className="text-sm text-slate-600 dark:text-slate-400">Up to 1000 problems per file. Each needs a title, statement and test cases. Templates are optional.</p>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-blue-600 dark:text-blue-400">Show the format</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100">{SAMPLE_IMPORT}</pre>
      </details>

      {items && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">{fileName}: {items.length} problem{items.length === 1 ? '' : 's'} ready.</p>
          <button type="button" onClick={importAll} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? 'Importing…' : `Import ${items.length} problem${items.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {result && (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-400">Imported {result.saved} problem{result.saved === 1 ? '' : 's'}.</p>
          {result.failed.length > 0 && (
            <>
              <p className="text-red-600 dark:text-red-400">{result.failed.length} skipped:</p>
              <ul className="list-disc space-y-1 pl-5 text-red-600 dark:text-red-400">
                {result.failed.map(f => <li key={f.index}>#{f.index + 1} {f.title || '(no title)'}: {f.error}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

// Admin editor for LeetCode-style problems. Kept separate from the normal question form.
export default function CodingProblemsAdmin({ onExport }) {
  const [problems, setProblems] = useState(null)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const PAGE = 25
  // Numbered by position in the full list, the same as the Problems and Practice pages, so a problem keeps one number everywhere.
  const numberOf = new Map((problems || []).map((p, i) => [p.id, i + 1]))
  const needle = q.trim().toLowerCase().replace(/^#/, '')
  const shown = (problems || []).filter(p => !needle || p.title.toLowerCase().includes(needle) || String(numberOf.get(p.id)) === needle)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [editingAnalysis, setEditingAnalysis] = useState('')   // analysis of the problem being edited, as loaded
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [bulk, setBulk] = useState('')

  const addBulk = () => {
    const parsed = parseBulk(bulk)
    if (parsed.length === 0) { setMsg({ ok: false, text: 'Write tests as "input => output", one per line.' }); return }
    setForm(f => ({ ...f, tests: [...f.tests.filter(t => t.input.trim() || t.expected.trim()), ...parsed] }))
    setBulk('')
    setMsg({ ok: true, text: `Added ${parsed.length} test(s).` })
  }

  const load = () => fetchAdminCodingProblems().then(setProblems).catch(e => setMsg({ ok: false, text: e.message }))
  useEffect(() => { load() }, [])

  const setTest = (i, key, value) => setForm(f => ({ ...f, tests: f.tests.map((t, j) => j === i ? { ...t, [key]: value } : t) }))
  const addTest = () => setForm(f => ({ ...f, tests: [...f.tests, { input: '', expected: '', hidden: false }] }))
  const removeTest = i => setForm(f => ({ ...f, tests: f.tests.filter((_, j) => j !== i) }))
  const setTpl = (i, key, value) => setForm(f => ({ ...f, templates: f.templates.map((t, j) => j === i ? { ...t, [key]: value } : t) }))
  const addTpl = () => setForm(f => ({ ...f, templates: [...f.templates, { ...BLANK_TEMPLATE, language: 'python' }] }))
  const removeTpl = i => setForm(f => ({ ...f, templates: f.templates.filter((_, j) => j !== i) }))

  const edit = async summary => {
    let p
    try { p = await fetchAdminCodingProblem(summary.id) } catch (e) { setMsg({ ok: false, text: e.message }); return }
    let tests = []
    try { tests = JSON.parse(p.testCases) } catch { tests = [] }
    setForm({
      title: p.title || '',
      difficulty: p.difficulty || 'Basic',
      topics: p.topics || '',
      statement: p.statement || '',
      templates: templatesOf(p),
      tests: tests.length ? tests.map(t => ({ input: String(t.input ?? ''), expected: String(t.expected ?? ''), hidden: !!t.hidden })) : EMPTY.tests,
    })
    setEditingId(p.id)
    setEditingAnalysis(p.analysis || '')
    setMsg(null)
  }

  const reset = () => { setForm(EMPTY); setEditingId(null) }

  // Opens the problem and jumps to its Question analysis panel (after the editor has rendered).
  const openAnalysis = async p => {
    await edit(p)
    setTimeout(() => document.getElementById('analysis-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const save = async e => {
    e.preventDefault()
    setMsg(null); setBusy(true)
    const tests = form.tests
      .filter(t => t.expected.trim() !== '' || t.input.trim() !== '')
      .map(t => ({ input: t.input, expected: t.expected, ...(t.hidden ? { hidden: true } : {}) }))
    try {
      const byLanguage = {}
      // prelude is not editable here, but tree and list problems need it (it declares TreeNode/ListNode), so carry it through.
      form.templates.forEach(t => { if (t.starter.trim() || t.driver.trim()) byLanguage[t.language] = { starter: t.starter, driver: t.driver, ...(t.prelude ? { prelude: t.prelude } : {}) } })
      await saveCodingProblem(editingId, { title: form.title, difficulty: form.difficulty, topics: form.topics, statement: form.statement, templates: Object.keys(byLanguage).length ? JSON.stringify(byLanguage) : '', testCases: JSON.stringify(tests) })
      setMsg({ ok: true, text: editingId ? 'Problem updated.' : 'Problem added.' })
      reset()
      load()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const remove = async p => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return
    try {
      await deleteCodingProblem(p.id)
      if (editingId === p.id) reset()
      load()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingId ? 'Edit coding problem' : 'New coding problem'}</h2>
          {editingId && <button type="button" onClick={reset} className="text-sm text-slate-500 hover:underline">Cancel edit</button>}
        </div>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title, for example: Two Sum" required className={inputCls} />
        <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className={inputCls}>
          {['Basic', 'Intermediate', 'Advanced'].map(d => <option key={d}>{d}</option>)}
        </select>
        <input value={form.topics} onChange={e => setForm({ ...form, topics: e.target.value })} placeholder="Topics, comma separated, e.g. Array, Hash Table (leave empty to auto-detect)" className={inputCls} />
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Problem statement (Markdown)</label>
        <textarea value={form.statement} onChange={e => setForm({ ...form, statement: e.target.value })} rows={8} required
          placeholder={'Describe the task, the input and output format, and the examples.'} className={`${inputCls} font-mono text-sm`} />

        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Languages</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">For each language: the starter code members see, and the hidden driver that calls their function. Leave the driver empty for a plain program.</p>
        {form.templates.map((row, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <select value={row.language} onChange={e => setTpl(i, 'language', e.target.value)} className={inputCls}>
                {TEMPLATE_LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button type="button" onClick={() => removeTpl(i)} disabled={form.templates.length === 1} className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-40">Remove</button>
            </div>
            <textarea value={row.starter} onChange={e => setTpl(i, 'starter', e.target.value)} rows={5} placeholder="Starter code (what members see)" className={`${inputCls} font-mono text-sm`} />
            <textarea value={row.driver} onChange={e => setTpl(i, 'driver', e.target.value)} rows={6} placeholder="Driver (hidden main that calls the function)" className={`${inputCls} font-mono text-sm`} />
          </div>
        ))}
        <button type="button" onClick={addTpl} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">+ Add language</button>

        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Test cases</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Examples written in the statement as "Input: ... Output: ..." are added as tests automatically, so you can leave these empty. Add rows here for hidden tests. Tick "Hidden" to keep a test secret; members see only its pass or fail.</p>
        <div className="space-y-2">
          {form.tests.map((t, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700 sm:grid-cols-[1fr_1fr_auto]">
              <textarea value={t.input} onChange={e => setTest(i, 'input', e.target.value)} rows={2} placeholder="Input" className={`${inputCls} font-mono text-sm`} />
              <textarea value={t.expected} onChange={e => setTest(i, 'expected', e.target.value)} rows={2} placeholder="Expected output" className={`${inputCls} font-mono text-sm`} />
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={t.hidden} onChange={e => setTest(i, 'hidden', e.target.checked)} /> Hidden
                </label>
                <button type="button" onClick={() => removeTest(i)} disabled={form.tests.length === 1} className="text-xs text-red-600 hover:underline disabled:opacity-40">Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-600">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Paste many tests at once, one per line: <code>input =&gt; output</code>. Use <code>/</code> for a new input line, and start a line with <code>[hidden]</code> to hide it.</p>
          <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={4} placeholder={'4 / 2 7 11 15 / 9 => 0 1\n[hidden] 3 / 3 2 4 / 6 => 1 2'} className={`${inputCls} font-mono text-sm`} />
          <button type="button" onClick={addBulk} disabled={!bulk.trim()} className="mt-2 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Add tests</button>
        </div>
        <button type="button" onClick={addTest} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">+ Add test case</button>

        {msg && <p className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-60">
          {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add problem'}
        </button>
      </form>

      <div className="space-y-4">
        {/* Question analysis sits at the top so it's easy to find; the hint shows until a problem is opened. */}
        <div id="analysis-editor" className="scroll-mt-4">
          {editingId ? (
            <AnalysisEditor key={editingId} problemId={editingId} title={form.title} initial={editingAnalysis}
              onSaved={has => setProblems(list => list?.map(x => (x.id === editingId ? { ...x, hasAnalysis: has } : x)))} />
          ) : (
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4 text-sm text-slate-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Question analysis</p>
              <p className="mt-1">Click <strong>Analysis</strong> on any problem below to add a .md analysis with images. Members only see the Question Analysis tab when one is saved.</p>
            </div>
          )}
        </div>
        <BulkImport onImported={load} onExport={onExport} />
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Problems ({problems?.length ?? 0})</h2>
          <input
            type="search"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(0) }}
            placeholder="Search by title or #number"
            aria-label="Search problems"
            className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {!problems && <Loader compact />}
          {problems?.length === 0 && <p className="text-sm text-slate-500">No coding problems yet. Practice coding stays hidden until you add one.</p>}
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {shown.slice(page * PAGE, (page + 1) * PAGE).map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 text-slate-800 dark:text-slate-200"><span className="mr-2 inline-block w-12 text-xs tabular-nums text-slate-400">#{numberOf.get(p.id)}</span>{p.title} <span className="text-xs text-slate-400">· {p.difficulty}</span>{p.hasAnalysis && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Analysis</span>}</span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => edit(p)} className="text-blue-600 hover:underline dark:text-blue-400">Edit</button>
                  <button type="button" onClick={() => openAnalysis(p)} className="whitespace-nowrap text-emerald-600 hover:underline dark:text-emerald-400">{p.hasAnalysis ? 'Edit analysis' : 'Analysis'}</button>
                  <button type="button" onClick={() => remove(p)} className="text-red-600 hover:underline dark:text-red-400">Delete</button>
                </span>
              </li>
            ))}
          </ul>
          {shown.length > PAGE && (
            <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-600">Previous</button>
              <span className="tabular-nums">Page {page + 1} of {Math.ceil(shown.length / PAGE)} · {shown.length} problems</span>
              <button type="button" disabled={(page + 1) * PAGE >= shown.length} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-600">Next</button>
            </div>
          )}
        </div>
        {form.statement && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{form.title || 'Untitled problem'}</h3>
            <Markdown text={form.statement} />
          </div>
        )}
      </div>
    </div>
  )
}

// Question analysis for one problem: write Markdown or upload a .md file, add images, preview, save.
// Saved separately from the problem form. Members only see the "Question Analysis" tab when this is non-empty.
function AnalysisEditor({ problemId, title, initial, onSaved }) {
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState('')     // '' | 'uploading' | 'saving'
  const [msg, setMsg] = useState(null)
  const [preview, setPreview] = useState(false)
  const box = useRef(null)

  const loadMarkdown = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/\.(md|markdown|txt)$/i.test(file.name)) { setMsg({ ok: false, text: 'Choose a .md file.' }); return }
    if (text.trim() && !window.confirm('Replace the current analysis with this file?')) return
    setText(await file.text())
    setMsg({ ok: true, text: `Loaded ${file.name}. Add its images below, then save.` })
  }

  // Upload images; a reference to the same file name in the Markdown (e.g. ![x](tree.png)) is swapped for
  // the uploaded URL, anything else is inserted at the cursor.
  const addImages = async e => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setBusy('uploading'); setMsg(null)
    let next = text
    const inserted = []
    try {
      for (const file of files) {
        const url = await uploadImage(file)
        const name = file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const ref = new RegExp(`\\]\\((?:\\./)?(?:[^)]*/)?${name}\\)`, 'g')
        if (ref.test(next)) next = next.replace(ref, `](${url})`)
        else inserted.push(`![${file.name.replace(/\.[^.]+$/, '')}](${url})`)
      }
      if (inserted.length) {
        const at = box.current?.selectionStart ?? next.length
        next = next.slice(0, at) + (at && next[at - 1] !== '\n' ? '\n\n' : '') + inserted.join('\n\n') + '\n\n' + next.slice(at)
      }
      setText(next)
      setMsg({ ok: true, text: `Uploaded ${files.length} image${files.length > 1 ? 's' : ''}.` })
    } catch (err) {
      setText(next)
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy('')
    }
  }

  const save = async (value = text) => {
    setBusy('saving'); setMsg(null)
    try {
      const r = await saveCodingProblemAnalysis(problemId, value)
      setSaved(value.trim()); setText(value.trim())
      onSaved?.(r.hasAnalysis)
      setMsg({ ok: true, text: r.hasAnalysis ? 'Analysis saved. The Question Analysis tab is now shown for this problem.' : 'Analysis removed. The tab is hidden for this problem.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy('')
    }
  }

  const dirty = text.trim() !== (saved || '').trim()
  const btn = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Question analysis</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${saved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
          {saved ? 'Shown to members' : 'Hidden (no analysis)'}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">For "{title || 'this problem'}". Markdown: approach, complexity, code, diagrams. Members see the tab only when this is filled in.</p>
      <div className="flex flex-wrap gap-2">
        <label className={`${btn} cursor-pointer`}>Upload .md<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={loadMarkdown} className="hidden" /></label>
        <label className={`${btn} cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>{busy === 'uploading' ? 'Uploading…' : 'Add images'}<input type="file" accept="image/*" multiple onChange={addImages} className="hidden" /></label>
        <button type="button" onClick={() => setPreview(p => !p)} className={btn}>{preview ? 'Edit' : 'Preview'}</button>
      </div>
      {preview ? (
        <div className="min-h-[12rem] rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">{text.trim() ? <Markdown text={text} /> : <p className="text-slate-400">Nothing to preview yet.</p>}</div>
      ) : (
        <textarea ref={box} value={text} onChange={e => setText(e.target.value)} rows={14}
          placeholder={'## Approach\nUse a hash map to remember each value\'s index...\n\n## Complexity\nO(n) time, O(n) space.'}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      )}
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => save()} disabled={!!busy || !dirty} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy === 'saving' ? 'Saving…' : 'Save analysis'}
        </button>
        {saved && (
          <button type="button" disabled={!!busy} onClick={() => { if (window.confirm('Remove the analysis? The tab will be hidden for members.')) save('') }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20">Remove analysis</button>
        )}
      </div>
    </div>
  )
}
