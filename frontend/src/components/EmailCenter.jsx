import { useState, useEffect, useCallback } from 'react'
import Loader from './Loader.jsx'
import { fetchEmailRecipients, fetchEmailLog, fetchDigestStatus, sendAnnouncement } from '../lib/emailAdmin.js'

const STATUS_STYLE = {
  'Got digest': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Not received': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Opted out': 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}
const FILTERS = [['all', 'All'], ['Got digest', 'Got digest'], ['Not received', 'Not received'], ['Opted out', 'Opted out']]
const card = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'
const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const when = (t) => (t ? new Date(t).toLocaleString() : '—')

const TODAY_LABEL = {
  NOT_STARTED: 'Not sent yet today',
  RUNNING: 'Sending now',
  DONE: 'Already sent today',
}

// What the next digest will send, before it goes out.
function DigestStatus({ status }) {
  if (!status) return null
  const next = new Date(status.nextSendAt)
  const stat = (label, value) => (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Next digest</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {next.toLocaleString()} · {TODAY_LABEL[status.todayStatus] || status.todayStatus}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stat('New or updated waiting', status.pendingQuestions)}
        {stat('Members who will get it', status.recipients)}
        {stat('Covers since', status.pendingSince ? new Date(status.pendingSince).toLocaleString() : '—')}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {status.pendingQuestions === 0
          ? 'Nothing new is waiting, so no digest will be sent at that time.'
          : 'New and edited questions are collected here and emailed as one digest at the send time.'}
      </p>
      {status.runs?.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-400">Recent digest runs</summary>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {status.runs.map((r, i) => (
              <li key={i} className="py-1.5 flex justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-300">{r.date} · {r.status}</span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">{r.questions ?? 0} question(s) · {r.sent ?? 0} sent</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

// Ready-made copy for members who haven't added a location. Only describes features that exist.
const LOCATION_TEMPLATE = {
  subject: 'One quick step to complete your InterviewReader profile',
  body: `Hi {{name}},

Thanks for joining InterviewReader!

Your profile is still missing your country or city. It takes less than 30 seconds:

{{profile_link}}

Once it's added, you can appear on the weekly leaderboard. Every read earns XP, and you move up through the leagues: Bronze, Silver, Gold and Platinum.

While you're there, check your progress charts. There are 3,770+ interview questions across Java, React, Node.js, SQL, Go, Kafka, Microservices, Ruby on Rails, Angular and system design, and they work offline too.

Happy preparing!
Kaushik
InterviewReader`,
}

// Launch announcement for the resume builder. Describes only what the feature does.
const RESUME_TEMPLATE = {
  subject: 'New on InterviewReader: build your resume',
  body: `Hi {{name}},

You can now build, edit and download your resume on InterviewReader.

- Choose a template and fill in your details. The live PDF updates as you type.
- Rename sections, or add your own, such as Certifications or Publications.
- Edit the LaTeX yourself and compile it to a PDF.
- Download the PDF or the .tex file.

Start here:
{{resume_link}}

Happy preparing!
Kaushik
InterviewReader`,
}

const PRACTICE_TEMPLATE = {
  subject: 'New on InterviewReader: practice coding',
  body: `Hi {{name}},

You can now practise coding on InterviewReader.

- Solve coding problems and run your solution against test cases.
- Write any program in the code editor, and upload a file from your computer.
- Choose a language, such as C++ or Python, and get the result straight away.

Start here:
{{practice_link}}

Happy coding!
Kaushik
InterviewReader`,
}

const INTERVIEW_TEMPLATE = {
  subject: 'Free mock interviews on InterviewReader for 2 weeks',
  body: `Hi {{name}},

For the next 2 weeks, mock interviews on InterviewReader are free. Practise with a real person, at a time you choose.

[[interview-promo]]

Book yours before the offer ends:
{{interview_link}}

Good luck!
Kaushik
InterviewReader`,
}

const ROADMAP_TEMPLATE = {
  subject: '{{name}}, your company interview roadmap is ready',
  body: `Hi {{name}},

Preparing for Google, Amazon, Meta or Microsoft? We built a week-by-week roadmap for each company, based on how their interviews actually run.

[[roadmap-promo]]

Pick your target company and start today:
{{roadmap_link}}

Good luck!
Kaushik
InterviewReader`,
}

const DAILY_TEMPLATE = {
  subject: 'New on InterviewReader: a daily challenge, {{name}}',
  body: `Hi {{name}},

Every day there are now two new things waiting for you on InterviewReader:

- Read: one interview question from a different topic each day, with a full answer.
- Solve: one coding problem, with a code editor that runs your solution against tests.

[[daily-promo]]

Do both in a few minutes, keep your streak alive, and earn points for the leaderboard. Check your streak and points history any time on the streak page.

Prefer a plain link?
{{daily_link}}

See you there!
Kaushik
InterviewReader`,
}

const FEEDBACK_TEMPLATE = {
  subject: 'Quick question, {{name}}: how is InterviewReader working for you?',
  body: `Hi {{name}},

You've been preparing with InterviewReader, and we'd love to know how it's going. What helps, what's missing, what annoys you: every answer is read by me, and it decides what we build next.

[[feedback-promo]]

Prefer to write a few lines instead? Reply to this email or use the form:
{{feedback_link}}

Thank you!
Kaushik
InterviewReader`,
}

const PLACEHOLDERS = ['{{name}}', '{{profile_link}}', '{{resume_link}}', '{{practice_link}}', '{{interview_link}}', '{{roadmap_link}}', '{{daily_link}}', '{{feedback_link}}', '[[interview-promo]]', '[[roadmap-promo]]', '[[feedback-promo]]', '[[daily-promo]]']

// Shows the email as one member would see it, with sample values filled in.
function Preview({ subject, body }) {
  const fill = (t) => t
    .replaceAll('{{name}}', 'Priya')
    .replaceAll('{{profile_link}}', `${window.location.origin}/profile`)
    .replaceAll('{{resume_link}}', `${window.location.origin}/resume`)
    .replaceAll('{{practice_link}}', `${window.location.origin}/practice`)
    .replaceAll('{{interview_link}}', `${window.location.origin}/interview`)
    .replaceAll('{{roadmap_link}}', `${window.location.origin}/roadmaps`)
    .replaceAll('{{daily_link}}', `${window.location.origin}/question-of-the-day`)
    .replaceAll('{{feedback_link}}', `${window.location.origin}/feedback`)
  // Designed cards: pictures plus a button. Show the real ones in the preview, in place of each marker.
  const imageCard = (images, cta) => (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      {images.map(n => <img key={n} src={`/promo/${n}.png`} alt="" className="block h-auto w-full" />)}
      <div className="py-4 text-center">
        <span className="inline-block rounded-lg bg-gradient-to-r from-orange-500 via-pink-500 to-violet-600 px-6 py-2.5 text-sm font-bold text-white">{cta}</span>
      </div>
    </div>
  )
  const CARDS = {
    '[[interview-promo]]': imageCard(['mock-interview', 'interview-types', 'how-it-works'], 'Book your free mock interview'),
    '[[daily-promo]]': imageCard(['daily-hero', 'daily-how'], "Take today's challenge"),
    '[[roadmap-promo]]': imageCard(['roadmap-hero', 'roadmap-companies', 'roadmap-inside'], 'See your company roadmap'),
    '[[feedback-promo]]': (
      <div className="my-3 rounded-xl border border-pink-200 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 p-5 text-center">
        <p className="text-lg font-bold text-slate-900">How are we doing?</p>
        <p className="mt-1 text-sm text-slate-600">Tap a star. It takes 10 seconds and shapes what we build next.</p>
        <div className="mt-3 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(r => (
            <span key={r} className="text-center">
              <span className="block w-12 rounded-lg border border-pink-200 bg-orange-50 py-2 text-2xl leading-none text-amber-500">★</span>
              <span className="text-xs text-slate-500">{r}</span>
            </span>
          ))}
        </div>
        <span className="mt-4 inline-block rounded-lg bg-gradient-to-r from-orange-500 via-pink-500 to-violet-600 px-6 py-2.5 text-sm font-bold text-white">Share your feedback</span>
      </div>
    ),
  }
  const parts = fill(body).split(/(\[\[(?:interview|roadmap|feedback)-promo\]\])/)
  const text = 'whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300 selection:bg-blue-500/30 selection:text-slate-900 dark:selection:text-slate-100'
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
      <p className="text-xs text-slate-400">Preview (sample name)</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{fill(subject) || '(no subject)'}</p>
      {parts.length === 1 && !parts[0] ? <pre className={`mt-2 ${text}`}>(no message)</pre> : parts.map((p, i) => (
        CARDS[p] ? <div key={i}>{CARDS[p]}</div>
          : p.trim() && <pre key={i} className={`mt-2 ${text}`}>{p.replace(/^\n+/, '').replace(/\n+$/, '')}</pre>
      ))}
      <p className="mt-3 text-xs text-slate-400">An unsubscribe link is added to the bottom of every email.</p>
    </div>
  )
}

function Compose({ onSent }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)   // { ok, text }
  const [showPreview, setShowPreview] = useState(false)

  const useTemplate = () => {
    setSubject(LOCATION_TEMPLATE.subject)
    setBody(LOCATION_TEMPLATE.body)
    setAudience('no-location')
    setShowPreview(true)
  }
  const usePracticeTemplate = () => {
    setSubject(PRACTICE_TEMPLATE.subject)
    setBody(PRACTICE_TEMPLATE.body)
    setAudience('all')
    setShowPreview(true)
  }
  const useResumeTemplate = () => {
    setSubject(RESUME_TEMPLATE.subject)
    setBody(RESUME_TEMPLATE.body)
    setAudience('all')
    setShowPreview(true)
  }
  const useInterviewTemplate = () => {
    setSubject(INTERVIEW_TEMPLATE.subject)
    setBody(INTERVIEW_TEMPLATE.body)
    setAudience('all')
    setShowPreview(true)
  }
  const useRoadmapTemplate = () => {
    setSubject(ROADMAP_TEMPLATE.subject)
    setBody(ROADMAP_TEMPLATE.body)
    setAudience('all')
    setShowPreview(true)
  }
  const useDailyTemplate = () => {
    setSubject(DAILY_TEMPLATE.subject)
    setBody(DAILY_TEMPLATE.body)
    setAudience('all')
    setShowPreview(true)
  }
  const useFeedbackTemplate = () => {
    setSubject(FEEDBACK_TEMPLATE.subject)
    setBody(FEEDBACK_TEMPLATE.body)
    setAudience('all')
    setShowPreview(true)
  }
  const insert = (token) => setBody(b => b + token)

  const send = async (e) => {
    e.preventDefault()
    const label = audience === 'all' ? 'every subscribed member' : 'members without a country and city'
    if (!window.confirm(`Send "${subject.trim()}" to ${label}?`)) return
    setBusy(true); setMsg(null)
    try {
      const r = await sendAnnouncement({ subject, body, audience })
      setMsg({ ok: true, text: `Queued for ${r.queued} member(s). Delivery shows up in the table below as it happens.` })
      setSubject(''); setBody('')
      onSent()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={send} className={`${card} space-y-3`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Send an email</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select className={input} value={audience} onChange={e => setAudience(e.target.value)}>
          <option value="all">All subscribed members</option>
          <option value="no-location">Members without a location</option>
        </select>
        <input className={`${input} sm:col-span-2`} placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} required />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={useTemplate} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white">Use "complete your profile" template</button>
        <button type="button" onClick={useDailyTemplate} className="rounded-lg bg-orange-600 px-3 py-1.5 font-semibold text-white">Use "daily challenge" launch template</button>
        <button type="button" onClick={useResumeTemplate} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white">Use "resume builder" launch template</button>
        <button type="button" onClick={usePracticeTemplate} className="rounded-lg bg-orange-500 px-3 py-1.5 font-semibold text-white">Use "code practice" launch template</button>
        <button type="button" onClick={useInterviewTemplate} className="rounded-lg bg-pink-600 px-3 py-1.5 font-semibold text-white">Use "free mock interview" template</button>
        <button type="button" onClick={useRoadmapTemplate} className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white">Use "company roadmaps" template</button>
        <button type="button" onClick={useFeedbackTemplate} className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white">Use "feedback request" template</button>
        <span className="text-slate-400">Insert:</span>
        {PLACEHOLDERS.map(p => (
          <button key={p} type="button" onClick={() => insert(p)} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">{p}</button>
        ))}
        <button type="button" onClick={() => setShowPreview(v => !v)} className="ml-auto font-medium text-blue-600 dark:text-blue-400">{showPreview ? 'Hide preview' : 'Show preview'}</button>
      </div>
      <textarea className={`${input} min-h-[160px]`} placeholder="Message (plain text). {{name}} and {{profile_link}} are filled in for each member." value={body} onChange={e => setBody(e.target.value)} maxLength={10000} required />
      {showPreview && <Preview subject={subject} body={body} />}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Every email includes an unsubscribe link. Opted-out members are skipped.</p>
        <button type="submit" disabled={busy || !subject.trim() || !body.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</p>}
    </form>
  )
}

function Recipients({ rows }) {
  const [filter, setFilter] = useState('all')
  const shown = filter === 'all' ? rows : rows.filter(r => r.status === filter)
  const counts = FILTERS.reduce((acc, [key]) => ({ ...acc, [key]: key === 'all' ? rows.length : rows.filter(r => r.status === key).length }), {})
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Who gets the digest</h3>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${filter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
              {label} ({counts[key]})
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 pr-3 font-semibold">Member</th>
              <th className="py-2 pr-3 font-semibold">Location</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Last digest</th>
              <th className="py-2 pr-3 font-semibold">Last nudge</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3">
                  <p className="text-slate-800 dark:text-slate-100">{r.name || r.email}</p>
                  <p className="text-xs text-slate-400 truncate max-w-[16rem]">{r.email}</p>
                </td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{r.location || '—'}</td>
                <td className="py-2 pr-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] || ''}`}>{r.status}</span>
                  {r.lastStatus === 'FAILED' && <span className="ml-1.5 text-[11px] text-red-500">last send failed</span>}
                </td>
                <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{when(r.lastDigest)}</td>
                <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{when(r.lastNudge)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No members in this group.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SendLog({ rows }) {
  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Recent sends (latest 200)</h3>
      {rows.length === 0 ? <p className="text-sm text-slate-400">Nothing sent yet.</p> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
          {rows.map((l, i) => (
            <li key={i} className="py-2 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate text-slate-800 dark:text-slate-100">{l.subject || l.type}</p>
                <p className="text-xs text-slate-400 truncate">{l.email} · {when(l.when)}</p>
                {l.error && <p className="text-xs text-red-500 truncate">{l.error}</p>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{l.type}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${l.status === 'SENT' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{l.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function EmailCenter() {
  const [recipients, setRecipients] = useState(null)
  const [log, setLog] = useState([])
  const [digest, setDigest] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    Promise.all([fetchEmailRecipients(), fetchEmailLog(), fetchDigestStatus()])
      .then(([r, l, d]) => { setRecipients(r); setLog(l); setDigest(d) })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (!recipients) return <Loader compact label="Loading email activity…" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">Who gets mail, who doesn't, and what was sent.</p>
        <button onClick={load} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Refresh</button>
      </div>
      <DigestStatus status={digest} />
      <Compose onSent={load} />
      <Recipients rows={recipients} />
      <SendLog rows={log} />
    </div>
  )
}
