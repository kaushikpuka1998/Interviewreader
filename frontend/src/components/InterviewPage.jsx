import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import TopBar from './TopBar.jsx'
import AuthModal from './AuthModal.jsx'
import Loader from './Loader.jsx'
import { FeedbackView } from './InterviewFeedback.jsx'
import Markdown from './Markdown.jsx'
import ResumePreview from './ResumePreview.jsx'
import InterviewQuestionPicker from './InterviewQuestionPicker.jsx'
import { isLoggedIn, getUser } from '../lib/auth.js'
import { useFeatures } from '../lib/features.js'
import { fetchResumes, fetchTemplates } from '../lib/resume.js'
import { TYPES, typeLabel, fetchUpcoming, takeInterview, fetchMyInterviews, requestInterview, slotToIso, formatSlot, fetchInterviewResume, saveCallLink, saveWhiteboardLink, reportNoShow, completeInterview, cancelInterview, fetchInterviewQuota } from '../lib/interviews.js'
import { subscribeInterviewPlan } from '../lib/billing.js'
import PremiumPlans from './PremiumPlans.jsx'

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

  const [quota, setQuota] = useState(null)
  const [plansOpen, setPlansOpen] = useState(false)
  const loadQuota = useCallback(() => fetchInterviewQuota().then(setQuota).catch(() => {}), [])
  const load = useCallback(() => fetchMyInterviews().then(setList).catch(e => setError(e.message)), [])
  useEffect(() => {
    if (!signedIn) return
    load()
    loadQuota()
    fetchResumes().then(r => { setResumes(r); if (r[0]) setResumeId(String(r[0].id)) }).catch(() => {})
    const timer = setInterval(load, 6000)   // pick up a match without a refresh
    return () => clearInterval(timer)
  }, [signedIn, load, loadQuota])

  useEffect(() => {
    if (!signedIn || !canInterview) return
    const get = () => fetchUpcoming().then(setUpcoming).catch(() => setUpcoming([]))
    get()
    const t = setInterval(get, 15000)
    return () => clearInterval(t)
  }, [signedIn, canInterview])


  const act = async fn => {
    setBusy(true); setError('')
    try { await fn(); await load(); loadQuota() } catch (e) {
      if (e.status === 402) { if (e.quota) setQuota(e.quota); setPlansOpen(true) }
      setError(e.message)
    } finally { setBusy(false) }
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

          {/* Voice mock interviewer: no human needed, no waiting. Ends with a hiring decision. */}
          <a href="/interview/practice" className="group relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 p-5 text-white shadow-md transition hover:shadow-lg">
            <span className="max-w-2xl">
              <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">🗣 New · No waiting for an interviewer</span>
              <span className="mt-1 block text-lg font-extrabold">Take a system design mock interview right now</span>
              <span className="block text-sm text-white/90">A voice interviewer asks, listens and follows up, then gives you a Strong Hire to Rejected decision with a rating and feedback. Your first 3 interviews are free.</span>
            </span>
            <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-violet-700 group-hover:bg-violet-50">Try it free →</span>
          </a>

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
              {quota && <InterviewQuotaBar quota={quota} onPlans={() => setPlansOpen(true)} />}
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
              {quota && !quota.canRequest ? (
                <button className={primary} onClick={() => setPlansOpen(true)}>Get more interviews to book</button>
              ) : (
                <button className={primary} disabled={busy || !slot || (type === 'RESUME' && !resumeId)}
                  onClick={() => act(() => requestInterview(type, resumeId, slotToIso(slot), wantsToInterview))}>
                  {busy ? 'Sending request…' : 'Request an interview'}
                </button>
              )}
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
      {plansOpen && quota && <InterviewPlans quota={quota} onClose={() => setPlansOpen(false)} onBought={() => { setPlansOpen(false); setError(''); loadQuota() }} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />}
    </>
  )
}

const shortDate = iso => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '')

// What the candidate can still book: free launch period, Premium's monthly interviews, a monthly plan.
function InterviewQuotaBar({ quota, onPlans }) {
  if (quota.unlimited) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">Admin · unlimited interviews</p>
  if (quota.freePeriod) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
        <span>🎉 <strong>Free for everyone until {shortDate(quota.freeUntil)}.</strong> After that, Premium includes {quota.premiumMonthly} interviews a month, or pick a monthly plan.</span>
        <button type="button" onClick={onPlans} className="text-xs font-semibold underline">See plans</button>
      </div>
    )
  }
  const parts = []
  if (quota.premium) parts.push(<span key="p">★ Premium: <strong>{quota.premiumLeft}</strong> of {quota.premiumMonthly} left this month · resets {shortDate(quota.premiumResets)}</span>)
  if (quota.plan) parts.push(<span key="pl">Plan {quota.planInterviews}: <strong>{quota.planLeft}</strong> of {quota.planInterviews} left{quota.periodEnd ? ` · renews ${shortDate(quota.periodEnd)}` : ''}</span>)
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm ${quota.canRequest ? 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'}`}>
      <span className="flex flex-wrap gap-x-4 gap-y-1">{parts.length ? parts : <span>Mock interviews need Premium ({quota.premiumMonthly} a month included) or a monthly plan.</span>}{!quota.canRequest && parts.length > 0 && <strong>No interviews left.</strong>}</span>
      <button type="button" onClick={onPlans} className="rounded-lg bg-gradient-to-r from-amber-500 to-pink-600 px-3 py-1 text-xs font-bold text-white">{quota.plan ? 'Change plan' : 'Get more interviews'}</button>
    </div>
  )
}

// Ways to book peer interviews after the free period: Premium (includes a few a month, plus roadmaps) or a plan.
function InterviewPlans({ quota, onClose, onBought }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [premiumOpen, setPremiumOpen] = useState(false)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const buy = async plan => {
    setBusy(plan); setError('')
    try { await subscribeInterviewPlan(plan); onBought() } catch (e) { if (e.message !== 'Payment cancelled.') setError(e.message) } finally { setBusy('') }
  }
  if (premiumOpen) return <PremiumPlans onClose={() => setPremiumOpen(false)} onBought={() => window.location.reload()} />
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="iv-plans-title" onClick={onClose} className="premium-fade fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="iv-plans-title" className="text-lg font-bold text-slate-900 dark:text-white">Mock interviews with real interviewers</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {quota.freePeriod ? `Free for everyone until ${shortDate(quota.freeUntil)}. After that, choose one of these.` : 'Choose how you want to keep booking interviews.'}
              {' '}Cancelled interviews and interviewer no-shows don't count.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="relative flex flex-col rounded-xl border-2 border-amber-400 p-4 text-center shadow-md">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-pink-600 px-2.5 py-0.5 text-[10px] font-bold text-white">BEST VALUE</span>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">★ Premium</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">{quota.premiumMonthly}</p>
            <p className="text-xs text-slate-500">interviews / month included</p>
            <p className="mt-2 flex-1 text-xs text-slate-600 dark:text-slate-400">Plus personalized company roadmaps, cheat sheets and more. Monthly, yearly or lifetime pass.</p>
            <button type="button" onClick={() => setPremiumOpen(true)} disabled={quota.premium}
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-amber-500 to-pink-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {quota.premium ? 'You have Premium' : 'See Premium passes'}
            </button>
          </div>
          {quota.plans.map(p => {
            const current = quota.plan === p.key
            const rupees = label => parseInt(String(label || '').replace(/[^\d]/g, ''), 10) || 0
            const now = rupees(p.priceLabel), was = rupees(p.regularLabel)
            const off = was > now ? Math.round((1 - now / was) * 100) : 0
            return (
              <div key={p.key} className="relative flex flex-col rounded-xl border border-slate-200 p-4 text-center dark:border-slate-700">
                {off > 0 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">LAUNCH OFFER · {off}% OFF</span>}
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Interview plan</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">{p.interviews}</p>
                <p className="text-xs text-slate-500">interviews / month</p>
                <p className="mt-2 flex flex-wrap items-baseline justify-center gap-x-2">
                  {off > 0 && <span className="text-sm text-slate-400 line-through decoration-rose-500/70" aria-label={`was ${p.regularLabel}`}>{p.regularLabel.replace('/month', '')}</span>}
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{p.priceLabel}</span>
                </p>
                <p className="flex-1 text-xs text-slate-500">≈ ₹{Math.round(parseInt(String(p.priceLabel).replace(/[^\d]/g, ''), 10) / p.interviews)} per interview · renews monthly, cancel any time</p>
                <button type="button" disabled={!!busy || current || !p.available} onClick={() => buy(p.key)}
                  className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">
                  {current ? 'Current plan' : busy === p.key ? 'Opening payment…' : !p.available ? 'Coming soon' : quota.plan ? 'Switch' : 'Choose'}
                </button>
              </div>
            )
          })}
        </div>
        {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Premium's interviews are used first, then your plan's. Unused interviews don't carry over. Giving interviews is always free.</p>
      </div>
    </div>
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

      {/* Questions can be prepared as soon as the interview is matched; only the resume waits for the 10-minute window. */}
      {!waiting && interviewer && <div className="border-t border-slate-200 pt-5 dark:border-slate-800"><InterviewerTools item={item} onChanged={load} /></div>}

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

  useEffect(() => {
    if (!item.hasResume) { setNote('The candidate did not share a resume.'); return }
    if (!item.prepOpen) {
      setNote(`The candidate's resume opens 10 minutes before the start time${item.prepOpensAt ? `, at ${new Date(item.prepOpensAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${new Date(item.prepOpensAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : ''}. This page opens it by itself.`)
      return
    }
    Promise.all([fetchInterviewResume(item.id), fetchTemplates()])
      .then(([r, t]) => { setResume(r); setLayout(t.find(x => x.id === r.templateId)?.layout) })
      .catch(e => setNote(e.message))
  }, [item.id, item.hasResume, item.prepOpen])

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <InterviewQuestionPicker id={item.id} type={item.type} questions={item.questions} onChanged={onChanged} />
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
