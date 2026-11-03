import { useState } from 'react'
import { savePublicDetails } from '../lib/auth.js'

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const label = 'mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300'

// Edit what the public profile (/u/<username>) shows besides progress. Everything is optional; a blank field is simply not shown.
export default function PublicDetailsDialog({ details, username, onClose, onSaved }) {
  const d = details || {}
  const [f, setF] = useState({ headline: d.headline || '', college: d.college || '', bio: d.bio || '', github: d.github || '', linkedin: d.linkedin || '', website: d.website || '' })
  const [skills, setSkills] = useState(d.skills || [])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }))
  const addSkill = (raw = draft) => {
    const parts = raw.split(',').map(x => x.trim()).filter(Boolean)
    if (!parts.length) return
    setSkills(cur => {
      const next = [...cur]
      for (const p of parts) if (next.length < 8 && !next.some(x => x.toLowerCase() === p.toLowerCase())) next.push(p)
      return next
    })
    setDraft('')
  }
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const pending = draft.trim() ? [...skills, ...draft.split(',').map(x => x.trim()).filter(Boolean)] : skills
      const r = await savePublicDetails({ ...f, skills: pending })
      onSaved(r.details)
    } catch (x) { setError(x.message); setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Public profile details" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Public profile details</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">Shown on your public page{username ? <> (<span className="font-mono">/u/{username}</span>)</> : ''} to anyone with the link. All optional. Don't add anything private.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div>
          <label className={label} htmlFor="pd-headline">Headline</label>
          <input id="pd-headline" className={input} value={f.headline} onChange={set('headline')} maxLength={120} placeholder="e.g. Software Engineer at Acme" />
        </div>
        <div>
          <label className={label} htmlFor="pd-college">College</label>
          <input id="pd-college" className={input} value={f.college} onChange={set('college')} maxLength={120} placeholder="e.g. Government Engineering College" />
        </div>
        <div>
          <label className={label} htmlFor="pd-bio">Short description <span className="font-normal text-slate-500">({f.bio.length}/280)</span></label>
          <textarea id="pd-bio" className={`${input} min-h-[84px]`} value={f.bio} onChange={set('bio')} maxLength={280} placeholder="A line or two about you and what you are preparing for." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="pd-gh">GitHub username</label>
            <input id="pd-gh" className={input} value={f.github} onChange={set('github')} maxLength={80} placeholder="octocat or github.com/octocat" autoComplete="off" />
          </div>
          <div>
            <label className={label} htmlFor="pd-li">LinkedIn profile</label>
            <input id="pd-li" className={input} value={f.linkedin} onChange={set('linkedin')} maxLength={160} placeholder="linkedin.com/in/your-name" autoComplete="off" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="pd-web">Website</label>
          <input id="pd-web" className={input} value={f.website} onChange={set('website')} maxLength={200} placeholder="https://your-site.dev" autoComplete="off" />
        </div>
        <div>
          <label className={label} htmlFor="pd-skill">Skills <span className="font-normal text-slate-500">(up to 8, press Enter or comma)</span></label>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 bg-white p-2 focus-within:border-emerald-500 dark:border-slate-700 dark:bg-slate-900">
            {skills.map(s => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100">
                {s}<button type="button" onClick={() => setSkills(cur => cur.filter(x => x !== s))} aria-label={`Remove ${s}`} className="text-emerald-700 hover:text-rose-600">×</button>
              </span>
            ))}
            {skills.length < 8 && (
              <input id="pd-skill" value={draft} onChange={e => (e.target.value.includes(',') ? addSkill(e.target.value) : setDraft(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } else if (e.key === 'Backspace' && !draft && skills.length) setSkills(c => c.slice(0, -1)) }}
                onBlur={() => addSkill()} maxLength={24} placeholder={skills.length ? '' : 'Java, React, System design…'}
                className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-slate-900 outline-none dark:text-slate-100" />
            )}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}
