import { useCallback, useEffect, useRef, useState } from 'react'
import CodeEditor, { FONTS } from './CodeEditor.jsx'
import { FeedbackEditor, FeedbackView } from './InterviewFeedback.jsx'
import { LANGUAGES, starterFor } from './CodeRunner.jsx'
import TopBar from './TopBar.jsx'
import Loader from './Loader.jsx'
import Markdown from './Markdown.jsx'
import { runCode, runTests } from '../lib/code.js'
import { fetchCodingProblem } from '../lib/codingProblems.js'
import { typeLabel, fetchLive, startLive, stepLive, saveLiveEditor, uploadDesignImage, saveDesignImageUrl, completeInterview } from '../lib/interviews.js'
import { uploadImage } from '../lib/auth.js'
import ImageLightbox from './ImageLightbox.jsx'
import InterviewQuestionPicker from './InterviewQuestionPicker.jsx'

const btn = 'rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60'
const primary = `${btn} bg-blue-600 text-white hover:bg-blue-700`
const secondary = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`

// The live room. The interviewer starts it and moves through the questions one at a time; the candidate's page
// follows (it checks every 3 seconds) and shows only the question being asked.
export default function LiveInterview({ id }) {
  const [s, setS] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [skew, setSkew] = useState(0)   // server clock minus this device's clock, so both people see the same timer
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const load = useCallback(() => fetchLive(id).then(d => { setSkew(new Date(d.serverNow).getTime() - Date.now()); setS(d) }).catch(e => setError(e.message)), [id])
  useEffect(() => {
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [load])

  const run = async fn => { setBusy(true); setError(''); try { setS(await fn()) } catch (e) { setError(e.message) } finally { setBusy(false) } }

  if (error && !s) return <Shell><p className="text-sm text-red-600 dark:text-red-400">{error}</p><a href="/interview" className="text-sm text-blue-600 hover:underline">← Back to interviews</a></Shell>
  if (!s) return <Shell><Loader label="Opening the interview room…" /></Shell>

  const interviewer = s.role === 'interviewer'
  const ended = s.status !== 'MATCHED'
  const clock = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }
  const sinceInterview = s.startedAt ? clock(now + skew - new Date(s.startedAt).getTime()) : null
  const sinceQuestion = s.questionStartedAt ? clock(now + skew - new Date(s.questionStartedAt).getTime()) : null

  // Presence tracking - consider someone online if seen in last 10 seconds
  const isOnline = (lastSeen) => lastSeen && (now + skew - new Date(lastSeen).getTime()) < 10000
  const otherOnline = interviewer ? isOnline(s.candidateLastSeen) : isOnline(s.interviewerLastSeen)
  const otherRole = interviewer ? 'candidate' : 'interviewer'

  return (
    <Shell>
      <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{typeLabel(s.type)} interview · you are the {s.role}</p>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Live room with {s.partner || 'your partner'}</h1>
            {!ended && !s.started && (
              <p className="mt-1 text-sm">
                {otherOnline
                  ? <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ {s.partner || 'Your ' + otherRole} is in the room</span>
                  : <span className="text-slate-500 dark:text-slate-400">Waiting for {s.partner || 'your ' + otherRole} to join...</span>
                }
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {s.callUrl && <a href={s.callUrl} target="_blank" rel="noopener noreferrer" className={primary}>Join video call ↗</a>}
            {s.whiteboardUrl && <a href={s.whiteboardUrl} target="_blank" rel="noopener noreferrer" className={secondary}>Shared whiteboard ↗</a>}
            {interviewer && <a href="/interview" className={secondary}>All interviews</a>}
          </div>
        </div>
        {!s.callUrl && !ended && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{interviewer ? 'Add your Google Meet link on the interviews page so the candidate can join.' : 'Your interviewer will add the Google Meet link shortly.'}</p>}
      </div>

      {ended ? (
        <div className="rounded-2xl bg-white p-6 text-center text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">This interview is {s.status.toLowerCase().replace('_', ' ')}.</p>
          <a href="/interview" className={`${secondary} mt-3 inline-block`}>Back to interviews</a>
        </div>
      ) : !s.started ? (
        interviewer ? (
          // Before starting, the interviewer fixes the questions right here; the candidate sees none of them yet.
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
              <InterviewQuestionPicker id={id} type={s.type} questions={s.plan || []} onChanged={load} />
            </div>
            <div className="flex flex-col justify-center rounded-2xl bg-white p-6 text-center dark:bg-slate-950">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {s.total ? `${s.total} question${s.total === 1 ? '' : 's'} ready` : 'No questions yet'}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {s.total ? 'Review them on the left, then start once the candidate has joined. The list is fixed after you start.' : 'Add at least one question on the left to start.'}
              </p>
              <button className={`${primary} mx-auto mt-4`} disabled={busy || s.total === 0} onClick={() => run(() => startLive(id))}>Start the interview</button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center dark:bg-slate-950">
            <Loader compact label="Waiting for your interviewer to start the interview…" />
          </div>
        )
      ) : s.allDone ? (
        <div className="rounded-2xl bg-white p-8 text-center dark:bg-slate-950">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">All {s.total} questions are done 🎉</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {interviewer
              ? 'The interview questions are complete. You can mark this interview as finished now and share your feedback.'
              : 'Thank you for practising. All questions are complete and your interviewer will share feedback.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button className={primary} disabled={busy} onClick={() => run(() => completeInterview(id).then(load))}>
              Mark as finished Interview
            </button>
            {interviewer && (
              <button className={secondary} disabled={busy} onClick={() => run(() => stepLive(id, s.total - 1))}>
                Back to the last question
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_2.2fr]">
          <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
            <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Question {s.index + 1} of {s.total}</p>
            {sinceInterview && (
              <div className="mb-3 flex gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200" title="Time since the interview started">⏱ {sinceInterview}</span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-mono font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" title="Time on this question">Q {sinceQuestion}</span>
              </div>
            )}
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-600 transition-all" style={{ width: `${((s.index + 1) / s.total) * 100}%` }} /></div>
            {interviewer && (
              <ol className="space-y-1 text-sm">
                {s.titles.map((t, i) => (
                  <li key={i}>
                    <button onClick={() => run(() => stepLive(id, i))} disabled={busy} className={`w-full rounded-lg px-2 py-1.5 text-left ${i === s.index ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : i < s.index ? 'text-slate-400 line-through' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                      {i + 1}. {t}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
            {s.question && (
              <>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{s.question.title}</h2>
                {s.question.body && <div className="mt-3 text-sm text-slate-700 dark:text-slate-300"><Markdown text={s.question.body} /></div>}
                {!interviewer && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Explain your answer out loud, and use the shared whiteboard to draw it. The next question appears here when your interviewer moves on.</p>}
              </>
            )}
            {interviewer && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button className={secondary} disabled={busy || s.index === 0} onClick={() => run(() => stepLive(id, s.index - 1))}>← Previous</button>
                <button className={primary} disabled={busy} onClick={() => run(() => stepLive(id, s.index + 1))}>{s.index + 1 >= s.total ? 'Finish questions' : 'Done, next question →'}</button>
              </div>
            )}
          </div>
        </div>
      )}
      {!ended && s.started && !s.allDone && s.type !== 'SYSTEM_DESIGN' && <SharedEditor key={s.index} id={id} remote={s.editor} problemId={s.question?.problemId} />}
      {!ended && s.started && !s.allDone && s.type === 'SYSTEM_DESIGN' && <SharedTextEditor id={id} remote={s.editor} initialText={s.designNotes} onSaved={load} />}
      {!ended && s.started && !s.allDone && s.type === 'SYSTEM_DESIGN' && <DesignImageUpload id={id} designImage={s.designImage} onUploaded={load} />}
      {s.started && interviewer && <FeedbackEditor key={s.feedback ? 'edit' : 'new'} id={id} existing={s.feedback} onSaved={load} />}
      {!interviewer && <FeedbackView feedback={s.feedback} />}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Shell>
  )
}

const LANGS = LANGUAGES.map(l => [l.key, l.label])

// Output of a plain run. A compile error leads with a clear heading and the compiler's message.
function runText(r, note = '') {
  if (r.compileOutput && /compil/i.test(r.status || '')) return [`❌ Compilation error`, note, '', r.compileOutput.trim()].filter(x => x !== undefined && x !== null).join('\n').replace(/\n{3,}/g, '\n\n')
  return [`${r.status}${r.time ? ` · ${r.time}s` : ''}`, note, r.compileOutput, r.stdout, r.stderr].filter(Boolean).join('\n')
}

// Shared output is plain text (it is synced through the server); colour it red when it reports a failure.
function isErrorOutput(text) {
  return /^(❌|✗|Compilation|Runtime Error|Time Limit|Memory Limit|Wrong Answer|Internal Error|Exec Format)/i.test(String(text).trim())
}

// The Java runner compiles the code as Main.java, so the class that holds main must be called Main. Whatever the
// candidate named it, rename it for the run, and drop `public` from other top-level classes (a file can have one).
// Returns { code } to run, or { error } when there is no main method at all (such as a problem's `class Solution`).
function prepareJava(src) {
  const mainAt = src.search(/static\s+void\s+main\s*\(/)
  if (mainAt < 0) return { error: 'This Java code has no main method, so it cannot run on its own. Add a main method, or use "Run test cases" for a coding problem.' }
  const before = [...src.slice(0, mainAt).matchAll(/\b(?:class|record|enum)\s+([A-Za-z_]\w*)/g)]
  const owner = before.length ? before[before.length - 1][1] : null
  let code = src
  if (owner && owner !== 'Main') code = code.replace(new RegExp(`\\b${owner}\\b`, 'g'), 'Main')
  code = code.replace(/\bpublic\s+(final\s+)?(class|interface|enum|record)\s+(?!Main\b)([A-Za-z_]\w*)/g, '$1$2 $3')
  return { code, renamed: owner && owner !== 'Main' ? owner : null }
}

// A code editor both people can type in. Changes are saved a moment after typing stops and picked up by the other
// side on its next check; the last change wins, and your own typing is never overwritten while you are in the middle of it.
function SharedEditor({ id, remote, problemId }) {
  // A coding problem brings its own starter code (the function signature) and test cases; anything else gets a runnable starter.
  const [starters, setStarters] = useState(null)
  useEffect(() => {
    if (!problemId) return
    fetchCodingProblem(problemId).then(p => setStarters(p.starters || {})).catch(() => setStarters({}))
  }, [problemId])
  const starter = l => (problemId && starters?.[l]) || starterFor(l)

  // An empty editor starts with the starter for the language (Java gets its Main class, C++ its main, and so on).
  const [code, setCode] = useState(remote.code || starterFor(remote.lang))
  const [lang, setLang] = useState(remote.lang)
  const lastRev = useRef(remote.rev)
  const typedAt = useRef(0)
  const timer = useRef(null)
  const [font, setFont] = useState(() => localStorage.getItem('ir_code_font') || 'consolas')
  const chooseFont = key => { setFont(key); localStorage.setItem('ir_code_font', key) }
  const [stdin, setStdin] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [localOut, setLocalOut] = useState(null)   // shown at once to whoever pressed Run; the other side gets it from the server

  useEffect(() => {
    if (remote.rev !== lastRev.current && Date.now() - typedAt.current > 2000) {
      lastRev.current = remote.rev
      setCode(remote.code || starter(remote.lang))
      setLang(remote.lang)
    }
  }, [remote])

  const save = (c, l) => {
    typedAt.current = Date.now()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => saveLiveEditor(id, c, l).then(r => { lastRev.current = r.rev }).catch(() => {}), 600)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!starters || !problemId) return
    setCode(c => (!c.trim() || LANGUAGES.some(l => starterFor(l.key) === c) ? (starters[lang] || c) : c))
  }, [starters])

  // Runs the code on the shared runner and shares the output with the other person.
  const run = async () => {
    setRunning(true); setLocalOut(null)
    clearTimeout(timer.current)
    let text
    try {
      // For coding problems, use runCode with problemId so it calls the Solution method
      if (problemId) {
        const r = await runCode({ language: lang, code, stdin, problemId, onStatus: setStatus })
        text = runText(r)
      } else {
        let toRun = code
        let note = ''
        if (lang === 'java') {
          const j = prepareJava(code)
          if (j.error) throw new Error(j.error)
          toRun = j.code
          if (j.renamed) note = `(The class ${j.renamed} was renamed to Main for this run.)`
        }
        const r = await runCode({ language: lang, code: toRun, stdin, onStatus: setStatus })
        text = runText(r, note)
      }
    } catch (e) {
      text = e.message
    }
    setLocalOut(text)
    typedAt.current = Date.now()
    saveLiveEditor(id, code, lang, text).then(r => { lastRev.current = r.rev }).catch(() => {})
    setRunning(false); setStatus('')
  }
  // Once the server has the output (ours or the other person's) show that, so a later run by the other side appears here.
  useEffect(() => { setLocalOut(null) }, [remote.output])
  // Coding problems: run the code against the problem's test cases and share which passed and which failed.
  const test = async (submit = false) => {
    setRunning(true); setLocalOut(null)
    clearTimeout(timer.current)
    let text
    try {
      const r = await runTests({ problemId, language: lang, code, submit, onStatus: setStatus })
      const results = r.results || []
      const compile = results.find(c => !c.passed && c.compileOutput)
      if (compile) {
        // The code didn't compile: every test fails the same way, so show the compiler's message once.
        text = `❌ Compilation error\n\n${compile.compileOutput.trim()}`
      } else {
        const lines = results.map(c => {
          if (c.passed) return `✓ Test ${c.number}`
          const reason = (!c.status || c.status === 'Accepted' || c.status === 'Wrong Answer' || c.status.toLowerCase() === 'failed') ? 'Failed' : c.status
          return `✗ Test ${c.number}: ${reason}`
        })
        // Details of the first failing visible test: its error, or what was expected against what came out.
        const first = results.find(c => !c.passed && !c.hidden)
        const detail = !first ? '' : first.stderr
          ? `\n\nTest ${first.number} error:\n${first.stderr.trim()}`
          : first.expected !== undefined
            ? `\n\nTest ${first.number}\nInput:\n${String(first.input ?? '').trim()}\nExpected:\n${String(first.expected).trim()}\nGot:\n${String(first.actual ?? '').trim() || '(no output)'}`
            : ''
        text = `${submit ? 'Submitted, with the hidden tests. ' : ''}${r.passed === r.total ? '✅ All tests passed' : `❌ ${r.passed} of ${r.total} tests passed`}\n${lines.join('\n')}${detail}`
      }
    } catch (e) {
      text = e.message
    }
    setLocalOut(text)
    typedAt.current = Date.now()
    saveLiveEditor(id, code, lang, text).then(r => { lastRev.current = r.rev }).catch(() => {})
    setRunning(false); setStatus('')
  }
  const output = localOut ?? remote.output

  return (
    <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Code editor <span className="font-normal text-slate-500">· shared, both of you can type</span></h3>
        <div className="flex items-center gap-2">
        <select value={font} onChange={e => chooseFont(e.target.value)} aria-label="Editor font" title="Editor font" className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {Object.entries(FONTS).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
        </select>
        <select value={lang} onChange={e => {
          const next = e.target.value
          // Untouched starter code (or an empty editor) switches to the new language's starter; the person's own code is kept.
          const fresh = !code.trim() || LANGUAGES.some(l => starterFor(l.key) === code) || Object.values(starters || {}).includes(code)
          const nextCode = fresh ? starter(next) : code
          setLang(next); setCode(nextCode); save(nextCode, next)
        }} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {LANGS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        </div>
      </div>
      {/* Fixed height: the editor fills it and scrolls inside, instead of a short editor in a taller empty frame. */}
      <div className="flex h-[360px]">
        <CodeEditor value={code} onChange={v => { setCode(v); save(v, lang) }} language={lang} font={font} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {problemId && <>
          <button type="button" onClick={() => test(false)} disabled={running || !code.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60" title="Runs the example test cases">{running ? (status || 'Running…') : '✔ Run test cases'}</button>
          <button type="button" onClick={() => { if (window.confirm('Submit runs every test, including the hidden ones, and is saved to the account that presses it. Submit now?')) test(true) }} disabled={running || !code.trim()} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60" title="Runs all tests, hidden ones included">⬆ Submit</button>
        </>}
        <button type="button" onClick={run} disabled={running || !code.trim()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" title={problemId ? "Run with custom input" : "Run code"}>{running && !status ? 'Running…' : problemId ? '▶ Run with input' : '▶ Run code'}</button>
        <details className="text-sm text-slate-600 dark:text-slate-300">
          <summary className="cursor-pointer">Input (stdin)</summary>
          <textarea value={stdin} onChange={e => setStdin(e.target.value)} rows={3} placeholder="Optional input for the program" className="mt-2 w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </details>
        {remote.by && <span className="text-xs text-slate-500 dark:text-slate-400">Last edited by the {remote.by}.</span>}
      </div>
      {output && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Output (shared)</p>
          <pre className={`max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs ${isErrorOutput(output) ? 'border border-rose-500/40 text-rose-300' : 'text-emerald-300'}`}>{output}</pre>
        </div>
      )}
    </div>
  )
}

// Shared text editor for system design interviews - simpler than code editor, just for notes and ideas
function SharedTextEditor({ id, remote, initialText, onSaved }) {
  const [text, setText] = useState(remote?.code || initialText || '')
  const lastRev = useRef(remote?.rev || 0)
  const typedAt = useRef(0)
  const timer = useRef(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const remoteText = remote?.code ?? initialText ?? ''
    if (remote?.rev !== lastRev.current && Date.now() - typedAt.current > 1500) {
      lastRev.current = remote?.rev
      setText(remoteText)
    }
  }, [remote, initialText])

  const save = (value) => {
    setText(value)
    typedAt.current = Date.now()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setSaving(true)
      saveLiveEditor(id, value, 'text', '')
        .then(r => {
          lastRev.current = r.rev
          setSaveError('')
          if (onSaved) onSaved()
        })
        .catch(err => {
          console.error('Failed to save discussion notes:', err)
          setSaveError(err.message || 'Could not save notes')
        })
        .finally(() => setSaving(false))
    }, 500)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Discussion Notes <span className="font-normal text-slate-500">· shared, both of you can type</span>
        </h3>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs font-medium text-blue-500 animate-pulse">Saving…</span>}
          {saveError && <span className="text-xs font-medium text-red-500">{saveError}</span>}
          {remote?.by && <span className="text-xs text-slate-500 dark:text-slate-400">Last edited by the {remote.by}</span>}
        </div>
      </div>
      <textarea
        value={text}
        onChange={e => save(e.target.value)}
        placeholder="Use this space to write down your approach, architecture, components, APIs, data flow, etc.&#10;&#10;Both of you can edit here to capture the discussion."
        rows={18}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        This is a shared text area. Changes are saved automatically and visible to both of you in real time.
      </p>
    </div>
  )
}

// Design image upload for system design interviews - both people can upload diagrams
function DesignImageUpload({ id, designImage, onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const fileRef = useRef(null)

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      await uploadDesignImage(id, file)
      setSuccess('Diagram uploaded successfully!')
      if (onUploaded) onUploaded()
    } catch (err) {
      console.warn('Direct design image upload failed, trying image upload fallback...', err)
      // Fallback: upload to general image service, then link URL to interview
      try {
        const url = await uploadImage(file)
        await saveDesignImageUrl(id, url)
        setSuccess('Diagram uploaded successfully!')
        if (onUploaded) onUploaded()
      } catch (fallbackErr) {
        setError(fallbackErr.message || err.message || 'Upload failed. Please try again.')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          System Design Diagram <span className="font-normal text-slate-500">· shared, both of you can see</span>
        </h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {uploading ? 'Uploading...' : designImage ? 'Replace Image' : 'Upload Diagram'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={upload}
          className="hidden"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mb-3 text-sm text-green-600 dark:text-green-400">{success}</p>}

      {designImage ? (
        <div className="space-y-2">
          <div className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <img
              src={designImage.url}
              alt="System design diagram"
              onClick={() => setLightboxOpen(true)}
              className="max-h-[380px] sm:max-h-[440px] w-auto max-w-full rounded-lg object-contain shadow-sm cursor-zoom-in transition duration-150 hover:opacity-95"
              onError={(e) => {
                e.target.style.display = 'none'
                setError('Failed to load image. The image might have been deleted.')
              }}
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-slate-900/75 px-3 py-1.5 text-xs font-medium text-white shadow backdrop-blur-sm transition hover:bg-slate-900 dark:bg-slate-800/90 dark:hover:bg-slate-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
              </svg>
              Click to enlarge
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Uploaded by the {designImage.by} {designImage.uploadedAt ? `· ${new Date(designImage.uploadedAt).toLocaleString()}` : ''}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Expand full view
              </button>
              <a
                href={designImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 hover:underline dark:text-slate-400"
              >
                Open in new tab ↗
              </a>
            </div>
          </div>
          {lightboxOpen && (
            <ImageLightbox
              src={designImage.url}
              alt="System design diagram"
              onClose={() => setLightboxOpen(false)}
            />
          )}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No diagram uploaded yet. Draw your system design and upload it here.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            PNG, JPG, or other image formats · Max 5 MB
          </p>
        </div>
      )}
    </div>
  )
}

function Shell({ children }) {
  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-slate-100 p-3 sm:p-4 dark:bg-slate-900"><div className="mx-auto max-w-[1500px] space-y-4">{children}</div></div>
    </>
  )
}
