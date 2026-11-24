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

export default function OnThisPage({ text, scrollRef, onActiveChange, open = true, onToggle }) {
  // Same id sequence the renderer uses (deduplicated), filtered to h1-h3 for display.
  const headings = useMemo(
    () => headingIds(text).filter(h => h.level <= 3).map(h => ({ ...h, label: cleanLabel(h.raw) })),
    [text]
  )

  const [activeId, setActiveId] = useState('')
  const [progress, setProgress] = useState(0)
  const [fillPx, setFillPx] = useState(0)
  const [collapsed, setCollapsed] = useState(() => new Set())   // ids of headings whose children are hidden
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
    setFillPx(el.offsetTop + 14.5) // centre of the node: button py-1 (4) + dot mt (5) + half dot (5.5)

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
  useEffect(() => { setActiveId(''); setProgress(0); setFillPx(0); setCollapsed(new Set()) }, [text])

  // Ancestors of a heading: the nearest earlier heading of each lower level.
  const ancestorsOf = (i) => {
    const out = []
    let level = headings[i].level
    for (let j = i - 1; j >= 0 && level > 1; j--) if (headings[j].level < level) { out.push(headings[j].id); level = headings[j].level }
    return out
  }

  // Scrolling into a collapsed section opens it so the active entry is never hidden.
  useEffect(() => {
    const i = headings.findIndex(h => h.id === activeId)
    if (i < 0) return
    const anc = ancestorsOf(i)
    setCollapsed(prev => anc.some(a => prev.has(a)) ? new Set([...prev].filter(id => !anc.includes(id))) : prev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const toggle = (id) => setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

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

  // Not worth a panel for a short answer; the icon below then stays visible but inactive.
  const available = headings.length >= 3

  const activeIndex = headings.findIndex(h => h.id === activeId)
  const hasKids = (i) => i + 1 < headings.length && headings[i + 1].level > headings[i].level
  // Hide everything under a collapsed heading until the next heading of the same or higher level.
  const visible = []
  let hideBelow = 0
  headings.forEach((h, i) => {
    if (hideBelow && h.level > hideBelow) return
    hideBelow = 0
    visible.push(i)
    if (collapsed.has(h.id) && hasKids(i)) hideBelow = h.level
  })

  // Collapsed: just an icon to bring the outline back; the article takes the freed width.
  if (!open || !available) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={!available}
        aria-label="Show sections"
        data-tip={available ? 'Show sections' : 'No sections in this answer'}
        className="tip hidden xl:flex fixed right-4 top-20 z-30 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-emerald-300"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" /></svg>
      </button>
    )
  }

  return (
    <nav
      aria-label="Sections in this answer"
      className="hidden xl:flex w-56 flex-shrink-0 self-stretch min-h-0 flex-col pl-2 pb-1"
    >
      <div className="flex items-baseline justify-between mb-3 pr-1 flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Sections
        </span>
        {onToggle && (
          <button type="button" onClick={onToggle} aria-label="Hide sections" title="Hide sections" className="ml-auto mr-2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </button>
        )}
        <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500" title="Reading progress">
          {Math.round(progress)}%
        </span>
      </div>

      <div ref={listRef} className="relative overflow-y-auto min-h-0 flex-1 pb-6 overscroll-contain">
        <div className="relative">
        {/* the rail: a track whose fill ends at the section you are reading */}
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
        <div
          className="absolute left-[5px] top-1 w-px bg-gradient-to-b from-emerald-300 to-emerald-500 shadow-[0_0_8px_1px_rgba(52,211,153,0.7)] transition-[height] duration-200 ease-out"
          style={{ height: `${Math.max(0, fillPx - 4)}px` }}
          aria-hidden="true"
        />

        <ul className="space-y-1 relative">
          {visible.map((i) => {
            const h = headings[i]
            const isActive = h.id === activeId
            const isPassed = activeIndex > -1 && i < activeIndex
            return (
              <li key={h.id} className="relative" ref={(el) => { itemRefs.current[h.id] = el }}>
                <button
                  onClick={() => jump(h.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`group w-full text-left flex items-start gap-2.5 rounded-md py-1 pr-6 transition-colors ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : isPassed
                      ? 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {/* node on the rail */}
                  {/* fixed 11px slot, centred on the rail (rail centre = 5.5px), so every dot sits exactly on the line */}
                  <span className="relative mt-[5px] flex h-[11px] w-[11px] flex-shrink-0 items-center justify-center" aria-hidden="true">
                    <span
                      className={`block rounded-full transition-all duration-200 ${
                        isActive
                          ? 'h-[11px] w-[11px] bg-emerald-400 ring-4 ring-emerald-400/25 shadow-[0_0_12px_4px_rgba(52,211,153,0.75)]'
                          : isPassed
                          ? 'h-[7px] w-[7px] bg-emerald-400 shadow-[0_0_7px_1px_rgba(52,211,153,0.6)]'
                          : 'h-[7px] w-[7px] border border-slate-300 bg-white group-hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900'
                      }`}
                    />
                  </span>
                  <span
                    className={`flex-1 text-[13px] leading-snug transition-all ${
                      isActive ? 'font-semibold' : 'font-normal'
                    } ${h.level === 3 ? 'pl-2.5 text-[12px]' : ''}`}
                  >
                    {h.label}
                  </span>
                </button>
                {hasKids(i) && (
                  <button
                    type="button"
                    onClick={() => toggle(h.id)}
                    aria-expanded={!collapsed.has(h.id)}
                    aria-label={`${collapsed.has(h.id) ? 'Expand' : 'Collapse'} ${h.label}`}
                    className="absolute right-0 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-700/60 dark:hover:text-slate-200"
                  >
                    <svg className={`h-3.5 w-3.5 transition-transform ${collapsed.has(h.id) ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        </div>
      </div>
    </nav>
  )
}
