import { useEffect, useRef, useState } from 'react'
import ImageLightbox from './ImageLightbox.jsx'

// ponytail: mermaid is ~500KB, so it is dynamically imported — Vite splits it into
// its own chunk that only downloads when a question actually contains a diagram.
let mermaidPromise = null
function loadMermaid(dark) {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const m = mod.default
      m.initialize({
        startOnLoad: false,
        securityLevel: 'strict',   // no click handlers / raw HTML injection from diagram text
        theme: dark ? 'dark' : 'default',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        // Scale diagrams down to fit the container so nothing is ever cut off,
        // and tighten the default spacing so they do not waste horizontal room.
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          padding: 8,
          nodeSpacing: 30,      // default 50
          rankSpacing: 40,      // default 50
          curve: 'basis',
        },
        sequence: {
          useMaxWidth: true,
          diagramMarginX: 8,
          diagramMarginY: 8,
          boxMargin: 6,
          actorMargin: 40,      // default 50
        },
        gantt: { useMaxWidth: true },
        er: { useMaxWidth: true },
        journey: { useMaxWidth: true },
        class: { useMaxWidth: true },
        state: { useMaxWidth: true },
      })
      return m
    })
  }
  return mermaidPromise
}

let idCounter = 0

// Text in answers is often typeset: "-->" arrives as "⟶" and "→". Mermaid only understands the ASCII
// arrows, so put them back before parsing. Other text is left untouched.
function normalizeDiagram(src) {
  return src
    .replace(/\u27F6|\u2192|\u27F9/g, '-->')   // ⟶ → ⟹
    .replace(/\u27F5|\u2190/g, '<--')          // ⟵ ←
    .replace(/\u2014>|\u2013>/g, '-->')         // —> –>
}

export default function Mermaid({ code, animated = false }) {
  const ref = useRef(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const dark = document.documentElement.classList.contains('dark')

    loadMermaid(dark)
      .then(async (mermaid) => {
        const id = `mermaid-${++idCounter}`
        try {
          // parse first so a syntax error does not leave a stray error node in the DOM
          const clean = normalizeDiagram(code)
          await mermaid.parse(clean)
          const { svg } = await mermaid.render(id, clean)
          if (!cancelled) { setSvg(svg); setError('') }
        } catch (e) {
          if (!cancelled) setError(e?.message || 'Invalid diagram syntax')
          document.getElementById(`d${id}`)?.remove()   // mermaid leaves a temp node on failure
        }
      })
      .catch(() => { if (!cancelled) setError('Could not load the diagram renderer') })

    return () => { cancelled = true }
  }, [code])

  // HLD diagrams keep all content visible. Small arrow markers travel along the
  // existing connector paths, so the direction is clear without changing layout.
  useEffect(() => {
    if (!animated || !svg || !ref.current) return
    const container = ref.current
    const motionReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (motionReduced) return

    const svgRoot = container.querySelector('svg')
    if (!svgRoot) return
    const paths = [...container.querySelectorAll('svg path')].filter(path => {
      const classes = path.getAttribute('class') || ''
      return path.hasAttribute('marker-end') || path.hasAttribute('marker-start') || /(?:edge|flowchart-link|messageLine|relation)/i.test(classes)
    })
    const movingArrows = paths.flatMap((path, index) => {
      try {
        const route = path.getAttribute('d')
        if (!route) return []
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        arrow.setAttribute('d', 'M -5 -3 L 5 0 L -5 3 z')
        arrow.setAttribute('fill', '#34d399')
        arrow.setAttribute('stroke', 'none')
        arrow.setAttribute('aria-hidden', 'true')
        arrow.setAttribute('class', 'hld-mermaid-flow-arrow')
        arrow.style.pointerEvents = 'none'
        arrow.style.filter = 'drop-shadow(0 0 3px rgba(52,211,153,.8))'

        const motion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion')
        motion.setAttribute('path', route)
        motion.setAttribute('dur', `${1.8 + (index % 3) * 0.28}s`)
        motion.setAttribute('begin', `${index * 0.16}s`)
        motion.setAttribute('repeatCount', 'indefinite')
        motion.setAttribute('rotate', 'auto')
        arrow.appendChild(motion)
        svgRoot.appendChild(arrow)
        return [arrow]
      } catch { return [] }
    })
    return () => movingArrows.forEach(arrow => arrow.remove())
  }, [animated, svg])

  // Failed to parse/render: fall back to the source so no content is ever lost.
  if (error) {
    return (
      <div className="my-4 -mx-4 sm:mx-0">
        {/* Full parser output would be a wall of text; keep it on hover. */}
        <div title={error} className="px-3 sm:px-4 py-1 text-[11px] font-mono uppercase tracking-wide text-amber-400 bg-slate-800 border border-b-0 border-slate-700/50 rounded-t-lg">
          diagram source (unrenderable)
        </div>
        <pre className="bg-slate-900 selection:bg-blue-500/40 selection:text-slate-100 rounded-b-lg p-3 sm:p-4 text-[12px] sm:text-sm overflow-x-auto max-w-full border border-slate-700/50">
          <code className="text-slate-100 leading-relaxed font-mono whitespace-pre">{code}</code>
        </pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-4 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 py-10 text-sm text-slate-400">
        Rendering diagram…
      </div>
    )
  }

  // ponytail: reuse ImageLightbox for zoom / pan / Esc instead of a second viewer.
  return (
    <>
    {open && <ImageLightbox html={svg} alt="Diagram" onClose={() => setOpen(false)} />}
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      title="Click to zoom"
      onClick={() => setOpen(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
      // The SVG scales to fit the container width (never cut off) and keeps its
      // aspect ratio, so the box hugs the diagram instead of leaving dead space.
      className={`mermaid-diagram my-3 cursor-zoom-in overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/40 sm:p-3 [&>svg]:mx-auto [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full ${animated ? 'hld-mermaid is-animated' : ''}`}
      // mermaid output is generated from the diagram source with securityLevel: 'strict'
      dangerouslySetInnerHTML={{ __html: svg }}
    />
    </>
  )
}
