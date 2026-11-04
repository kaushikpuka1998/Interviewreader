/**
 * Question item in sidebar - polished, professional design
 */
export default function QuestionLink({ question, isActive, onClick, selectedId, visited, read }) {
  // Tech badge colors - consistent with TechFilter
  const techStyles = {
    hld: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
    java: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
    react: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
    node: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    sql: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
    microservices: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
    'design-patterns': 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    behavioral: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    kafka: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
    default: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
  }

  // Difficulty badge colors - softer, more refined
  const diffStyles = {
    Basic: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    Intermediate: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    Advanced: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    Experienced: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
    default: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
  }

  const techLabel = question.tech === 'design-patterns' ? 'Design Patterns' :
                    question.tech === 'hld' ? 'HLD' :
                    question.tech.charAt(0).toUpperCase() + question.tech.slice(1)

  return (
    <button
      data-selected={isActive}
      className={`question-link relative w-full text-left pl-2 pr-3 py-2.5 rounded-xl transition-all duration-200 ease-out group
        border border-transparent
        ${
          isActive
            ? 'bg-gradient-to-r from-blue-200 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 text-slate-900 dark:text-slate-100 shadow-[0_0_0_1px_rgba(4,120,87,0.55)] shadow-emerald-900/10 dark:shadow-[0_0_0_1px_rgba(59,130,246,0.2)]'
            : 'text-slate-700 dark:text-slate-300 hover:bg-blue-100 hover:border-blue-300 hover:shadow-md hover:shadow-emerald-900/10 dark:hover:bg-slate-800 dark:hover:border-slate-800 dark:hover:shadow-none'
        }
        ${
          isActive
            ? 'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-7 before:bg-blue-500 before:rounded-r-full'
            : ''
        }`}
      onClick={onClick}
      style={{ transformOrigin: 'left center' }}
    >
      {/* Subtle hover lift effect */}
      <div className="relative flex items-start gap-2 transition-transform duration-200 group-hover:translate-x-0.5">
        {/* Badge stack on the left - tech type above, difficulty below */}
        <div className="flex flex-col gap-1 flex-shrink-0 items-start w-20">
          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded tracking-wide ${techStyles[question.tech] || techStyles.default}`} style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            {techLabel}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded ${diffStyles[question.difficulty] || diffStyles.default}`}>
            {question.difficulty}
          </span>
        </div>

        {/* Question number - fixed width for alignment */}
        <span className="qnum flex-shrink-0 w-12 text-right text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500 leading-none mt-0.5 pr-2">
          Q{question.displayNumber}.
        </span>

        {/* Question text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug text-slate-900 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors duration-150 pr-10" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {question.question}
          </p>
        </div>
      </div>

      {/* Visited/Read indicators - fixed right side */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {question.locked && <span className="p-1 text-amber-600 dark:text-amber-400" title="Premium" aria-label="Premium">🔒</span>}
          {read.has(question.id) && (
            <span className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded" title="Read" aria-label="Read">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </span>
          )}
          {visited.has(question.id) && !read.has(question.id) && (
            <span className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded" title="Visited" aria-label="Visited">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </span>
          )}
      </div>
      </button>
  )
}
