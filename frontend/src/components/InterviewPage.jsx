import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import TopBar from './TopBar.jsx'
import AuthModal from './AuthModal.jsx'
import Loader from './Loader.jsx'
import { FeedbackView } from './InterviewFeedback.jsx'
import Markdown from './Markdown.jsx'
import ResumePreview from './ResumePreview.jsx'
import { isLoggedIn, getUser } from '../lib/auth.js'
import { useFeatures } from '../lib/features.js'
import { fetchResumes, fetchTemplates } from '../lib/resume.js'
import { TYPES, typeLabel, fetchUpcoming, takeInterview, fetchMyInterviews, requestInterview, slotToIso, formatSlot, fetchInterviewResume, searchQuestionOptions, setInterviewQuestions, randomInterviewQuestions, saveCallLink, saveWhiteboardLink, reportNoShow, completeInterview, cancelInterview } from '../lib/interviews.js'

const btn = 'rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60'
const primary = `${btn} bg-blue-600 text-white hover:bg-blue-700`
const secondary = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`

// Mock interviews: ask for one as a candidate, or take one as an interviewer. Matched pairs get a call link,
// a shared whiteboard, and (interviewer only) the candidate's resume plus three random questions.
export default function InterviewPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [type, setType] = useState('CODING')
  const [resumes, setResumes] = useState([])
  const [resumeId, setResumeId] = useState('')
  const [slot, setSlot] = useState('')
  const [wantsToInterview, setWantsToInterview] = useState(false)
  const minSlot = new Date(Date.now() + 15 * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const signedIn = isLoggedIn()
  const features = useFeatures()
  const canInterview = !!getUser()?.admin || features.interviewer_open === true
  const [upcoming, setUpcoming] = useState([])

  const load = useCallback(() => fetchMyInterviews().then(setList).catch(e => setError(e.message)), [])
  useEffect(() => {
    if (!signedIn) return
    load()
    fetchResumes().then(r => { setResumes(r); if (r[0]) setResumeId(String(r[0].id)) }).catch(() => {})
    const timer = setInterval(load, 6000)   // pick up a match without a refresh
    return () => clearInterval(timer)
  }, [signedIn, load])

  useEffect(() => {
    if (!signedIn || !canInterview) return
    const get = () => fetchUpcoming().then(setUpcoming).catch(() => setUpcoming([]))
    get()
    const t = setInterval(get, 15000)
    return () => clearInterval(t)
  }, [signedIn, canInterview])


  const act = async fn => {
    setBusy(true); setError('')
    try { await fn(); await load() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  // An interviewer can hold several interviews at different times, so every open one is shown, soonest first.
  const openOnes = (list || []).filter(i => i.status === 'WAITING' || i.status === 'MATCHED')
    .sort((a, b) => new Date(a.slotAt || a.createdAt) - new Date(b.slotAt || b.createdAt))
  const asCandidate = false   // a candidate may request several interviews at different times (the server checks the clashes and the limit)
  const past = (list || []).filter(i => !openOnes.includes(i))

  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-slate-100 p-3 sm:p-4 dark:bg-slate-900">
        <div className="mx-auto max-w-[1500px] space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mock interview</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Practise with a real person. Request an interview for a date and time; an interviewer accepts it and you are notified.</p>
          </div>

          {!signedIn ? (
            <div className="rounded-2xl bg-white p-6 text-center dark:bg-slate-950">
              <p className="text-slate-700 dark:text-slate-300">Log in to request or give a mock interview.</p>
              <button className={`${primary} mt-3`} onClick={() => setAuthOpen(true)}>Log in / Sign up</button>
            </div>
          ) : list === null ? <Loader label="Loading your interviews…" /> : null}

          {signedIn && list !== null && openOnes.length > 0 && (
            <div className="space-y-6">
              {openOnes.map(item => (
                <ActiveInterview key={item.id} item={item} busy={busy} act={act} load={load} />
              ))}
            </div>
          )}

          {signedIn && list !== null && !asCandidate && (
            <div className="space-y-4 rounded-2xl bg-white p-5 dark:bg-slate-950">
              <div>
                {openOnes.some(i => i.role === 'candidate') && <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">You can request another interview at a different time.</p>}
                <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">1. Interview type</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TYPES.map(([k, label, text]) => (
                    <button key={k} onClick={() => setType(k)} aria-pressed={type === k} className={`rounded-xl border p-3 text-left ${type === k ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{text}</p>
                    </button>
                  ))}
                </div>
              </div>
              {(
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">2. Resume to share with your interviewer {type === 'RESUME' ? '' : '(optional)'}</p>
                  {resumes.length ? (
                    <select value={resumeId} onChange={e => setResumeId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {type !== 'RESUME' && <option value="">No resume</option>}
                      {resumes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
                  ) : <p className="text-sm text-slate-500">You have no resume yet. <a href="/resume" className="text-blue-600 hover:underline">Build one</a>{type === 'RESUME' ? ' to use this type.' : ' or continue without one.'}</p>}
                </div>
              )}
              {(
                <>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">3. When would you like it?</p>
                    <input
                      type="datetime-local"
                      value={slot}
                      min={minSlot}
                      onChange={e => setSlot(e.target.value)}
                      required
                      className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your local time. Pick a slot at least 15 minutes ahead; an interviewer takes it and you both get an email.</p>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input type="checkbox" className="mt-0.5" checked={wantsToInterview} onChange={e => setWantsToInterview(e.target.checked)} />
                    <span>I would also like to interview other members. (We may invite you to become an interviewer.)</span>
                  </label>
                </>
              )}
              <button className={primary} disabled={busy || !slot || (type === 'RESUME' && !resumeId)}
                onClick={() => act(() => requestInterview(type, resumeId, slotToIso(slot), wantsToInterview))}>
                {busy ? 'Sending request…' : 'Request an interview'}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">Once an interviewer accepts, you are notified here and by email, and the interview shows as upcoming with its date and time.</p>
            </div>
          )}

          {signedIn && canInterview && upcoming.length > 0 && (
            <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Interview requests waiting for an interviewer ({upcoming.length})</h2>
              <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                {upcoming.map(u => (
                  <li key={u.id} className="flex items-center justify-between py-1.5 text-slate-700 dark:text-slate-300">
                    <span className="min-w-0">{typeLabel(u.type)} · <span className="font-semibold text-slate-900 dark:text-slate-100">{u.candidate}</span>{u.candidateEmail ? <span className="text-xs text-slate-500"> ({u.candidateEmail})</span> : null}{u.hasResume ? ' · with resume' : ''}<span className="ml-2 text-xs text-slate-500">{formatSlot(u.slotAt)}</span></span>
                    <button type="button" disabled={busy} onClick={() => act(() => takeInterview(u.id))} className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">Accept</button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Accept one to take it: the candidate is notified and sees it as an upcoming interview at the chosen date and time.</p>
            </div>
          )}
          {signedIn && !canInterview && !asCandidate && <p className="text-xs text-slate-500 dark:text-slate-400">Interviews are taken by our team for now. Tick "I would also like to interview other members" when you request one, and we will invite you when interviewing opens up.</p>}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {past.length > 0 && (
            <div className="rounded-2xl bg-white p-5 dark:bg-slate-950">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Earlier interviews</h2>
              <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                {past.map(i => (
                  <li key={i.id} className="py-2 text-slate-700 dark:text-slate-300">
                   <div className="flex items-center justify-between">
                    <span>{typeLabel(i.type)} · {i.role}{i.partner ? ` · with ${i.partner}` : ''}{i.slotAt ? ` · ${formatSlot(i.slotAt)}` : ''}</span>
                    <span className="text-xs text-slate-500">{i.status === 'NO_SHOW' ? `no-show: ${(i.noShowBy || '').toLowerCase()}` : i.status.toLowerCase()} · {new Date(i.createdAt).toLocaleDateString()}</span>
                   </div>
                   {i.role === 'interviewer' && i.status === 'DONE' && <a href={`/interview/live/${i.id}`} className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">{i.feedback ? 'View or edit your feedback' : 'Give feedback to the candidate'}</a>}
                   {i.role === 'candidate' && i.feedback && <div className="mt-2"><FeedbackView feedback={i.feedback} /></div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
    </>
  )
}

function ActiveInterview({ item, busy, act, load }) {
  const waiting = item.status === 'WAITING'
  const interviewer = item.role === 'interviewer'

  // Consider someone "online" if they accessed the live room in the last 10 seconds
  const isOnline = (lastSeen) => lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 10000
  const candidateOnline = isOnline(item.candidateLastSeen)
  const interviewerOnline = isOnline(item.interviewerLastSeen)

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 space-y-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{typeLabel(item.type)} interview · you are the {item.role}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {waiting ? 'Interview Request Pending' : interviewer ? `Interview with ${item.partner || 'a member'}${item.partnerEmail ? ` (${item.partnerEmail})` : ''}` : `Upcoming interview with ${item.partner || 'your interviewer'}`}
              </h2>
              {waiting && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Pending Acceptance
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Planned for <span className="font-medium">{formatSlot(item.slotAt)}</span></p>
            {!waiting && !item.startedAt && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {interviewer && candidateOnline && <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">✓ Candidate in live room</span>}
                {!interviewer && interviewerOnline && <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">✓ Interviewer in live room</span>}
              </div>
            )}
          </div>
          <button className={secondary} disabled={busy} onClick={() => act(() => cancelInterview(item.id))}>{waiting ? 'Cancel request' : 'Cancel interview'}</button>
        </div>
        {waiting ? (
          <div className="mt-4 space-y-4">
            {/* 3-step visual tracker */}
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">✓</span>
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">1. Request Submitted</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatSlot(item.slotAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-xs dark:border-amber-700/60 dark:bg-amber-950/40">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[11px] font-bold text-white animate-pulse">2</span>
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">2. Waiting for Acceptance</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">Interviewer queue notified</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-400 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-500">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">3</span>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">3. Interview Starts</p>
                  <p className="text-[11px] text-slate-400">Join call & live room</p>
                </div>
              </div>
            </div>

            {/* Explanatory notification panel */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Interviewers have been notified of your request
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Your request for <span className="font-semibold text-slate-800 dark:text-slate-200">{formatSlot(item.slotAt)}</span> is visible in the interviewers' dashboard. It may take some time for an available interviewer to accept.
                  </p>
                  <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span> You will automatically receive an email confirmation as soon as an interviewer accepts.
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span> This card will update automatically with your Google Meet and live whiteboard room links.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">Both of you have been notified. Join the call, open the shared whiteboard, and start.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.callUrl ? <a href={item.callUrl} target="_blank" rel="noopener noreferrer" className={primary} onClick={() => { window.location.href = `/interview/live/${item.id}` }}>Join video call ↗</a>
                : !interviewer && <span className="self-center rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">Your interviewer will add the Google Meet link here shortly. This page updates by itself.</span>}
              <a href={`/interview/live/${item.id}`} className={primary}>Open live room</a>
              <a href={item.whiteboardUrl} target="_blank" rel="noopener noreferrer" className={secondary}>Open shared whiteboard ↗</a>
              <button className={secondary} disabled={busy || !canFinish(item)} onClick={() => act(() => completeInterview(item.id))}>Mark as finished Interview</button>
            </div>
            {!canFinish(item) && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">"Mark as finished Interview" turns on once all questions are completed in the live room, or 1 hour after the start time (at {new Date(finishAt(item)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).</p>}
            <NoShow item={item} busy={busy} act={act} />
          </div>
        )}
      </div>

      {!waiting && interviewer && (
        <div className="grid gap-4 md:grid-cols-2">
          <MeetLink item={item} busy={busy} act={act} />
          <WhiteboardLink item={item} busy={busy} act={act} />
        </div>
      )}

      {!waiting && interviewer && (item.prepOpen
        ? <div className="border-t border-slate-200 pt-5 dark:border-slate-800"><InterviewerTools item={item} onChanged={load} /></div>
        : <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            The questions and the candidate's resume open <span className="font-medium">10 minutes before the start time</span>, at {new Date(item.prepOpensAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on {new Date(item.prepOpensAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}. This page opens them by itself.
          </div>)}

      {!interviewer && item.feedback && (
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <FeedbackView feedback={item.feedback} />
        </div>
      )}
      {!waiting && !interviewer && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your interviewer will ask the questions. Use the whiteboard to draw and explain your answers.
        </p>
      )}
    </div>
  )
}

// "Mark as finished" opens once all questions are done in the live room, or one hour after the start time (for both).
const finishAt = item => new Date(item.slotAt || item.matchedAt).getTime() + 60 * 60000
const canFinish = item => !!item.allDone || Date.now() >= finishAt(item)

// From the start time on, either person can report that the other did not join.
function NoShow({ item, busy, act }) {
  if (item.role !== 'interviewer') return null   // only the interviewer can report that the candidate did not join
  if (item.startedAt) return null   // once the interview has started in the live room, both have joined
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  const opensAt = item.slotAt ? new Date(item.slotAt).getTime() : 0   // from the start time itself
  const open = now >= opensAt
  const other = 'candidate'
  return (
    <div className="mt-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
      <button type="button" disabled={busy || !open} className="font-medium text-red-600 hover:underline disabled:text-slate-400 disabled:no-underline dark:text-red-400"
        onClick={() => { if (window.confirm(`Report that the ${other} did not join? This closes the interview.`)) act(() => reportNoShow(item.id)) }}>
        The {other} did not join
      </button>
      {!open && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Available from {new Date(opensAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, the start time.</span>}
    </div>
  )
}

function MeetLink({ item, busy, act }) {
  const [url, setUrl] = useState(item.callUrl || '')
  return (
    <form onSubmit={e => { e.preventDefault(); act(() => saveCallLink(item.id, url)) }} className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Google Meet link</h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Create a meeting at <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">meet.google.com/new</a>, paste its link here, and the candidate gets the Join button.</p>
      </div>
      <div>
        <div className="flex flex-wrap gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" required className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          <button type="submit" disabled={busy} className={primary}>{item.callUrl ? 'Update link' : 'Share link'}</button>
        </div>
        {item.callUrl && <p className="mt-2 text-xs text-green-600 dark:text-green-400">✓ The candidate can see the call link.</p>}
      </div>
    </form>
  )
}

function WhiteboardLink({ item, busy, act }) {
  const [url, setUrl] = useState(item.whiteboardUrl || '')
  return (
    <form onSubmit={e => { e.preventDefault(); act(() => saveWhiteboardLink(item.id, url)) }} className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Shared whiteboard link</h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Update the whiteboard link if you prefer a different tool. Default: <a href="https://excalidraw.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Excalidraw</a>.
          You can also use <a href="https://miro.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Miro</a>, <a href="https://www.figma.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Figma</a>, or any other whiteboard.
        </p>
      </div>
      <div>
        <div className="flex flex-wrap gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://excalidraw.com/#room=..." required className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          <button type="submit" disabled={busy} className={primary}>Update link</button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Both you and the candidate can access this whiteboard.</p>
      </div>
    </form>
  )
}

function InterviewerTools({ item, onChanged }) {
  const [resume, setResume] = useState(null)
  const [layout, setLayout] = useState(null)
  const [note, setNote] = useState('')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)
  const refs = item.questions.map(q => q.ref).filter(Boolean)

  const run = async fn => { setSaving(true); try { await fn(); await onChanged() } finally { setSaving(false) } }
  const remove = ref => run(() => setInterviewQuestions(item.id, refs.filter(r => r !== ref)))

  // Search as the interviewer types (a short pause first, so each letter does not hit the server).
  useEffect(() => {
    const t = setTimeout(() => searchQuestionOptions(item.id, term).then(setResults).catch(() => setResults([])), term ? 300 : 0)
    return () => clearTimeout(t)
  }, [term, item.id])

  useEffect(() => {
    if (!item.hasResume) { setNote('The candidate did not share a resume.'); return }
    Promise.all([fetchInterviewResume(item.id), fetchTemplates()])
      .then(([r, t]) => { setResume(r); setLayout(t.find(x => x.id === r.templateId)?.layout) })
      .catch(e => setNote(e.message))
  }, [item.id, item.hasResume])

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Questions to ask (only you see these)</h3>
          <button type="button" disabled={saving} onClick={() => run(() => randomInterviewQuestions(item.id))} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">🎲 Random 3</button>
        </div>
        {item.questions.length ? item.questions.map((q, i) => (
          <details key={q.ref || i} className="mb-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/80">
            <summary className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100">
              {i + 1}. {q.title}
              {q.ref && <button type="button" onClick={e => { e.preventDefault(); remove(q.ref) }} aria-label="Remove question" className="ml-2 text-xs text-red-600 hover:underline">remove</button>}
            </summary>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-300"><Markdown text={q.body} /></div>
          </details>
        )) : <p className="text-sm text-slate-500">No questions yet. Search below or press Random 3.</p>}
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <input value={term} onChange={e => setTerm(e.target.value)} placeholder={item.type === 'CODING' ? 'Search by title or number (e.g. 1328 or #12)…' : item.type === 'SYSTEM_DESIGN' ? 'Search by text or id…' : 'Search by text or id…'} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          {results.length > 0 && (
            <ul className="mt-2 max-h-56 divide-y divide-slate-200 overflow-auto rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
              {results.map(r => {
                const chosen = refs.includes(r.ref)
                return (
                  <li key={r.ref} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="min-w-0 truncate text-slate-800 dark:text-slate-200">{r.title}</span>
                    <button type="button" disabled={chosen || saving || refs.length >= 8} onClick={() => run(() => setInterviewQuestions(item.id, [...refs, r.ref]))} className="shrink-0 text-xs font-semibold text-blue-600 hover:underline disabled:text-slate-400 dark:text-blue-400">{chosen ? 'Added' : 'Add'}</button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Up to 8 questions. Your list is kept while the interview lasts.</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Candidate's resume</h3>
        {resume ? (
          <FitPage><ResumePreview data={resume.data} layout={layout} fit /></FitPage>
        ) : <p className="text-sm text-slate-500">{note || 'Loading the resume…'}</p>}
      </div>
    </div>
  )
}

// The resume page is a fixed 816px wide sheet. Scale it down so the whole width fits the box it is shown in.
function FitPage({ children }) {
  const box = useRef(null)
  const page = useRef(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !page.current) return
      const s = Math.min(1, box.current.clientWidth / 816)
      setScale(s)
      setHeight(page.current.offsetHeight * s)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box.current)
    ro.observe(page.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={box} className="max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-lg bg-slate-300 dark:bg-slate-800">
      <div style={{ height: height || undefined }}>
        <div ref={page} style={{ width: 816, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  )
}
