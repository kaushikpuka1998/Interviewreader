import { useState } from 'react'
import { isLoggedIn, getUser } from '../lib/auth.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

// Option questions, answered with a tap. The keys and values must match FeedbackController.QUESTIONS,
// which rejects anything else so the admin summary only counts real options.
export const QUESTIONS = [
  {
    key: 'theme', single: true, title: 'Which look do you prefer?',
    options: [['green', 'Green (new)', '#047857'], ['pink', 'Pink (previous)', '#be185d'], ['either', 'No preference']],
  },
  {
    key: 'issues', title: 'Are you facing any issue?', hint: 'Pick all that apply',
    options: [['none', 'No, all good'], ['slow', 'Pages load slowly'], ['broken', 'Something looks broken'], ['account', 'Sign-in or account'],
      ['payment', 'Payments / Premium'], ['mobile', 'Mobile layout'], ['content', 'Wrong or missing answers'], ['other', 'Something else']],
  },
  {
    key: 'platforms', title: 'Which other platforms do you use to prepare?', hint: 'Pick all that apply',
    options: [['leetcode', 'LeetCode'], ['gfg', 'GeeksforGeeks'], ['interviewbit', 'InterviewBit'], ['scaler', 'Scaler'],
      ['educative', 'Educative'], ['youtube', 'YouTube'], ['chatgpt', 'ChatGPT / AI tools'], ['none', 'None']],
  },
  {
    key: 'wishlist', title: 'Compared with those, what should we add here?', hint: 'Pick all that apply',
    options: [['problems', 'More coding problems'], ['video', 'Video explanations'], ['ai_interview', 'AI mock interviews'],
      ['company_sets', 'Company-wise question sets'], ['discussion', 'Comments and discussion'], ['certificates', 'Certificates'],
      ['mobile_app', 'A mobile app'], ['contests', 'Contests'], ['other', 'Something else']],
  },
]

const chip = on => `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on
  ? 'border-blue-600 bg-blue-600 text-white'
  : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400'}`

// The feedback page form: option questions, an optional star rating and message, and up to 3 screenshots.
// Anyone can send it; signed-in senders are identified by their account, others leave an email for a reply.
export default function FeedbackForm() {
  const signedIn = isLoggedIn()
  const account = signedIn ? getUser() : null
  // A star tapped in the feedback email arrives as ?rating=N: start with it picked.
  const [rating, setRating] = useState(() => {
    const r = Number(new URLSearchParams(window.location.search).get('rating'))
    return r >= 1 && r <= 5 ? r : 0
  })
  const [answers, setAnswers] = useState({})   // question key -> chosen option values
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [images, setImages] = useState([])   // uploaded screenshot URLs
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState(null) // null | 'sending' | 'sent' | error text

  const toggle = (q, value) => setAnswers(a => {
    const cur = a[q.key] || []
    if (q.single) return { ...a, [q.key]: cur[0] === value ? [] : [value] }
    // "No, all good" / "None" can't be combined with other picks.
    const exclusive = value === 'none'
    const next = cur.includes(value) ? cur.filter(v => v !== value) : exclusive ? [value] : [...cur.filter(v => v !== 'none'), value]
    return { ...a, [q.key]: next }
  })
  const answered = Object.values(answers).some(v => v.length)

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
    if (!answered && message.trim().length < 5) { setStatus('Pick an answer or write a few words.'); return }
    setStatus('sending')
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rating || null, message, email, imageUrls: images, page: document.referrer ? new URL(document.referrer).pathname : '/feedback', answers }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not send feedback.')
      setStatus('sent')
      setMessage(''); setEmail(''); setRating(0); setImages([]); setAnswers({})
    } catch (err) {
      setStatus(err.message)
    }
  }

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
  if (status === 'sent') {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-slate-950">
        <p className="text-4xl" aria-hidden="true">🙏</p>
        <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">Thank you, your feedback was sent.</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">We read every response and use it to decide what to build next.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => setStatus(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">Send more</button>
          <a href="/questions" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Back to questions</a>
        </div>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-950">
      {QUESTIONS.map((q, i) => (
        <fieldset key={q.key}>
          <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {i + 1}. {q.title} {q.hint && <span className="font-normal text-slate-500 dark:text-slate-400">({q.hint})</span>}
          </legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {q.options.map(([value, label, swatch]) => {
              const on = (answers[q.key] || []).includes(value)
              return (
                <button key={value} type="button" onClick={() => toggle(q, value)} aria-pressed={on} className={chip(on)}>
                  {swatch && <span className="h-3.5 w-3.5 rounded-full ring-2 ring-white/70" style={{ background: swatch }} aria-hidden="true" />}
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">{QUESTIONS.length + 1}. How would you rate Interview Reader? <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span></legend>
        <div className="mt-1.5 flex items-center gap-1" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={n <= rating}
              className={`text-3xl leading-none ${n <= rating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>★</button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="feedback-message" className="text-sm font-semibold text-slate-900 dark:text-slate-100">{QUESTIONS.length + 2}. Anything else? <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span></label>
        <textarea id="feedback-message" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={4}
          placeholder="Describe the issue, or tell us what would make this better than the platforms you use." className={`${input} mt-2`} />
      </div>

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
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={status === 'sending' || uploading} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {status === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
        {status && status !== 'sending' && <span className="text-sm text-red-600 dark:text-red-400">{status}</span>}
      </div>
    </form>
  )
}
