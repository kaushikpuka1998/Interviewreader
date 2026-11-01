import { useMemo } from 'react'

/**
 * Search input with clear button
 */
export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        className="search w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Search questions"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          aria-label="Clear search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * Tech filter segmented control - colorful icons per technology
 */
export function TechFilter({ value, onChange, locked = false, freeTechs = [], onLockedClick }) {
  const options = [
    {
      value: 'all', label: 'All',
      active: 'bg-blue-500 text-white shadow-sm shadow-blue-500/30',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    },
    {
      value: 'java', label: 'Java',
      active: 'bg-orange-500 text-white shadow-sm shadow-orange-500/30',
      // Coffee cup with steam (Java)
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>,
    },
    {
      value: 'hld', label: 'HLD',
      active: 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30',
      // architecture/sitemap icon
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    },
    {
      value: 'react', label: 'React',
      active: 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30',
      // React atom logo
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"/><ellipse cx="12" cy="12" rx="9" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5"/><ellipse cx="12" cy="12" rx="9" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)"/></svg>,
    },
    {
      value: 'node', label: 'Node',
      active: 'bg-green-500 text-white shadow-sm shadow-green-500/30',
      // Node.js hexagon logo
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l7.5 3.75v8.64L12 21.82 4.5 18.07v-8.64L12 4.18zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>,
    },
    {
      value: 'sql', label: 'SQL',
      active: 'bg-purple-500 text-white shadow-sm shadow-purple-500/30',
      // database cylinder (SQL)
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c-4.42 0-8 1.34-8 3v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5c0-1.66-3.58-3-8-3zm6 17c0 .3-2.13 1.5-6 1.5S6 19.3 6 19v-2.23c1.5.77 3.72 1.23 6 1.23s4.5-.46 6-1.23V19zm0-4.5c0 .3-2.13 1.5-6 1.5s-6-1.2-6-1.5v-2.23c1.5.77 3.72 1.23 6 1.23s4.5-.46 6-1.23v2.23zM12 8.5C8.13 8.5 6 7.3 6 7s2.13-1.5 6-1.5S18 6.7 18 7s-2.13 1.5-6 1.5z"/></svg>,
    },
    {
      value: 'microservices', label: 'Microservices',
      active: 'bg-rose-500 text-white shadow-sm shadow-rose-500/30',
      // connected nodes (microservices)
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a3 3 0 00-1 5.83V10H7a3 3 0 00-3 3v1.17a3 3 0 101.99.01V13a1 1 0 011-1h10a1 1 0 011 1v1.18A3 3 0 1020 14.17V13a3 3 0 00-3-3h-4V7.83A3 3 0 0012 2z"/></svg>,
    },
    {
      value: 'kafka', label: 'Kafka',
      active: 'bg-slate-700 text-white shadow-sm shadow-slate-700/30',
      // Kafka logo - streaming platform
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>,
    },
    {
      value: 'golang', label: 'Go',
      active: 'bg-sky-500 text-white shadow-sm shadow-sky-500/30',
      // Go gopher-ish / Go blue mark
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 12h4"/><path d="M18 12h4"/><circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="10" r="1.2" fill="currentColor" stroke="none"/><path d="M6 13a6 6 0 0 0 12 0V9a6 6 0 0 0-12 0z"/></svg>,
    },
    {
      value: 'design-patterns', label: 'Design Pattern',
      active: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
      // puzzle piece (design patterns)
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.5 11H19V7a2 2 0 00-2-2h-4V3.5a2.5 2.5 0 00-5 0V5H4a2 2 0 00-2 2v3.8h1.5a2.2 2.2 0 010 4.4H2V19a2 2 0 002 2h3.8v-1.5a2.2 2.2 0 014.4 0V21H17a2 2 0 002-2v-4h1.5a2.5 2.5 0 000-5z"/></svg>,
    },
    {
      value: 'behavioral', label: 'Behavioral',
      active: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
      // speech bubble (behavioral / STAR stories)
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z"/></svg>,
    },
    {
      value: 'misc', label: 'Miscellaneous',
      active: 'bg-teal-500 text-white shadow-sm shadow-teal-500/30',
      // grid/collection (miscellaneous)
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>,
    },
    {
      value: 'angular', label: 'Angular',
      active: 'bg-red-600 text-white shadow-sm shadow-red-600/30',
      // Angular shield logo
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l9 3.27L19.5 18 12 22 4.5 18 3 5.27 12 2zm0 2.2L5.1 6.6l1.2 9.5L12 19.4l5.7-3.3 1.2-9.5L12 4.2zm0 2.3l4.5 10.8h-1.7l-.9-2.3H10l-.9 2.3H7.4L12 6.5zm0 3.3l-1.5 3.7h3l-1.5-3.7z"/></svg>,
    },
    {
      value: 'rails', label: 'Ruby on Rails',
      active: 'bg-pink-600 text-white shadow-sm shadow-pink-600/30',
      // gem/ruby icon
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3 4H9l3-4zM4 9l5-3-1 5-4 3v-5zm16 0v5l-4-3-1-5 5 3zM4 9l4 5-6 3 2-8zm16 0l2 8-6-3 4-5zM6 14l6 8-8-3 2-5zm12 0l2 5-8 3 6-8zM9 11h6l-3 3-3-3z"/></svg>,
    },
  ]

  return (
    <div className="segmented grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-lg" role="group" aria-label="Filter by technology">
      {options.map(opt => {
        // Signed out: everything except the free sample needs an account.
        const isLocked = locked && opt.value !== 'all' && !freeTechs.includes(opt.value)
        return (
        <button
          key={opt.value}
          className={`relative w-full min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
            value === opt.value
              ? opt.active
              : isLocked
              ? 'bg-white/60 text-slate-400 border border-slate-200 hover:border-blue-300 hover:text-blue-500 dark:bg-slate-900/20 dark:text-slate-500 dark:border-slate-700/60'
              : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
          }`}
          onClick={() => (isLocked ? onLockedClick?.(opt.value) : onChange(opt.value))}
          aria-pressed={value === opt.value}
          title={isLocked ? `${opt.label} — sign up free to unlock` : opt.label}
        >
          {opt.icon}
          <span>{opt.label}</span>
          {isLocked && (
            <svg className="w-3 h-3 flex-shrink-0 opacity-70" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      )})}
    </div>
  )
}

/**
 * Category dropdown - enhanced UI
 */
export function CategorySelect({ value, onChange, options, disabled }) {
  if (disabled || options.length === 0) return null

  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
      </svg>
      <select
        className="select w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer appearance-none"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Filter by category"
      >
        <option value="all">All categories</option>
        {options.map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8l4 4 4-4" />
      </svg>
    </div>
  )
}

/**
 * Company filter — questions readers reported as asked at that company.
 * Options come from the companies already reported, most-reported first.
 */
export function CompanySelect({ value, onChange, options }) {
  if (options.length === 0) return null

  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <select
        className="select w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer appearance-none"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Filter by company"
      >
        <option value="all">All companies</option>
        {options.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8l4 4 4-4" />
      </svg>
    </div>
  )
}

/**
 * Status filter - All / Visited / Solved / Unread
 */
export function StatusSelect({ value, onChange }) {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'visited', label: 'Visited' },
    { value: 'solved', label: 'Solved' },
    { value: 'flagged', label: 'Flagged' },
    { value: 'important', label: 'Important' },
    { value: 'unsolved', label: 'Unsolved' },
  ]

  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <select
        className="select w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer appearance-none"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Filter by status"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8l4 4 4-4" />
      </svg>
    </div>
  )
}

/**
 * Difficulty filter dropdown - enhanced UI (uses actual data difficulties)
 */
export function DifficultySelect({ value, onChange, questions, tech }) {
  // Get unique difficulties from filtered questions
  const allDifficulties = ['Basic', 'Intermediate', 'Advanced', 'Experienced']
  const difficulties = useMemo(() => {
    const techQuestions = questions.filter(q => tech === 'all' || q.tech === tech)
    const found = new Set(techQuestions.map(q => q.difficulty))
    return allDifficulties.filter(d => found.has(d))
  }, [questions, tech])

  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <select
        className="select w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer appearance-none"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Filter by difficulty"
      >
        <option value="all">All difficulties</option>
        {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8l4 4 4-4" />
      </svg>
    </div>
  )
}

/**
 * Question count display
 */
export function QuestionCount({ count, total }) {
  return (
    <div className="count text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
      <span>{count} of {total} questions</span>
    </div>
  )
}
