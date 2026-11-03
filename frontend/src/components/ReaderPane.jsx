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
import { isLoggedIn } from '../lib/auth.js'
import { techBadge, difficultyBadge, techLabel } from '../lib/badges.js'

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
export default function ReaderPane({ question, questions, onNavigate, visited, read, flagged, flagging, important, marking, onMarkRead, onToggleFlag, onToggleImportant, loading = false, urlNotFound = false }) {
  const scrollRef = useRef(null)   // attached to the scrollable answer container
  useReadTracking(question?.id, scrollRef)

  // The action bar hides while the answer scrolls down and returns when it scrolls up or reaches the top.
  const [barHidden, setBarHidden] = useState(false)
  useEffect(() => { setBarHidden(false) }, [question?.id])
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
        <div className="flex-1 overflow-hidden py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8 min-w-0 flex flex-col">
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
              <header className="mb-3 pb-3 sm:mb-6 sm:pb-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                <div className="badges flex items-center justify-between mb-2 sm:mb-4 px-0.5">
                <span className={`badge px-3 py-1 text-xs font-medium rounded-full ${techBadge(question.tech)}`}>
                  {techLabel(question.tech)}
                </span>
                  <span className="badge px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {question.category}
                </span>
                  <span className={`badge px-3 py-1 text-xs font-medium rounded-full ${difficultyBadge(question.difficulty)}`}>
                  {question.difficulty}
                </span>
                </div>
                <h1 className="question-title text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Q{question.displayNumber}. {question.question}
                </h1>

                {isLoggedIn() && (
                    <div className={`mt-3 pt-3 sm:mt-5 sm:pt-4 flex flex-wrap transition-all duration-300 ease-out ${barHidden ? 'max-lg:max-h-0 max-lg:opacity-0 max-lg:-translate-y-2 max-lg:pointer-events-none max-lg:overflow-hidden max-lg:border-transparent max-lg:!mt-0 max-lg:!pt-0' : 'max-h-96 opacity-100 translate-y-0'} items-center justify-between gap-1.5 sm:gap-2 border-t border-slate-200 dark:border-slate-800`}>
                      <div className="flex items-center gap-2 sm:gap-3 text-sm">
                        {read.has(question.id) && (
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="hidden sm:inline">Marked as read</span>
                      </span>
                        )}
                        {visited.has(question.id) && !read.has(question.id) && (
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        <span className="hidden sm:inline">Visited</span>
                      </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 has-[form,[role=status]]:basis-full">
                        <button
                            type="button"
                            onClick={() => onToggleFlag(question.id)}
                            disabled={flagging.has(question.id)}
                            className={`inline-flex min-h-9 sm:min-h-11 items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-70 ${flagged.has(question.id) ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60' : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-900/30 dark:hover:text-amber-200'}`}
                            aria-label={flagged.has(question.id) ? 'Remove flag' : 'Flag question'}
                            aria-pressed={flagged.has(question.id)}
                            title={flagged.has(question.id) ? 'Remove flag' : 'Flag question'}
                        >
                          <svg className="w-5 h-5" fill={flagged.has(question.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v18l7-4 7 4V3H5z" />
                          </svg>
                          <span className="hidden sm:inline">{flagging.has(question.id) ? 'Saving…' : flagged.has(question.id) ? 'Flagged' : 'Flag'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onToggleImportant(question.id)}
                            disabled={marking.has(question.id)}
                            className={`inline-flex min-h-9 sm:min-h-11 items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-70 ${important.has(question.id) ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-900/60' : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-rose-900/30 dark:hover:text-rose-200'}`}
                            aria-label={important.has(question.id) ? 'Unmark important' : 'Mark as important'}
                            aria-pressed={important.has(question.id)}
                            title={important.has(question.id) ? 'Unmark important' : 'Mark as important'}
                        >
                          <svg className="w-5 h-5" fill={important.has(question.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.5a.56.56 0 011.04 0l2.13 5.11 5.52.44a.56.56 0 01.32.99l-4.2 3.6 1.28 5.38a.56.56 0 01-.84.61L12 16.77l-4.73 2.86a.56.56 0 01-.84-.61l1.28-5.38-4.2-3.6a.56.56 0 01.32-.99l5.52-.44 2.13-5.11z" />
                          </svg>
                          <span className="hidden sm:inline">{marking.has(question.id) ? 'Saving…' : important.has(question.id) ? 'Important' : 'Mark important'}</span>
                        </button>
                        {!read.has(question.id) && (
                            <button
                                type="button"
                                onClick={() => onMarkRead(question.id)}
                                className="btn-read inline-flex min-h-9 sm:min-h-11 items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
                                aria-label="Mark as read"
                                title="Mark as read"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </button>
                        )}
                        {read.has(question.id) && (
                            <span className="p-2 text-emerald-600 dark:text-emerald-400" aria-label="Read" title="Marked as read">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                        )}
                        <SuggestEdit question={question} />
                        <MarkDuplicate question={question} />
                        <ShareLinkedIn question={question} />
                      </div>
                    </div>
                )}
                {!isLoggedIn() && (
                    <div className="mt-3 flex justify-end">
                      <ShareLinkedIn question={question} />
                    </div>
                )}

                <div className={`transition-all duration-300 ease-out ${barHidden ? 'max-lg:max-h-0 max-lg:opacity-0 max-lg:-translate-y-2 max-lg:pointer-events-none max-lg:overflow-hidden' : 'max-h-96 opacity-100 translate-y-0'}`}>
                  <AskedAt questionId={question.id} />
                </div>
              </header>

              {/* ONLY this answer content area scrolls (scrollRef is attached here) */}
              <div ref={scrollRef} className="answer-content flex-1 overflow-y-auto pr-2" style={{ overflowAnchor: 'none' }}>
                <Markdown text={question.answer} />
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

            <OnThisPage text={question.answer} scrollRef={scrollRef} />
          </div>
        </div>
      </main>
  )
}