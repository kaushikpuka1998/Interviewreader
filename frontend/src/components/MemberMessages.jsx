import { useEffect, useState } from 'react'
import { isLoggedIn, getUser } from '../lib/auth.js'
import { fetchMyMessages } from '../lib/memberMessages.js'

const KEY = 'ir_msg_dismissed'
// "{name}" becomes the member's first name; a bare greeting title ("Hello") gets the name added: "Hello, Asha".
function personalise(text, first) {
  if (!first) return text.replace(/\s*\{name\}/g, '')
  const t = text.replace(/\{name\}/g, first)
  return /^\s*(hello|hi|hey|dear)\s*[!,.]?\s*$/i.test(t) ? `${t.trim().replace(/[!,.]$/, '')}, ${first}` : t
}
const dismissed = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') } catch { return [] } }

// Messages an admin sent to this member: a floating card on every page. The ✕ hides it for this login only;
// it returns at the next login and keeps returning until the admin closes the message.
export default function MemberMessages() {
  const [items, setItems] = useState([])
  const [hidden, setHidden] = useState(dismissed)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const load = () => { if (isLoggedIn()) fetchMyMessages().then(setItems).catch(() => {}) }
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])

  const open = items.filter(m => !hidden.includes(m.id))
  if (!open.length) return null
  const first = (getUser()?.name || '').trim().split(/\s+/)[0]
  const m = { ...open[0], title: personalise(open[0].title, first), body: personalise(open[0].body, first) }
  const hide = () => { const next = [...hidden, m.id]; sessionStorage.setItem(KEY, JSON.stringify(next)); setHidden(next) }
  const copy = () => { navigator.clipboard?.writeText(m.couponCode); setCopied(m.id) }

  return (
    <div role="dialog" aria-label={m.title} className="fixed bottom-4 left-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-emerald-300/70 bg-white p-5 shadow-2xl dark:border-emerald-500/30 dark:bg-slate-900">
      <button onClick={hide} aria-label="Close message" className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">✕</button>
      <p className="pr-6 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Message for you{open.length > 1 ? ` · 1 of ${open.length}` : ''}</p>
      <h3 className="mt-1 pr-6 text-base font-bold text-slate-900 dark:text-slate-100">{m.title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{m.body}</p>
      {m.couponCode && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
          <div>
            <p className="font-mono text-base font-bold tracking-wider text-emerald-800 dark:text-emerald-300">{m.couponCode}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{m.couponLabel ? `${m.couponLabel} · ` : ''}just for you, enter it at checkout</p>
          </div>
          <button onClick={copy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">{copied === m.id ? 'Copied' : 'Copy'}</button>
        </div>
      )}
    </div>
  )
}
