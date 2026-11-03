import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { speechSupported, summaryScript, fullScript, pickVoice, findSpoken } from '../lib/speech.js'
import { trackClick } from '../lib/analytics.js'

const RATES = [1, 1.25, 1.5, 0.75]
const RATE_KEY = 'ir_tts_rate'

// "Listen": reads the answer aloud with the browser's voice. Choose a short summary or the full answer; a small
// panel shows what is being read (the current sentence highlighted) with pause, stop and speed.
// Sentences are spoken one by one: one long utterance gets cut off in Chrome after about 15 seconds.
export default function ListenButton({ question }) {
  const [menu, setMenu] = useState(false)
  const [mode, setMode] = useState(null)        // null | 'summary' | 'full'
  const [lines, setLines] = useState([])
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  const [rate, setRate] = useState(() => Number(localStorage.getItem(RATE_KEY)) || 1)
  const run = useRef(0)                          // bumps on every start/stop, so stale callbacks do nothing
  const box = useRef(null)
  const pop = useRef(null)                       // the menu / player, rendered at the top of the page
  const [pos, setPos] = useState(null)           // { top, right } under the button, in viewport pixels
  const current = useRef(null)
  const follow = useRef({ last: -1, el: null })   // where the reading is in the answer on the page

  const unfocus = () => { follow.current.el?.classList.remove('tts-focus'); follow.current = { last: -1, el: null } }

  const stop = () => {
    run.current++
    unfocus()
    window.speechSynthesis?.cancel()
    setMode(null); setPaused(false); setAt(0)
  }

  const speakFrom = (all, i, r, id) => {
    if (id !== run.current) return
    if (i >= all.length) { setMode(null); setAt(0); unfocus(); return }
    setAt(i)
    const u = new SpeechSynthesisUtterance(all[i])
    const voice = pickVoice()
    if (voice) { u.voice = voice; u.lang = voice.lang }
    u.rate = r
    u.onend = () => speakFrom(all, i + 1, r, id)
    u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') speakFrom(all, i + 1, r, id) }
    window.speechSynthesis.speak(u)
  }

  const start = (m, from = 0, r = rate) => {
    window.speechSynthesis.cancel()
    if (from === 0) unfocus()
    const all = m === 'summary' ? summaryScript(question.title, question.answer) : fullScript(question.title, question.answer)
    const id = ++run.current
    setLines(all); setMode(m); setPaused(false); setMenu(false)
    if (from === 0) trackClick(`listen:${m}`)
    // Voices load asynchronously the first time; wait for them so the first sentence isn't read by a default voice.
    // Whichever comes first starts it, once: the voices-loaded event or a short fallback timer (some browsers never
    // fire the event). Starting from both read every sentence twice.
    if (!window.speechSynthesis.getVoices().length) {
      let begun = false
      const begin = () => {
        if (begun) return
        begun = true
        window.speechSynthesis.onvoiceschanged = null
        speakFrom(all, from, r, id)
      }
      window.speechSynthesis.onvoiceschanged = begin
      setTimeout(begin, 400)
    } else speakFrom(all, from, r, id)
  }

  const togglePause = () => {
    if (paused) { window.speechSynthesis.resume(); setPaused(false) }
    else { window.speechSynthesis.pause(); setPaused(true) }
  }

  const changeRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    setRate(next)
    localStorage.setItem(RATE_KEY, String(next))
    if (mode) start(mode, at, next)   // restart the current sentence at the new speed
  }

  // A new question, or leaving the page, stops the reading.
  useEffect(() => stop, [question?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the current line visible inside the panel's own list. Not scrollIntoView: that also moves the page and
  // cancels the smooth scroll that brings the matching part of the answer into view.
  useEffect(() => {
    const li = current.current, list = li?.parentElement
    if (!li || !list) return
    if (li.offsetTop < list.scrollTop || li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = li.offsetTop - list.clientHeight / 3
  }, [at])
  // Follow along in the answer: highlight the paragraph, list item, heading or code block being read, and keep it
  // in view. The question itself (the first line) has nothing to highlight in the answer.
  useEffect(() => {
    if (!mode) return
    const root = box.current?.closest('[data-reader]')?.querySelector('.markdown') || document.querySelector('.markdown')
    const el = at === 0 ? null : findSpoken(root, lines[at] || '', follow.current)
    if (!el || el === follow.current.el) return
    follow.current.el?.classList.remove('tts-focus')
    el.classList.add('tts-focus')
    follow.current.el = el
    // Glide to nearby parts; jump straight to far ones (a summary of a long answer starts near the end, and a long
    // smooth scroll lags behind the voice).
    const r = el.getBoundingClientRect()
    const far = r.bottom < -window.innerHeight || r.top > window.innerHeight * 2
    el.scrollIntoView({ block: 'center', behavior: far ? 'auto' : 'smooth' })
  }, [at, mode]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!menu) return
    const off = e => { if (!box.current?.contains(e.target) && !pop.current?.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [menu])
  // The menu and player are portalled to <body>: inside the reader's action bar (which animates with a transform)
  // the answer below painted over them and swallowed clicks. Keep them pinned under the button.
  const open = menu || !!mode
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = box.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  if (!speechSupported() || !question?.answer) return null
  const btn = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors sm:min-h-11 sm:gap-2 sm:px-3'
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => (mode ? stop() : setMenu(m => !m))} aria-expanded={menu}
        aria-label={mode ? 'Stop reading' : 'Listen to this answer'} title={mode ? 'Stop reading' : 'Listen'}
        className={`${btn} ${mode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-900/30 dark:hover:text-blue-200'}`}>
        {mode ? (
          <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
            {[0, 1, 2].map(i => <span key={i} className={`w-[3px] rounded-full bg-white ${paused ? 'h-2' : 'animate-pulse'}`} style={{ height: paused ? undefined : `${[10, 16, 12][i]}px`, animationDelay: `${i * 150}ms` }} />)}
          </span>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 14v-2a9 9 0 0118 0v2M3 14a2 2 0 012-2h1v7H5a2 2 0 01-2-2v-3zm18 0a2 2 0 00-2-2h-1v7h1a2 2 0 002-2v-3z" />
          </svg>
        )}
        <span className="hidden sm:inline">{mode ? 'Stop' : 'Listen'}</span>
      </button>

      {menu && !mode && pos && createPortal(
        <div ref={pop} role="menu" style={{ top: pos.top, right: pos.right }} className="fixed z-[60] w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {[['summary', 'Summary', 'The gist, 1–2 minutes'], ['full', 'Full answer', 'Everything, code is announced']].map(([m, label, sub]) => (
            <button key={m} type="button" role="menuitem" onClick={() => start(m)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="mt-0.5 text-blue-600 dark:text-blue-400" aria-hidden="true">▶</span>
              <span><span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{sub}</span></span>
            </button>
          ))}
        </div>,
        document.body,
      )}

      {mode && pos && createPortal(
        <div ref={pop} style={{ top: pos.top, right: pos.right }} className="fixed z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900" role="region" aria-label="Reading aloud">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">{mode === 'summary' ? 'Summary' : 'Full answer'} · {at + 1}/{lines.length}</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={togglePause} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" aria-label={paused ? 'Resume' : 'Pause'}>{paused ? '▶ Resume' : '❚❚ Pause'}</button>
              <button type="button" onClick={changeRate} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" title="Speed: click to change">{rate}×</button>
              <button type="button" onClick={stop} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" aria-label="Stop">■ Stop</button>
            </div>
          </div>
          <ol className="relative max-h-56 space-y-1 overflow-y-auto pr-1 text-sm leading-relaxed">
            {lines.map((l, i) => (
              <li key={i} ref={i === at ? current : null} onClick={() => start(mode, i)} title="Read from here"
                className={`cursor-pointer rounded px-1.5 py-0.5 transition-colors ${i === at ? 'bg-blue-100 font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-100' : i < at ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                {l}
              </li>
            ))}
          </ol>
        </div>,
        document.body,
      )}
    </div>
  )
}
