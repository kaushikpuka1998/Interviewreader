import { useEffect, useMemo, useRef, useState } from 'react'
import { getUser, isLoggedIn } from '../lib/auth.js'
import { runCode, runTests, fetchSubmission } from '../lib/code.js'
import { paramsOf, exampleOf, toFields, toStdin } from '../lib/testcases.js'
import { trackClick } from '../lib/analytics.js'
import TestResults from './TestResults.jsx'
import TreeDiagram, { ListDiagram, parseTreeInput } from './TreeDiagram.jsx'
import CodeEditor, { FONTS, formatCode } from './CodeEditor.jsx'

export const LANGUAGES = [
  { key: 'java', label: 'Java', starter: ['public class Main {', '    public static void main(String[] args) {', '        System.out.println("Hello, world!");', '    }', '}'] },
  { key: 'cpp', label: 'C++', starter: ['#include <iostream>', 'int main() {', '    std::cout << "Hello, world!" << std::endl;', '    return 0;', '}'] },
  { key: 'c', label: 'C', starter: ['#include <stdio.h>', 'int main(void) {', '    printf("Hello, world!\\n");', '    return 0;', '}'] },
  { key: 'python', label: 'Python', starter: ['print("Hello, world!")'] },
  { key: 'javascript', label: 'JavaScript', starter: ['console.log("Hello, world!")'] },
  { key: 'go', label: 'Go', starter: ['package main', '', 'import "fmt"', '', 'func main() {', '\tfmt.Println("Hello, world!")', '}'] },
  { key: 'ruby', label: 'Ruby', starter: ['puts "Hello, world!"'] },
  { key: 'rust', label: 'Rust', starter: ['fn main() {', '    println!("Hello, world!");', '}'] },
  { key: 'csharp', label: 'C#', starter: ['using System;', 'class Program {', '    static void Main() {', '        Console.WriteLine("Hello, world!");', '    }', '}'] },
  { key: 'php', label: 'PHP', starter: ['<?php', 'echo "Hello, world!\\n";'] },
  { key: 'swift', label: 'Swift', starter: ['print("Hello, world!")'] },
]


// File extensions each language accepts, for the upload button.
const EXTENSIONS = {
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'], c: ['.c', '.h'], python: ['.py'], go: ['.go'], ruby: ['.rb'],
  rust: ['.rs'], kotlin: ['.kt', '.kts'], csharp: ['.cs'], php: ['.php'], swift: ['.swift'], java: ['.java'],
  javascript: ['.js', '.mjs', '.cjs'],
}
const MAX_FILE_BYTES = 100_000

export const languageLabel = key => LANGUAGES.find(l => l.key === key)?.label || key

export const starterFor = key => LANGUAGES.find(l => l.key === key).starter.join('\n')

const ICON_PATHS = {
  format: <path d="M8 4c-2 0-2 1-2 3v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 2 0 3 2 3M16 4c2 0 2 1 2 3v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 2 0 3-2 3" />,
  last: <path d="M6 3h12v18l-6-4-6 4z" />,
  reset: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5" /></>,
}

function IconButton({ label, icon, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tip={label}
      aria-label={label}
      className="tip tip-below relative rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">{ICON_PATHS[icon]}</svg>
    </button>
  )
}

// Code box for practice problems. Runs on the server for signed-in members only.
// `history` and `openRequest` come from the practice page: openRequest.id opens a saved submission in the editor.
const MAX_CASES = 6
const sameOutput = (a, b) => String(a ?? '').split('\n').map(l => l.trimEnd()).join('\n').trim() === String(b ?? '').split('\n').map(l => l.trimEnd()).join('\n').trim()

export default function CodeRunner({ problemId, statement = '', starters = null, history = [], onSubmitted, openRequest, actionsRef, onBusyChange, afterAccepted = null }) {
  // Coding problems offer only the languages they have a starter for. Own-code practice offers all of them.
  // A coding problem opens in the first of its own options, so LANGUAGES order sets the default: Java leads
  // the array deliberately. Problems without a Java starter (tree and linked list ones) fall through to C++.
  const starterKeys = starters ? Object.keys(starters) : []
  const options = starters && starterKeys.length ? LANGUAGES.filter(l => starterKeys.includes(l.key)) : LANGUAGES
  const firstLanguage = starters && options.length ? options[0].key : 'cpp'
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [language, setLanguage] = useState(firstLanguage)
  // A coding problem starts from its starter for that language. Own-code practice starts from Hello world.
  // Drafts are kept in the browser per problem and language, so a refresh does not lose the code.
  // Drafts belong to the signed-in account, so another account on this browser starts from its own draft.
  const draftKey = lang => `ir_draft_${getUser()?.email ?? 'guest'}_${problemId ?? 'custom'}_${lang}`
  const readDraft = lang => localStorage.getItem(draftKey(lang))
  const [code, setCode] = useState(() => readDraft(firstLanguage) ?? (problemId ? (starters?.[firstLanguage] ?? '') : starterFor('cpp')))
  const updateCode = (value, lang = language) => { setCode(value); localStorage.setItem(draftKey(lang), value) }
  const [stdin, setStdin] = useState('')
  const [showInput, setShowInput] = useState(false)
  // Custom cases for a coding problem, one field per parameter. Case 1 starts as the statement's example;
  // a case keeps its expected output only until one of its fields is edited.
  const params = useMemo(() => paramsOf(statement), [statement])
  const nextCaseId = useRef(1)
  const [cases, setCases] = useState(() => {
    const ex = exampleOf(statement)
    const p = paramsOf(statement)
    return [{ id: 0, fields: ex ? toFields(p, ex.input) : (p || [null]).map(() => ''), expected: ex?.expected ?? null }]
  })
  const [activeCase, setActiveCase] = useState(0)
  const [caseResults, setCaseResults] = useState(null)
  const [activeResult, setActiveResult] = useState(0)
  const editField = (j, value) => setCases(cs => cs.map((c, i) => (i === activeCase ? { ...c, fields: c.fields.map((f, k) => (k === j ? value : f)), expected: null } : c)))
  const addCase = () => {
    setCases(cs => [...cs, { ...cs[activeCase], id: nextCaseId.current++ }])
    setActiveCase(cases.length)
    setCaseResults(null)
  }
  const removeCase = i => {
    setCases(cs => cs.filter((_, k) => k !== i))
    setActiveCase(a => Math.max(0, a >= i ? a - 1 : a))
    setCaseResults(null)
  }
  const [result, setResult] = useState(null)
  const [accepted, setAccepted] = useState(false)   // the latest submission passed every test
  const [nextOpen, setNextOpen] = useState(false)   // the floating "solve next" card
  useEffect(() => { setNextOpen(accepted) }, [accepted])
  useEffect(() => {
    if (!nextOpen) return
    const onKey = e => { if (e.key === 'Escape') setNextOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextOpen])
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const signedIn = isLoggedIn()
  const fileRef = useRef(null)
  const [status, setStatus] = useState('')
  const [font, setFont] = useState(() => localStorage.getItem('ir_code_font') || 'consolas')
  const chooseFont = key => { setFont(key); localStorage.setItem('ir_code_font', key) }

  // Loads a file into the editor. A recognised extension also switches the language.
  const onFile = e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_BYTES) { setError('That file is too large (max 100 KB).'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const name = file.name.toLowerCase()
      const match = LANGUAGES.find(l => (EXTENSIONS[l.key] || []).some(ext => name.endsWith(ext)))
      if (match) setLanguage(match.key)
      updateCode(String(reader.result))
      setResult(null)
      setError('')
    }
    reader.readAsText(file)
  }

  const pickLanguage = key => {
    trackClick(`code_language:${key}`)
    setLanguage(key)
    setCode(readDraft(key) ?? (problemId ? (starters?.[key] ?? '') : starterFor(key)))
    setResult(null)
    setError('')
  }

  // The page's bar calls these. Refreshed on every render so they always see the current code and language.
  useEffect(() => {
    if (actionsRef) actionsRef.current = { run: () => (problemId ? check(false) : run()), submit: () => check(true) }
  })
  useEffect(() => { onBusyChange?.(testing || running) }, [testing, running])

  // A saved submission opened from the Submissions tab loads into the editor.
  useEffect(() => {
    if (!openRequest) return
    fetchSubmission(openRequest.id).then(d => {
      updateCode(d.code, d.language); setLanguage(d.language); setResult(null)
      setTestResult({ passed: d.passed, total: d.total, results: d.results, verdict: d.status }); setAccepted(false)
    }).catch(e => setError(e.message))
  }, [openRequest])

  // Reset drops the draft and goes back to the starter code for this language.
  const [confirmReset, setConfirmReset] = useState(false)
  // Largest height of the part below the editor (Run, input, results, submissions). It shrinks to its content, so 0 means no limit.
  const [bottomH, setBottomH] = useState(() => Number(localStorage.getItem('ir_code_bottom_h')) || 0)
  const bottomRef = useRef(null)
  const startBottomDrag = e => {
    e.preventDefault()
    const startY = e.clientY
    const startH = bottomH || bottomRef.current.offsetHeight
    const move = ev => setBottomH(Math.min(window.innerHeight * 0.8, Math.max(120, startH + (startY - ev.clientY))))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setBottomH(value => { localStorage.setItem('ir_code_bottom_h', String(Math.round(value))); return value })
    }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  // A short note under the toolbar, so each icon's click has a visible result.
  const [note, setNote] = useState('')
  const noteTimer = useRef(null)
  const flash = msg => { setNote(msg); clearTimeout(noteTimer.current); noteTimer.current = setTimeout(() => setNote(''), 2500) }
  const resetCode = () => {
    localStorage.removeItem(draftKey(language))
    setCode(problemId ? (starters?.[language] ?? '') : starterFor(language))
    setResult(null); setTestResult(null); setAccepted(false); setError('')
    setConfirmReset(false)
  }

  // Loads the newest saved submission in this language, if there is one.
  const lastSubmission = history.find(h => h.language === language)
  // Loads only the code. The test results are not fetched.
  const loadLastSubmission = () => fetchSubmission(lastSubmission.id).then(d => {
    updateCode(d.code, d.language)
    setResult(null)
    flash(`Loaded your last ${languageLabel(d.language)} submission (${d.status}).`)
  }).catch(e => setError(e.message))

  const format = () => {
    const next = formatCode(code, language)
    updateCode(next)
    flash(next === code ? 'Already formatted.' : 'Formatted.')
  }

  // Run checks the visible tests. Submit checks every test and saves the attempt.
  const check = async (saveIt = false) => {
    setTesting(true); setError(''); setTestResult(null); setAccepted(false)
    try {
      const r = await runTests({ problemId, language, code, submit: saveIt, onStatus: setStatus })
      setTestResult(r)
      // A submission that passes every test is a solve: that's when the "solve next" suggestions appear.
      setAccepted(saveIt && r.total > 0 && r.passed === r.total)
      if (saveIt) onSubmitted?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setTesting(false)
      setStatus('')
    }
  }

  const run = async () => {
    trackClick(`code_run:${language}`)
    setRunning(true); setError(''); setResult(null); setTestResult(null); setAccepted(false)
    try {
      setResult(await runCode({ language, code, stdin, problemId, onStatus: setStatus }))
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
      setStatus('')
    }
  }

  // Runs every custom case at once. Each result remembers its case's expected output, if known.
  const runCases = async () => {
    trackClick(`code_run_cases:${language}`)
    setRunning(true); setError(''); setResult(null); setTestResult(null); setAccepted(false); setCaseResults(null)
    try {
      const out = await Promise.all(cases.map(c =>
        runCode({ language, code, stdin: toStdin(params, c.fields), problemId, onStatus: setStatus }).then(r => ({ ...r, expected: c.expected }))))
      setCaseResults(out)
      setActiveResult(Math.min(activeCase, out.length - 1))
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
      setStatus('')
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 xl:flex xl:h-full xl:flex-col dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={language}
          onChange={e => pickLanguage(e.target.value)}
          aria-label="Language"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {options.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {problemId ? (
            <button
              type="button"
              onClick={() => setShowInput(v => !v)}
              aria-expanded={showInput}
              className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {showInput ? 'Hide custom input' : 'Custom input'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(v => !v)}
              className="whitespace-nowrap text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {showInput ? 'Hide input' : 'Add input'}
            </button>
          )}
          <IconButton label="Format code" icon="format" onClick={format} />
          {problemId && (
            <>
              <IconButton label={lastSubmission ? 'Load last submitted code' : 'No saved submission in this language yet'} icon="last" onClick={loadLastSubmission} disabled={!lastSubmission} />
              <IconButton label="Reset to starter code" icon="reset" onClick={() => setConfirmReset(true)} />
            </>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-track="code_upload"
            className="whitespace-nowrap rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            Upload file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={(EXTENSIONS[language] || []).join(',')}
            onChange={onFile}
            className="hidden"
            aria-label="Upload a code file"
          />
          <select
            value={font}
            onChange={e => chooseFont(e.target.value)}
            aria-label="Editor font"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {Object.entries(FONTS).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {note && <p className="mb-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">{note}</p>}

      <CodeEditor value={code} onChange={updateCode} language={language} font={font} />


      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the panel below the editor"
        onMouseDown={startBottomDrag}
        className="mt-3 flex cursor-row-resize flex-col items-center gap-3 py-2"
      >
        <span className="h-1 w-16 rounded-full bg-slate-300 dark:bg-slate-700" />
      </div>

      <div ref={bottomRef} style={bottomH ? { maxHeight: bottomH } : undefined} className={`xl:min-h-0 xl:max-h-[45%] xl:overflow-y-auto ${bottomH ? 'overflow-y-auto pr-1' : ''}`}>

      {problemId && showInput && (
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1 overflow-x-auto px-2 pt-2" role="tablist" aria-label="Custom test cases">
            {cases.map((c, i) => (
              <div key={c.id} className="group relative shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === activeCase}
                  onClick={() => setActiveCase(i)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${i === activeCase ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
                >
                  Case {i + 1}
                </button>
                {cases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCase(i)}
                    aria-label={`Remove case ${i + 1}`}
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-[11px] leading-none text-white group-hover:flex group-focus-within:flex"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {cases.length < MAX_CASES && (
              <button type="button" onClick={addCase} aria-label="Add a case (copies the current one)" title="Add a case" className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">+</button>
            )}
          </div>
          <div className="space-y-3 p-3">
            {params ? params.map((p, j) => (
              <label key={p.name} className="block">
                <span className="mb-1 block font-mono text-xs text-slate-500 dark:text-slate-400">{p.name} =</span>
                <input
                  value={cases[activeCase]?.fields[j] ?? ''}
                  onChange={e => editField(j, e.target.value)}
                  spellCheck={false}
                  placeholder={p.type === 'tree' ? '[1,2,3,null,4]' : p.type === 'list' || p.type === 'int[]' ? '[1,2,3]' : ''}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                {(p.type === 'tree' || p.type === 'list') && (
                  <div className="mt-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    {p.type === 'tree'
                      ? <TreeDiagram values={parseTreeInput(cases[activeCase]?.fields[j])} />
                      : <ListDiagram values={parseTreeInput(cases[activeCase]?.fields[j])} />}
                  </div>
                )}
              </label>
            )) : (
              <textarea
                value={cases[activeCase]?.fields[0] ?? ''}
                onChange={e => editField(0, e.target.value)}
                rows={3}
                spellCheck={false}
                aria-label="Program input"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-[13px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            )}
            {params?.some(p => p.type === 'tree') && <p className="text-xs text-slate-500 dark:text-slate-400">Trees are level order with null for a missing child, e.g. [2,3,1,null,1].</p>}
          </div>
        </div>
      )}

      {!problemId && showInput && (
        <div className="mt-3">
          <textarea
            value={stdin}
            onChange={e => setStdin(e.target.value)}
            rows={3}
            placeholder="Input for your program (optional)"
            aria-label="Program input"
            className="w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-[13px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}

      {problemId && showInput && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={runCases}
            disabled={!signedIn || running || testing || !code.trim()}
            data-track="code_run_custom"
            className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-slate-800"
          >
            {running ? 'Running…' : cases.length > 1 ? `Run ${cases.length} custom cases` : 'Run custom case'}
          </button>
        </div>
      )}

      {confirmReset && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="reset-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setConfirmReset(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h4 id="reset-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">Reset this code?</h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your current code will be replaced with the starter code. This can't be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmReset(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={resetCode} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700">Reset</button>
            </div>
          </div>
        </div>
      )}

      {(testing || running) && (
        <div role="progressbar" aria-label="Running your code" className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="run-sweep h-full w-1/3 rounded-full bg-blue-500" />
        </div>
      )}
      {status && <p className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {testResult && <TestResults data={testResult} />}
      {/* After an accepted submission the suggestions float in the middle of the screen; once closed, a button brings them back. */}
      {testResult && accepted && afterAccepted && !nextOpen && (
        <button type="button" onClick={() => setNextOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          🎉 See what to solve next
        </button>
      )}
      {testResult && accepted && afterAccepted && nextOpen && (
        <div role="dialog" aria-modal="true" aria-label="Solve next" onClick={() => setNextOpen(false)}
          className="premium-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div onClick={e => e.stopPropagation()} className="relative w-full max-w-xl">
            <button type="button" onClick={() => setNextOpen(false)} aria-label="Close" autoFocus
              className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-md hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white">✕</button>
            {/* Success first, then what to solve next. */}
            <div className="result-pop mb-3 flex items-center gap-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xl dark:border-emerald-500/30 dark:bg-slate-900">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path className="premium-check" d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <span>
                <span className="block text-xl font-extrabold text-emerald-600 dark:text-emerald-400">Accepted</span>
                <span className="block text-sm text-slate-600 dark:text-slate-300">
                  {testResult.total === testResult.passed && testResult.total > 1 ? `All ${testResult.total} test cases passed` : `${testResult.passed}/${testResult.total} test case passed`}. Nice work!
                </span>
              </span>
            </div>
            {afterAccepted}
            <div className="mt-2 text-center">
              <button type="button" onClick={() => setNextOpen(false)} className="text-xs font-medium text-white/80 hover:text-white hover:underline">Review my solution</button>
            </div>
          </div>
        </div>
      )}

      {caseResults && <CaseResults results={caseResults} active={activeResult} onPick={setActiveResult} />}

      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {result.status}{result.time ? ` · ${result.time}s` : ''}{result.memoryKb ? ` · ${Math.round(result.memoryKb / 1024)} MB` : ''}
          </p>
          {result.compileOutput && <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-red-950 p-3 text-xs text-red-200">{result.compileOutput}</pre>}
          {result.stdout && <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-emerald-300">{result.stdout}</pre>}
          {result.stderr && <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-red-950 p-3 text-xs text-red-200">{result.stderr}</pre>}
          {!result.stdout && !result.stderr && !result.compileOutput && <p className="text-sm text-slate-500 dark:text-slate-400">No output.</p>}
        </div>
      )}
      </div>
    </section>
  )
}

// Results of the custom cases: a tab per case, green or red when the case has a known expected output.
function CaseResults({ results, active, onPick }) {
  const r = results[active] || results[0]
  const verdict = x => (x.expected == null || x.compileOutput || x.stderr ? null : sameOutput(x.stdout, x.expected))
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Custom case results">
        {results.map((x, i) => {
          const v = verdict(x)
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => onPick(i)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${i === active ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
            >
              {v !== null && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${v ? 'bg-emerald-500' : 'bg-rose-500'}`} />}
              Case {i + 1}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {r.status}{r.time ? ` · ${r.time}s` : ''}{r.memoryKb ? ` · ${Math.round(r.memoryKb / 1024)} MB` : ''}
      </p>
      {r.compileOutput && <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-red-950 p-3 text-xs text-red-200">{r.compileOutput}</pre>}
      {r.stderr && <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-red-950 p-3 text-xs text-red-200">{r.stderr}</pre>}
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Output</p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-emerald-300">{r.stdout || ' '}</pre>
      {r.expected != null && (
        <>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Expected</p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{r.expected || ' '}</pre>
        </>
      )}
    </div>
  )
}
