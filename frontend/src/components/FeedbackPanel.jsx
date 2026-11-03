import { useEffect, useState } from 'react'
import Loader from './Loader.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// Admin: every feedback message with its rating, email, page and screenshots.
export default function FeedbackPanel() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = () => fetch(`${API_BASE}/admin/feedback`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load feedback.')))
    .then(setItems).catch(e => setError(e.message))
  useEffect(() => { load() }, [])

  const remove = async id => {
    if (!window.confirm('Delete this feedback?')) return
    const res = await fetch(`${API_BASE}/admin/feedback/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(items.filter(i => i.id !== id))
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!items) return <Loader compact label="Loading feedback…" />
  if (!items.length) return <p className="text-sm text-slate-500">No feedback yet.</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{items.length} message{items.length > 1 ? 's' : ''}, newest first.</p>
      {items.map(f => (
        <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {f.rating ? <span className="mr-2 text-amber-500">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span> : null}
              {new Date(f.createdAt).toLocaleString()}{f.page ? ` · ${f.page}` : ''}{f.email ? ` · ` : ''}
              {f.email && <a href={`mailto:${f.email}`} className="text-blue-600 hover:underline dark:text-blue-400">{f.email}</a>}{f.fromAccount ? ' (account)' : ''}
            </span>
            <button type="button" onClick={() => remove(f.id)} className="text-red-600 hover:underline">Delete</button>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">{f.message}</p>
          {f.imageUrls?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {f.imageUrls.map(u => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="Screenshot" className="h-24 w-24 rounded-lg border border-slate-300 object-cover dark:border-slate-700" /></a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
