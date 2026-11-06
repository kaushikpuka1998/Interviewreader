import { useEffect, useState } from 'react'
import Loader from './Loader.jsx'
import { fetchFeatures, fetchSiteNotice, setFeature, setSiteNotice } from '../lib/features.js'

// Each entry is a flag the server knows about (see FeatureFlagController).
const FLAGS = [
  { key: 'resume_builder', badgeKey: 'new_badge_resume_builder', badgeHelp: 'Show a "New" badge on the Resume link in the top bar.', label: 'Resume builder', help: 'Turns the whole resume builder on or off: sidebar entry, page, and new resumes.' },
  { key: 'resume_promo', label: 'Resume builder login promo', help: 'Shows the resume builder card to members right after they log in.' },
  { key: 'code_practice', badgeKey: 'new_badge_code_practice', badgeHelp: 'Show a "New" badge on the Problems (Coding) and Practice links in the top bar. Turn it on when you add a new batch.', label: 'Code practice', help: 'Turns code practice on or off. When off, the page is hidden and new runs are refused.' },
  { key: 'mock_interview', badgeKey: 'new_badge_interview', badgeHelp: 'Show a "New" badge on the Interview link in the top bar. Turn it on for the free mock interview offer.', label: 'Mock interviews', help: 'Turns mock interviews on or off: the Interview link and page, and new requests.' },
  { key: 'interviewer_open', label: 'Open interviewing to all members', help: 'Off: only admins can take mock interviews, and the interviewer option is hidden for everyone else. On: any member can choose to be the interviewer. Turn it on when enough members have offered to interview.' },
  { key: 'premium_free', label: 'Everything free (Premium unlocked for all)', help: 'On: every signed-in member gets all Premium features free (locked answers, company filters, roadmaps). Off: Premium is paid again. Takes effect within a few seconds of a refresh.' },
  { key: 'site_notice', label: 'Site maintenance / service notice', help: 'Shows a banner across the website that lets visitors know maintenance is underway or a known issue may temporarily affect some features.' },
  { key: 'daily_promo', label: 'Daily challenge login promo', help: 'Shows the daily challenge card once to each member (the question to read and the problem to solve).' },
  { key: 'code_practice_promo', label: 'Code practice login promo', help: 'Shows the code practice card to members after they log in.' },
]

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState(null)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { fetchFeatures({ fresh: true }).then(setFlags) }, [])

  const toggle = async (key) => {
    setSaving(key); setError('')
    try {
      setFlags(await setFeature(key, !flags[key]))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(null)
    }
  }

  if (!flags) return <Loader compact label="Loading feature flags…" />

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">Changes reach members within about a minute (browsers keep the flags that long). You see the live value here.</p>
      {FLAGS.map(f => {
        const on = flags[f.key] !== false
        const badgeOn = f.badgeKey ? flags[f.badgeKey] === true : false
        return (
          <div key={f.key} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-3 sm:p-4">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{f.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{f.help}</p>
              <p className="mt-1 break-all text-[11px] font-mono text-slate-400">{f.key}</p>
              {f.key === 'site_notice' && <SiteNoticeEditor />}
              {f.badgeKey && (
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={badgeOn}
                    disabled={saving === f.badgeKey}
                    onChange={() => toggle(f.badgeKey)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-pink-600"
                  />
                  <span>
                    {f.badgeHelp}
                    <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 align-middle text-[10px] font-bold text-amber-950">New</span>
                  </span>
                </label>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${f.label}: ${on ? 'on' : 'off'}`}
              disabled={saving === f.key}
              onClick={() => toggle(f.key)}
              className={`relative mt-0.5 inline-flex h-4 w-8 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 sm:h-6 sm:w-11 ${on ? 'bg-blue-600 max-sm:border-[1.5px] max-sm:border-blue-600 max-sm:bg-transparent' : 'bg-slate-300 dark:bg-slate-700 max-sm:border-[1.5px] max-sm:border-slate-400 max-sm:bg-transparent dark:max-sm:border-slate-500'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full shadow transition-transform sm:h-5 sm:w-5 sm:bg-white ${on ? 'translate-x-[17px] bg-white max-sm:bg-blue-600 sm:translate-x-5' : 'translate-x-0 bg-white max-sm:bg-slate-400 sm:translate-x-0.5'}`} />
            </button>
          </div>
        )
      })}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function SiteNoticeEditor() {
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchSiteNotice({ admin: true }).then(n => setMessage(n.message || '')).catch(() => {}) }, [])

  const save = async () => {
    setSaving(true); setSaved(''); setError('')
    try {
      await setSiteNotice(message)
      setSaved('Saved')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 max-w-xl">
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200" htmlFor="site-notice-message">Notice message</label>
      <div className="mt-1 flex gap-2">
        <input id="site-notice-message" value={message} onChange={e => setMessage(e.target.value)} maxLength={400}
          placeholder="e.g. Search is temporarily unavailable while we apply a fix."
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white">{saving ? 'Saving…' : 'Save message'}</button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{message.length}/400 characters. Save this first, then turn the flag on.</p>
      {saved && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{saved}</p>}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
