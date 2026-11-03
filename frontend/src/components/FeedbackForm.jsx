import { useState } from 'react'
import { isLoggedIn, getUser } from '../lib/auth.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// Anyone can send feedback; the optional email lets the team reply.
// Slides the page down to the feedback section, then puts the cursor in the message box.
// The scroll is animated by hand because the site's smooth-scroll CSS is not applied to scripted jumps everywhere.
export function focusFeedback() {
  const el = document.getElementById('feedback')
  if (!el) return false
  const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - (window.innerHeight - el.offsetHeight) / 2)
  const start = window.scrollY
  const distance = target - start
  const done = () => document.getElementById('feedback-message')?.focus({ preventScroll: true })
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(distance) < 4) {
    window.scrollTo(0, target)
    done()
    return true
  }
  const duration = Math.min(700, 300 + Math.abs(distance) / 4)
  const t0 = performance.now()
  const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)   // ease in and out
  const html = document.documentElement
  const previous = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'   // so each frame jumps exactly where we ask
  const timer = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / duration)
    window.scrollTo(0, start + distance * ease(p))
    if (p >= 1) { clearInterval(timer); html.style.scrollBehavior = previous; done() }
  }, 16)
  return true
}

export default function FeedbackForm() {
  const signedIn = isLoggedIn()
  const account = signedIn ? getUser() : null
  // A star tapped in the feedback email arrives as ?rating=N: start with it picked.
  const [rating, setRating] = useState(() => {
    const r = Number(new URLSearchParams(window.location.search).get('rating'))
    return r >= 1 && r <= 5 ? r : 0
  })
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [images, setImages] = useState([])   // uploaded screenshot URLs
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState(null) // null | 'sending' | 'sent' | error text

  async function addImages(files) {
    setStatus(null)
    const room = 3 - images.length
    const picked = Array.from(files).slice(0, room)
    if (!picked.length) return
    setUploading(true)
    try {
      const urls = []
      for (const file of picked) {
        const body = new FormData()
        body.append('file', file)
        const res = await fetch(`${API_BASE}/feedback/image`, { method: 'POST', body })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Could not upload the screenshot.')
        urls.push(data.url)
      }
      setImages(prev => [...prev, ...urls])
    } catch (err) {
      setStatus(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rating || null, message, email, imageUrls: images, page: window.location.pathname }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not send feedback.')
      setStatus('sent')
      setMessage(''); setEmail(''); setRating(0); setImages([])
    } catch (err) {
      setStatus(err.message)
    }
  }

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-950">
      <div className="flex items-center gap-1" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={n <= rating}
            className={`text-2xl leading-none ${n <= rating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>★</button>
        ))}
        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">optional</span>
      </div>
      <textarea id="feedback-message" value={message} onChange={e => setMessage(e.target.value)} required minLength={5} maxLength={2000} rows={4} placeholder="What works, what is missing, what is broken?" className={input} />
      {signedIn ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Sending as <span className="font-medium">{account?.email || 'your account'}</span></p>
      ) : (
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Your email (required, so we can reply)" className={input} />
      )}
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple className="hidden" disabled={uploading || images.length >= 3} onChange={e => { addImages(e.target.files); e.target.value = '' }} />
          {uploading ? 'Uploading…' : images.length >= 3 ? 'Screenshot limit reached' : '📎 Attach a screenshot (up to 3, 5 MB each)'}
        </label>
        {images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map(u => (
              <div key={u} className="relative">
                <img src={u} alt="Attached screenshot" className="h-16 w-16 rounded-lg border border-slate-300 object-cover dark:border-slate-700" />
                <button type="button" onClick={() => setImages(images.filter(x => x !== u))} aria-label="Remove screenshot" className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-slate-800 text-xs leading-5 text-white">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={status === 'sending' || uploading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {status === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
        {status === 'sent' && <span className="text-sm text-green-600 dark:text-green-400">Thank you! Your feedback was sent.</span>}
        {status && status !== 'sent' && status !== 'sending' && <span className="text-sm text-red-600 dark:text-red-400">{status}</span>}
      </div>
    </form>
  )
}
