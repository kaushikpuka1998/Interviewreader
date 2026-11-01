import { techLabel } from '../lib/badges.js'

/**
 * Shown in place of the reader when a signed-out visitor asks for a locked topic.
 * Sells the account rather than just refusing.
 */
export default function SignupGate({ tech, message, title, freeTechs = [], onSignup, onBrowseFree }) {
  return (
    <main className="reader flex-1 h-screen overflow-y-auto bg-white dark:bg-slate-800 flex items-center justify-center p-6 min-w-0">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {title || (tech ? `${techLabel(tech)} questions are for members` : 'Members only')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {message || 'Create a free account to unlock every topic.'}
        </p>

        <ul className="text-left text-sm text-slate-600 dark:text-slate-300 space-y-2 mb-7 mx-auto max-w-xs">
          {[
            'Every topic unlocked — 3,000+ questions',
            'Track what you have read and solved',
            'Your progress syncs across devices',
            'See which companies asked each question',
          ].map(t => (
            <li key={t} className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t}
            </li>
          ))}
        </ul>

        <button
          onClick={onSignup}
          className="w-full py-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold shadow-lg hover:opacity-95 transition"
        >
          Sign in or create a free account
        </button>

        {freeTechs.length > 0 && (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Or keep browsing{' '}
            {freeTechs.map((t, i) => (
              <span key={t}>
                {i > 0 && ' and '}
                <button onClick={() => onBrowseFree(t)} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  {techLabel(t)}
                </button>
              </span>
            ))}
            {' '}for free.
          </p>
        )}

        <p className="mt-3 text-xs text-slate-400">Free forever. No card required.</p>
      </div>
    </main>
  )
}
