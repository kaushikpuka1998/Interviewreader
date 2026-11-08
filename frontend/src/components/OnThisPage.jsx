import { useEffect, useMemo, useRef, useState } from 'react'
import { headingIds } from './Markdown.jsx'

/**
 * Section outline for the current answer.
 *
 * Design note: rather than a separate progress bar above a plain list, the rail
 * itself IS the progress indicator — it fills from the top down to the section you
 * are currently reading, so the fill and the highlighted node always agree.
 */

function cleanLabel(raw) {
  return String(raw)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
}

export default function OnThisPage({ text, scrollRef, onActiveChange }) {
  // Same id sequence the renderer uses (deduplicated), filtered to h1-h3 for display.
  const headings = useMemo(
    () => headingIds(text).filter(h => h.level <= 3).map(h => ({ ...h, label: cleanLabel(h.raw) })),
    [text]
  )

  const [activeId, setActiveId] = useState('')
  const [progress, setProgress] = useState(0)
  const [fillPx, setFillPx] = useState(0)
  const listRef = useRef(null)
  const itemRefs = useRef({})

  // Track scroll progress and which section is currently in view.
  useEffect(() => {
    const scroller = scrollRef?.current
    if (!scroller || headings.length === 0) return

    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight
      setProgress(max > 0 ? Math.min(100, Math.max(0, (scroller.scrollTop / max) * 100)) : 0)

      // Active = last heading whose top has crossed a line ~1/3 down the viewport.
      const line = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.33
      let current = ''
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= line) current = h.id
      }
      // Once scrolled to the very bottom, the last section is the one being read.
      if (max > 0 && scroller.scrollTop >= max - 2) current = headings[headings.length - 1].id
      setActiveId(current || headings[0].id)
    }

    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [headings, scrollRef, text])

  // Fill the rail down to the middle of the active node, so the gradient and the
  // highlighted item can never disagree (raw scroll % did not line up with them).
  useEffect(() => {
    const el = itemRefs.current[activeId]
    const list = listRef.current
    if (!el || !list) { setFillPx(0); return }
    setFillPx(el.offsetTop + el.offsetHeight / 2)

    // Keep the active entry visible when the outline is longer than the rail.
    if (list.scrollHeight > list.clientHeight) {
      const top = el.offsetTop
      const bottom = top + el.offsetHeight
      if (top < list.scrollTop + 8 || bottom > list.scrollTop + list.clientHeight - 8) {
        list.scrollTo({ top: top - list.clientHeight / 2 + el.offsetHeight / 2, behavior: 'smooth' })
      }
    }
  }, [activeId, headings])

  // Reset when the question changes.
  useEffect(() => { setActiveId(''); setProgress(0); setFillPx(0) }, [text])

  useEffect(() => {
    const active = headings.find(heading => heading.id === activeId)
    if (!active) { onActiveChange?.(null); return }
    const activeIndex = headings.findIndex(heading => heading.id === active.id)
    const parent = headings.slice(0, activeIndex).reverse().find(heading => heading.level < active.level) || null
    onActiveChange?.({ ...active, parent })
  }, [activeId, headings, onActiveChange])

  const jump = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  // Not worth the chrome for a short answer.
  if (headings.length < 3) return null

  const activeIndex = headings.findIndex(h => h.id === activeId)

  return (
    <nav
      aria-label="Sections in this answer"
      className="hidden xl:flex w-56 flex-shrink-0 sticky top-6 self-start max-h-[calc(100vh-6rem)] flex-col pl-2"
    >
      <div className="flex items-baseline justify-between mb-3 pr-1 flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Sections
        </span>
        <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500" title="Reading progress">
          {Math.round(progress)}%
        </span>
      </div>

      <div ref={listRef} className="relative overflow-y-auto min-h-0">
        {/* the rail: a track whose fill ends at the section you are reading */}
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
        <div
          className="absolute left-[5px] top-1 w-px bg-gradient-to-b from-blue-500 to-indigo-500 transition-[height] duration-200 ease-out"
          style={{ height: `${Math.max(0, fillPx - 4)}px` }}
          aria-hidden="true"
        />

        <ul className="space-y-1 relative">
          {headings.map((h, i) => {
            const isActive = h.id === activeId
            const isPassed = activeIndex > -1 && i < activeIndex
            return (
              <li key={h.id} ref={(el) => { itemRefs.current[h.id] = el }}>
                <button
                  onClick={() => jump(h.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`group w-full text-left flex items-start gap-2.5 rounded-md py-1 pr-1 transition-colors ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : isPassed
                      ? 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {/* node on the rail */}
                  <span className="relative mt-[7px] flex-shrink-0" aria-hidden="true">
                    <span
                      className={`block rounded-full transition-all duration-150 ${
                        isActive
                          ? 'w-[11px] h-[11px] -ml-[3px] bg-blue-500 ring-4 ring-blue-500/20'
                          : isPassed
                          ? 'w-[5px] h-[5px] bg-indigo-400 dark:bg-indigo-500'
                          : 'w-[5px] h-[5px] bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400'
                      }`}
                    />
                  </span>
                  <span
                    className={`text-[13px] leading-snug transition-all ${
                      isActive ? 'font-semibold' : 'font-normal'
                    } ${h.level === 3 ? 'pl-2.5 text-[12px]' : ''}`}
                  >
                    {h.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
