import { useEffect, useRef, useState } from 'react'
import { login, register, googleSignIn, fetchGoogleClientId } from '../lib/auth.js'
import { trackClick, flushEvents } from '../lib/analytics.js'
import TermsContent from './TermsContent.jsx'

// Set after any successful sign-in on this device: returning people see "Log in" first, new people "Create account".
const HAD_ACCOUNT_KEY = 'ir_had_account'
// Which kind of page the dialog was opened from, for the sign-up funnel.
const pageKind = () => {
  const p = location.pathname
  if (p === '/') return 'home'
  const top = p.split('/')[1]
  return ['problems', 'practice', 'roadmaps', 'resume', 'interview', 'profile', 'leaderboard', 'u'].includes(top) ? top : 'question'
}

// Google's own "Sign in with Google" button (Google Identity Services). The script loads once, on first use.
let gisScript = null
let onGoogleCredential = () => {}
function loadGis(clientId) {
  gisScript ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => {
      window.google.accounts.id.initialize({ client_id: clientId, callback: r => onGoogleCredential(r.credential) })
      resolve(window.google)
    }
    s.onerror = () => { gisScript = null; reject(new Error('Could not load Google sign-in')) }
    document.head.appendChild(s)
  })
  return gisScript
}

function GoogleButton({ text, onCredential }) {
  const box = useRef(null)
  const [hidden, setHidden] = useState(true)   // stays hidden when Google sign-in is off or can't load
  onGoogleCredential = onCredential
  useEffect(() => {
    let live = true
    fetchGoogleClientId().then(id => id && loadGis(id)).then(google => {
      if (!live || !google || !box.current) return
      setHidden(false)
      google.accounts.id.renderButton(box.current, {
        theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
        size: 'large', shape: 'pill', text, logo_alignment: 'left',
        width: Math.min(400, box.current.offsetWidth || 320),
      })
    }).catch(() => {})
    return () => { live = false }
  }, [text])
  return (
    <div className={hidden ? 'hidden' : ''}>
      <div ref={box} className="flex min-h-[44px] w-full justify-center" />
      <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />or with email<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  )
}

// Login / signup modal. Calls onSuccess(user) after a successful auth.
// Sign-up asks only for email and password (name optional); location comes from the IP and can be edited on the profile.
export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState(() => (localStorage.getItem(HAD_ACCOUNT_KEY) ? 'login' : 'signup')) // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)     // sign-up: Terms accepted (and, unless under 18, aged 18+)
  const [minor, setMinor] = useState(false)       // sign-up: "I'm under 18" chosen
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianConsent, setGuardianConsent] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  // A Google sign-in for a new email, waiting for the Terms / age consent before the account is created.
  const [pendingGoogle, setPendingGoogle] = useState(null)

  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'
  const consent = () => ({ termsAccepted: agreed, ...(minor ? { guardianName, guardianEmail, guardianConsent } : { adult: agreed }) })

  const finish = (user, how) => {
    localStorage.setItem(HAD_ACCOUNT_KEY, '1')
    trackClick(`auth_success:${how}`)
    flushEvents()   // onSuccess often reloads the page
    onSuccess(user)
  }

  // Signs in with Google straight away; a new email first needs the consent boxes (unless already ticked here).
  async function withGoogle(credential) {
    setError(''); setSuccess('')
    trackClick(`auth_submit:google_${mode}`)
    setBusy(true)
    try {
      finish(await googleSignIn({ credential, ...(isSignup ? consent() : {}) }), 'google')
    } catch (err) {
      if (err.consentRequired) {
        setPendingGoogle(credential)
        setMode('signup')
        setError('')
        setSuccess('Almost done: confirm the box below to create your account with Google.')
      } else {
        setError(err.message)
        trackClick(`auth_error:google:${err.message}`)
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { trackClick(`auth_open:${mode}@${pageKind()}`) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const switchMode = m => { setMode(m); setPendingGoogle(null); setError(''); setSuccess(''); trackClick(`auth_mode:${m}`) }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (isSignup && !agreed) {
      setError(minor ? 'Please accept the Terms to create an account.' : 'Please confirm you are 18 or older and accept the Terms.')
      return
    }
    if (isSignup && minor && !guardianConsent) {
      setError("A parent or guardian's consent is needed if you are under 18.")
      return
    }
    if (!isForgot) trackClick(`auth_submit:${mode}`)
    setBusy(true)
    try {
      if (isForgot) {
        const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to send reset link')
        setSuccess(data.message)
      } else if (pendingGoogle) {
        finish(await googleSignIn({ credential: pendingGoogle, ...consent() }), 'google')
      } else {
        const user = isSignup
          ? await register({ email, password, name, termsAccepted: agreed, ...(minor ? { guardianName, guardianEmail, guardianConsent } : { adult: true }) })
          : await login({ email, password })
        finish(user, mode)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
      if (!isForgot) trackClick(`auth_error:${mode}:${err.message || 'unknown'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="m-auto w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {isForgot ? 'Reset password' : isSignup ? 'Create account' : 'Welcome back'}
          </h2>
          <button onClick={onClose} aria-label="Close" data-tip="Close" className="tip relative text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {!isForgot && !pendingGoogle && <GoogleButton text={isSignup ? 'signup_with' : 'signin_with'} onCredential={withGoogle} />}

        <form onSubmit={submit} className="space-y-4">
          {isSignup && (
            <p className="-mt-1 text-sm text-slate-500 dark:text-slate-400">Free forever. Save progress, unlock every topic and earn streak points.</p>
          )}
          {isSignup && !pendingGoogle && (
            <input
              type="text" placeholder="Name (optional)" value={name} autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {!pendingGoogle && (
            <input
              type="email" required placeholder="Email" value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {!isForgot && !pendingGoogle && (
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} required placeholder="Password (min 6 chars)" value={password}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                data-tip={showPassword ? 'Hide password' : 'Show password'}
                className="tip absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.7 9.7 0 0112 5c5 0 8.3 4.3 9.5 7a10.6 10.6 0 01-2.2 3.3M6.6 6.6A10.6 10.6 0 002.5 12c1.2 2.7 4.5 7 9.5 7 1.7 0 3.2-.5 4.5-1.2" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S5.8 5 12 5s9.5 7 9.5 7-3.3 7-9.5 7S2.5 12 2.5 12z" />
                    <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          )}

          {isSignup && minor && (
            <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Parent or guardian consent needed</p>
              <p className="text-xs text-amber-800 dark:text-amber-300">You are under 18, so a parent or guardian must agree to how your data is used.</p>
              <input
                type="text" required placeholder="Parent or guardian's name" value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email" required placeholder="Parent or guardian's email" value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox" checked={guardianConsent} onChange={(e) => { setGuardianConsent(e.target.checked); setError('') }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>I am this person's parent or legal guardian and I consent to them using Interview Reader and to the Terms and data use.</span>
              </label>
            </div>
          )}

          {isSignup && (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setError('') }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  {minor ? 'I agree to the Terms and how my data is used.' : "I'm 18 or older and agree to the Terms and how my data is used."}{' '}
                  <button type="button" onClick={() => setShowTerms(v => !v)} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                    {showTerms ? 'Hide terms' : 'Read terms'}
                  </button>
                </span>
              </label>
              <button type="button" onClick={() => { setMinor(m => !m); setError('') }} className="text-xs text-slate-500 hover:text-blue-600 hover:underline dark:text-slate-400">
                {minor ? "I'm 18 or older" : 'Under 18?'}
              </button>
              {showTerms && (
                <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <TermsContent />
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

          <button
            type="submit" disabled={busy || (isSignup && (!agreed || (minor && !guardianConsent)))}
            className="w-full py-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold shadow-lg hover:opacity-95 disabled:opacity-60 transition"
          >
            {busy ? 'Please wait…' : isForgot ? 'Send reset link' : pendingGoogle ? 'Create account with Google' : isSignup ? 'Create free account' : 'Log in'}
          </button>
        </form>

        {!isForgot && (
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => switchMode(isSignup ? 'login' : 'signup')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isSignup ? 'Log in' : 'Sign up'}
            </button>
          </p>
        )}

        {mode === 'login' && (
          <div className="mt-2 text-center">
            <button onClick={() => switchMode('forgot')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Forgot password?
            </button>
          </div>
        )}

        {isForgot && (
          <div className="mt-4 text-center">
            <button onClick={() => switchMode('login')} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
              ← Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
