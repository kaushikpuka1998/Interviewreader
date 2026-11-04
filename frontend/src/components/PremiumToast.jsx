import { useEffect } from 'react'

// A floating "this needs Premium" note with a link to the pricing page. Closes itself after a few seconds.
export default function PremiumToast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 9000); return () => clearTimeout(t) }, [message, onClose])
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-[70] w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border border-amber-300 bg-white p-4 shadow-xl dark:border-amber-500/40 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">🔒</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Premium feature</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{message}</p>
          <a href="/pricing" className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600">View pricing</a>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
      </div>
    </div>
  )
}
