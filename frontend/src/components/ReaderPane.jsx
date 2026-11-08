import AnswerExtras from './AnswerExtras.jsx'
import ListenButton from './ListenButton.jsx'
import AnswerPractice from './AnswerPractice.jsx'
import ShareLinkedIn from './ShareLinkedIn.jsx'
import { useState, useEffect, useRef } from 'react'
import { useReadTracking } from '../lib/analytics.js'
import Markdown from './Markdown.jsx'
import NotFound from './NotFound.jsx'
import ReaderLoading from './ReaderLoading.jsx'
import OnThisPage from './OnThisPage.jsx'
import AskedAt from './AskedAt.jsx'
import SuggestEdit from './SuggestEdit.jsx'
import MarkDuplicate from './MarkDuplicate.jsx'
import EstimationQuickReference from './EstimationQuickReference.jsx'
import { isLoggedIn } from '../lib/auth.js'
import { techBadge, difficultyBadge, techLabel } from '../lib/badges.js'
import { useFullQuestion } from '../lib/useFullQuestion.js'

/**
 * Inline-editable question position: click the number, type a new one, press Enter to jump.
 */
function JumpToQuestion({ current, total, onJump }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(current))

  // Keep the shown value in sync when navigating by other means.
  useEffect(() => { setVal(String(current)) }, [current])

  const commit = () => {
    setEditing(false)
    const n = parseInt(val, 10)
    if (Number.isNaN(n)) { setVal(String(current)); return }
    onJump(Math.min(Math.max(n, 1), total))
  }

  if (editing) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400/60 dark:ring-blue-500/50 px-2 py-0.5 align-middle shadow-sm">
        <input
            autoFocus
            type="number"
            min={1}
            max={total}
            value={val}
            onChange={e => setVal(e.target.value)}
            onFocus={e => e.target.select()}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') { setVal(String(current)); setEditing(false) }
            }}
            className="jump-input w-10 text-center bg-transparent font-semibold text-blue-700 dark:text-blue-300 focus:outline-none tabular-nums"
            aria-label="Jump to question number"
        />
        <button
            type="button"
            onPointerDown={e => { e.preventDefault(); commit() }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            aria-label="Go to question"
            title="Go"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </span>
    )
  }

  return (
      <button
          onClick={() => setEditing(true)}
          className="group inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/50 hover:bg-blue-100 dark:hover:bg-emerald-900/40 hover:text-blue-700 dark:hover:text-emerald-300 transition-colors tabular-nums"
          title="Click to jump to a question"
      >
        {current}
        <svg className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
  )
}

/**
 * Reader pane component
 */
export default function ReaderPane({ question: listQuestion, questions, onNavigate, visited, read, flagged, flagging, important, marking, onMarkRead, onToggleFlag, onToggleImportant, loading = false, urlNotFound = false, onPremium }) {
  const scrollRef = useRef(null)   // attached to the scrollable answer container
  // List rows carry no answer text; it is fetched when the question opens (and the next one quietly in advance).
  const listIdx = questions.findIndex(q => q.id === listQuestion?.id)
  const { question, answerLoading } = useFullQuestion(listQuestion, questions[listIdx + 1]?.id)
  useReadTracking(question?.id, scrollRef)

  // The action bar hides while the answer scrolls down and returns when it scrolls up or reaches the top.
  const [barHidden, setBarHidden] = useState(false)
  const [activeSection, setActiveSection] = useState(null)
  const [referenceDismissed, setReferenceDismissed] = useState(false)
  useEffect(() => { setBarHidden(false) }, [question?.id])
  useEffect(() => { setActiveSection(null); setReferenceDismissed(false) }, [question?.id])
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Hysteresis: switch only after a real scroll in one direction, and not again within 250ms.
    // Otherwise the bar's own show/hide shifts the layout and the scroll position, and it blinks.
    // A movement made during the cooldown is applied when it ends, so a quick scroll back still shows the bar.
    let last = el.scrollTop, run = 0, lastToggle = 0, timer = null
    const decide = () => {
      const y = el.scrollTop
      const now = performance.now()
      if (now - lastToggle < 250) {
        clearTimeout(timer)
        timer = setTimeout(decide, 260 - (now - lastToggle))
        return
      }
      // Show again only when the answer is back near its top (within 10% of its height).
      const nearTop = y <= el.clientHeight * 0.1
      if (run > 24 && y > 60) { setBarHidden(true); lastToggle = now; run = 0 }
      else if (nearTop) { setBarHidden(false); lastToggle = now; run = 0 }
    }
    const onScroll = () => {
      const y = el.scrollTop
      const d = y - last
      last = y
      run = Math.sign(d) === Math.sign(run) ? run + d : d
      decide()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(timer) }
  }, [question?.id, loading])

  const selectedIndex = questions.findIndex(q => q.id === question?.id)
  const prev = questions[selectedIndex - 1]
  const next = questions[selectedIndex + 1]
  const estimationHeading = `${activeSection?.label || ''} ${activeSection?.parent?.label || ''}`
  const isEstimationSection = question?.tech === 'hld' && /(?:back[-\s]?of[-\s]?the[-\s]?envelope|capacity\s*(?:math|calculation|planning)?|estimat(?:e|ion)|traffic\s*(?:math|calculation)|throughput|bandwidth|storage(?:\s*(?:growth|sizing|planning|calculation))?|data\s*growth|sizing)/i.test(estimationHeading)

  // Add keyboard navigation listener for arrow keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.key === 'ArrowRight' && next) {
        onNavigate(next.id)
      } else if (e.key === 'ArrowLeft' && prev) {
        onNavigate(prev.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [next, prev, onNavigate])

  if (!question) {
    return (
        <main className="reader flex-1 flex items-center justify-center bg-white dark:bg-slate-800 min-w-0">
          {loading ? <ReaderLoading /> : urlNotFound
            ? <NotFound title="Question not found" message="This link doesn't match any question. Pick one from the sidebar." />
            : <NotFound />}
        </main>
    )
  }

  return (
      <main className="reader flex-1 h-full overflow-hidden bg-white dark:bg-slate-800 flex flex-col min-w-0">
        <div className="reader-body flex-1 overflow-hidden py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8 min-w-0 flex flex-col">
          {/* Article plus the section rail */}
          <div className="mx-auto w-full max-w-5xl xl:max-w-[76rem] 2xl:max-w-[88rem] flex gap-6 items-start h-full min-w-0">

            {/* Article takes 100% of the available vertical height and acts as a flex container */}
            <article className="paper flex-1 min-w-0 h-full bg-white dark:bg-slate-800 rounded-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15),0_0_20px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(0,0,0,0.3)] p-4 sm:p-6 lg:p-8 flex flex-col overflow-hidden">

              {/* Mobile top navigation */}
              <div className="lg:hidden mb-4 flex items-center justify-between flex-shrink-0">
                <button
                    disabled={!prev}
                    onClick={() => onNavigate(prev.id)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-sm"
                    aria-label="Previous question"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex-1 text-center px-2">
                  <JumpToQuestion current={selectedIndex + 1} total={questions.length} onJump={n => onNavigate(questions[n - 1].id)} /> / {questions.length}
                </div>
                <button
                    disabled={!next}
                    onClick={() => onNavigate(next.id)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-sm"
                    aria-label="Next question"
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Header stays pinned at the top */}
              <header className="mb-3 pb-3 sm:mb-4 sm:pb-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                <div className="badges mb-2 flex items-center justify-between gap-3 px-0.5 sm:mb-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className={`badge px-2.5 py-0.5 text-xs font-medium rounded-full ${techBadge(question.tech)}`}>
                      {techLabel(question.tech)}
                    </span>
                    <span className="badge max-w-[11rem] truncate px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {question.category}
                    </span>
                    <span className={`badge px-2.5 py-0.5 text-xs font-medium rounded-full ${difficultyBadge(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  </div>

                  {isLoggedIn() && (
                    <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1" aria-label="Question actions">
                      <button
                        type="button"
                        onClick={() => onToggleFlag(question.id)}
                        disabled={flagging.has(question.id)}
                        className={`reader-action-tooltip inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-wait disabled:opacity-70 ${flagged.has(question.id) ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60' : 'text-slate-500 hover:bg-amber-50 hover:text-amber-700 dark:text-slate-400 dark:hover:bg-amber-900/30 dark:hover:text-amber-200'}`}
                        aria-label={flagged.has(question.id) ? 'Remove flag' : 'Flag question'}
                        aria-pressed={flagged.has(question.id)}
                        data-tip={flagged.has(question.id) ? 'Remove flag' : 'Flag question'}
                      >
                        <svg className="h-5 w-5" fill={flagged.has(question.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v18l7-4 7 4V3H5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleImportant(question.id)}
                        disabled={marking.has(question.id)}
                        className={`reader-action-tooltip inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-wait disabled:opacity-70 ${important.has(question.id) ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-900/60' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-200'}`}
                        aria-label={important.has(question.id) ? 'Unmark important' : 'Mark as important'}
                        aria-pressed={important.has(question.id)}
                        data-tip={important.has(question.id) ? 'Unmark important' : 'Mark as important'}
                      >
                        <svg className="h-5 w-5" fill={important.has(question.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.5a.56.56 0 011.04 0l2.13 5.11 5.52.44a.56.56 0 01.32.99l-4.2 3.6 1.28 5.38a.56.56 0 01-.84.61L12 16.77l-4.73 2.86a.56.56 0 01-.84-.61l1.28-5.38-4.2-3.6a.56.56 0 01.32-.99l5.52-.44 2.13-5.11z" />
                        </svg>
                      </button>
                      {!read.has(question.id) ? (
                        <button type="button" onClick={() => onMarkRead(question.id)} className="reader-action-tooltip inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300" aria-label="Mark as read" data-tip="Mark as read">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        </button>
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center text-emerald-600 dark:text-emerald-400" aria-label="Marked as read" title="Marked as read"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></span>
                      )}
                      <SuggestEdit question={question} compact />
                      <MarkDuplicate question={question} compact />
                      <AnswerPractice question={question} compact />
                      <ListenButton question={question} compact />
                      <ShareLinkedIn question={question} label="" className="!h-9 !min-h-9 !w-9 !px-0 shadow-sm" />
                    </div>
                  )}
                </div>
                <h1 className="question-title text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Q{question.displayNumber}. {question.question}
                </h1>
                {!isLoggedIn() && (
                    <div className="mt-2 flex justify-end gap-2">
                      <ListenButton question={question} />
                      <ShareLinkedIn question={question} />
                    </div>
                )}

                <div className={`mt-2 transition-all duration-300 ease-out ${barHidden ? 'max-lg:max-h-0 max-lg:opacity-0 max-lg:-translate-y-2 max-lg:pointer-events-none max-lg:overflow-hidden' : 'max-h-96 opacity-100 translate-y-0'}`}>
                  <AskedAt questionId={question.id} />
                </div>
              </header>

              {/* ONLY this answer content area scrolls (scrollRef is attached here) */}
              <div ref={scrollRef} className="answer-content flex-1 overflow-y-auto pr-2" style={{ overflowAnchor: 'none' }}>
                {question.locked ? (
                  <div className="mt-8 max-w-xl mx-auto text-center rounded-2xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-8">
                    <div className="text-3xl" aria-hidden="true">🔒</div>
                    <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">This answer is part of Premium</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">The first few questions of every topic are free to read. Go Premium to unlock the rest, plus company-wise filters and full roadmaps.</p>
                    <button onClick={onPremium} className="mt-4 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm transition-colors">Unlock with Premium</button>
                  </div>
                ) : (<>
                {answerLoading ? (
                  <div className="space-y-3 animate-pulse" aria-label="Loading answer" role="status">
                    {[92, 100, 85, 96, 60].map((w, i) => <div key={i} className="h-4 rounded bg-slate-200 dark:bg-slate-700" style={{ width: `${w}%` }} />)}
                  </div>
                ) : <Markdown text={question.answer || ''} animateMermaid={question.tech === 'hld'} />}
                <AnswerExtras question={question} />
                </>)}
              </div>

              {/* Bottom Navigation stays pinned at the bottom of the card — desktop only, mobile has its own top nav */}
              <div className="hidden lg:flex mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 items-center justify-between flex-shrink-0">
                <button
                    disabled={!prev}
                    onClick={() => onNavigate(prev.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  <span className="hidden sm:inline">Question </span>
                  <JumpToQuestion current={selectedIndex + 1} total={questions.length} onJump={n => onNavigate(questions[n - 1].id)} /> of {questions.length}
                </div>

                <button
                    disabled={!next}
                    onClick={() => onNavigate(next.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </article>

            <OnThisPage text={question.answer || ''} scrollRef={scrollRef} onActiveChange={setActiveSection} />
          </div>
        </div>
        {isEstimationSection && !referenceDismissed && <EstimationQuickReference onClose={() => setReferenceDismissed(true)} />}
      </main>
  )
}
