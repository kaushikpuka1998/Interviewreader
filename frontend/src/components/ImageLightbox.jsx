import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-screen image viewer.
 *
 * Scroll position is preserved by never touching the page's scroll containers:
 * the overlay is fixed, and wheel/touch events over it are swallowed rather than
 * the background being locked with `overflow: hidden` (which resets scroll on
 * close). Closing therefore leaves the reader exactly where it was.
 *
 * `html` renders inline markup (a mermaid SVG) instead of an <img>; mermaid's
 * foreignObject labels are not valid standalone XML, so it cannot be a data: URL.
 */
export default function ImageLightbox({ src, alt, html, onClose }) {
  const [zoomed, setZoomed] = useState(false)
  const [failed, setFailed] = useState(false)   // a broken src would otherwise be a blank black screen
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const overlayRef = useRef(null)

  // Escape closes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setZoomed(z => !z) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Swallow scroll over the overlay so the page behind never moves.
  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const block = (e) => e.preventDefault()
    el.addEventListener('wheel', block, { passive: false })
    el.addEventListener('touchmove', block, { passive: false })
    return () => {
      el.removeEventListener('wheel', block)
      el.removeEventListener('touchmove', block)
    }
  }, [])

  // Reset the pan whenever we leave the zoomed state.
  useEffect(() => { if (!zoomed) setPan({ x: 0, y: 0 }) }, [zoomed])

  const onPointerDown = useCallback((e) => {
    if (!zoomed) return
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [zoomed, pan])

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return
    setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y })
  }, [])

  const endDrag = useCallback(() => { dragRef.current = null }, [])

  // Portalled to <body>: any ancestor with a transform/filter/contain makes
  // `position: fixed` resolve against *that* box, which clipped the overlay to
  // the article column instead of the viewport.
  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain animate-[fadeIn_120ms_ease-out]"
    >
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setZoomed(z => !z)}
          data-tip={zoomed ? 'Fit to screen' : 'Zoom to full size'}
          className="tip relative p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          {zoomed ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" /></svg>
          )}
        </button>
        {src && <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          data-tip="Open the original in a new tab"
          className="tip relative p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
        </a>}
        <button
          onClick={onClose}
          data-tip="Close (Esc)"
          className="tip relative p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {html ? (
        <div
          onClick={(e) => { e.stopPropagation(); setZoomed(z => !z) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomed ? 2.5 : 1})` }}
          className={`w-[92vw] max-h-[88vh] select-none rounded bg-white dark:bg-slate-900 p-3 [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-h-[82vh] [&>svg]:w-full [&>svg]:!max-w-none ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : failed ? (
        <div onClick={(e) => e.stopPropagation()} className="max-w-[90vw] rounded-lg bg-slate-800 px-5 py-4 text-center text-sm text-slate-200">
          <p className="font-medium">This image could not be loaded.</p>
          <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{src}</p>
        </div>
      ) : (
      <img
        src={src}
        alt={alt || ''}
        draggable={false}
        onError={() => setFailed(true)}
        onClick={(e) => { e.stopPropagation(); setZoomed(z => !z) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // Scale the *fitted* image rather than switching to max-w-none: natural size
        // on a large screenshot filled the viewport (and hid the toolbar) as a blank wall.
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomed ? 2.5 : 1})` }}
        className={`max-w-full max-h-[88vh] object-contain select-none rounded ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
      />
      )}

      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/50 pointer-events-none">
        {zoomed ? 'Drag to pan · click to fit' : 'Click to zoom · Esc to close'}
      </p>
    </div>,
    document.body
  )
}
