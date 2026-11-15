import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const seenKey = (id) => `ir_problem_like_${id}`

// "Did you like this problem?" shown once per problem after an accepted submission. Sent as ordinary feedback
// (page = code-like:<problemId>), so the answers appear in the admin Feedback tab.
export default function ProblemLikeAsk({ problemId }) {
  const [vote, setVote] = useState(() => localStorage.getItem(seenKey(problemId)))   // 'yes' | 'no' | null
  const [askWhy, setAskWhy] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const send = async (v) => {
    setErr('')
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Coding problem ${problemId}: ${v === 'yes' ? 'Liked it' : 'Did not like it'} after solving.${note.trim() ? ` Note: ${note.trim()}` : ''}`, page: `code-like:${problemId}` }),
      })
      if (!res.ok) throw new Error()
      localStorage.setItem(seenKey(problemId), v)
      setVote(v); setAskWhy(false)
    } catch { setErr('Could not send. Try again.') }
  }
  const pick = (v) => (v === 'no' ? setAskWhy(true) : send('yes'))

  const card = 'mt-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-xl dark:border-slate-700 dark:bg-slate-900'
  if (vote) return <p className={`${card} text-center text-sm text-slate-600 dark:text-slate-300`}>Thanks for the feedback! {vote === 'yes' ? '👍' : '🙏'}</p>
  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Did you like this problem?</span>
        <span className="flex gap-2">
          <button type="button" onClick={() => pick('yes')} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">👍 Yes</button>
          <button type="button" onClick={() => pick('no')} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${askWhy ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'}`}>👎 No</button>
        </span>
      </div>
      {askWhy && (
        <div className="mt-3 flex gap-2">
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} autoFocus placeholder="What could be better? (optional)"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <button type="button" onClick={() => send('no')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900">Send</button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  )
}
