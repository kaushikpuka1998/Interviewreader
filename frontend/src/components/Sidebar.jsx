import { useState, useRef, useEffect } from 'react'
import Loader from './Loader.jsx'
import QuestionLink from './QuestionLink.jsx'
import { SearchInput, TechFilter, CategorySelect, CompanySelect, StatusSelect, DifficultySelect, QuestionCount } from './SidebarFilters.jsx'
import Notifications from './Notifications.jsx'
import PracticeCard from './PracticeCard.jsx'
import { resumeBuilderLink } from '../lib/analytics.js'
import { useFeature } from '../lib/features.js'
import { fetchQotd } from '../lib/engage.js'

function DailyQuestionLink({ onSelect, selectedId }) {
  const [daily, setDaily] = useState(null)

  useEffect(() => {
    let active = true
    fetchQotd().then(data => {
      if (active && data?.id) setDaily(data)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  if (!daily) return null
  const isActive = selectedId === daily.id
  return (
    <button
      type="button"
      onClick={() => onSelect(daily)}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition-all duration-200 ${isActive ? 'border-amber-400 bg-amber-50 shadow-sm dark:border-amber-400/50 dark:bg-amber-400/10' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-amber-400/20 dark:from-amber-400/10 dark:to-orange-400/5 dark:hover:border-amber-400/40'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-amber-800 dark:text-amber-200">
          <span aria-hidden="true">☀️</span> Question of the day
        </span>
        <span className="text-xs font-bold text-amber-700 transition-transform group-hover:translate-x-0.5 dark:text-amber-300" aria-hidden="true">→</span>
      </span>
      <span className="mt-1.5 block line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">{daily.title}</span>
      <span className="mt-1.5 block text-xs text-slate-600 dark:text-slate-300">A new interview question every day</span>
    </button>
  )
}

/**
 * Sidebar component
 */
export default function Sidebar({  questions, filtered, selectedId, query, setQuery, tech, setTech, category, setCategory, difficulty, setDifficulty, status, setStatus, onSelect, onDailySelect, onToggleDark, isDark, isMobile = false, sidebarWidth = 360, questionListRef, hasMore, onLoadMore, loading, visited, read, categories, company, setCompany, companies = [], user, onLoginClick, onLogout, onAdminClick, freeTechs = [], onLockedTech, onPremium, onCompanyLocked, stats, totalCount }) {
  const [filtersOpen, setFiltersOpen] = useState(false) // collapsed by default; opens when the member taps Filters
  const resumeOn = useFeature('resume_builder')
  const sentinelRef = useRef(null)
  // Fallback ref so the mobile instance (which isn't given a questionListRef) still works
  const internalListRef = useRef(null)
  const listRef = questionListRef || internalListRef

  // ponytail: scroll-listener pagination — fires onLoadMore when within 200px of the bottom.
  // More reliable than IntersectionObserver, which is throttled/flaky on some mobile browsers.
  useEffect(() => {
    const el = listRef.current
    if (!hasMore || !el) return
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) onLoadMore()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // in case the list is already short enough to show the bottom
    return () => el.removeEventListener('scroll', onScroll)
  }, [hasMore, onLoadMore, listRef])

  const getBannerText = () => {
    const techMap = { java: 'Java', react: 'React', node: 'Node', sql: 'SQL', hld: 'HLD' }
    
    if (tech === 'all') {
      let techsStr = "Java, React, Node & SQL"
      if (stats?.byTech && Object.keys(stats.byTech).length > 0) {
         const keys = Object.keys(stats.byTech).map(k => techMap[k.toLowerCase()] || k.charAt(0).toUpperCase() + k.slice(1))
         if (keys.length === 1) techsStr = keys[0]
         else if (keys.length === 2) techsStr = keys.join(' & ')
         else techsStr = keys.slice(0, -1).join(', ') + ' & ' + keys[keys.length - 1]
      }
      return `${stats?.total ?? questions.length} ${techsStr} questions`
    }
    
    const techName = techMap[tech.toLowerCase()] || tech.charAt(0).toUpperCase() + tech.slice(1)
    
    let count = questions.length
    if (stats?.byTech) {
      const key = Object.keys(stats.byTech).find(k => k.toLowerCase() === tech.toLowerCase())
      if (key) {
        count = stats.byTech[key]
      }
    }
    return `${count} ${techName} questions`
  }

  return (
    <aside
      className={`sidebar sidebar-responsive h-full flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 ${isMobile ? '' : 'hidden lg:flex'}`}
      style={{ width: `${sidebarWidth}px`, minWidth: '280px', maxWidth: '600px', flexShrink: 0 }}
    >
      {isMobile && <>
      <div className="brand p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img src="/logo.svg" alt="" className="logo w-10 h-10 rounded-xl shadow-lg flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">Interview Reader</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{getBannerText()}</p>
            </div>
          </div>
          <button
            onClick={onToggleDark}
            className="tip relative flex-shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle dark mode"
            data-tip="Toggle dark mode"
            aria-pressed={isDark}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Auth row: shows sign-in when logged out, account + logout when logged in */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {user ? (
            <>
              <a href="/profile" className="flex items-center gap-2 min-w-0 hover:opacity-80" title="View your profile">
                <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                  {(user.name || user.email || '?').trim().charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate hover:underline">{user.name || user.email}</span>
              </a>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Notifications />
                {user.admin && (
                  <button
                    onClick={onAdminClick}
                    title="Open the admin dashboard"
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM4 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
                    </svg>
                    Admin
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-red-600/30 transition-colors hover:bg-red-700 hover:shadow-md hover:shadow-red-600/40 dark:bg-red-600 dark:hover:bg-red-500"
                  title="Log out of your account"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m12 0l-4-4m4 4l-4 4m-1 5h7a2 2 0 002-2V5a2 2 0 00-2-2h-7" />
                  </svg>
                  Log out
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onLoginClick}
              className="w-full py-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow hover:opacity-95 transition"
            >
              Log in / Sign up
            </button>
          )}
        </div>
      </div>

      {/* Resume builder entry point, tagged so clicks show up under Resume builder in analytics */}
      {resumeOn && (
      <div className="px-4 pt-4 flex-shrink-0">
        <a
          href={resumeBuilderLink('sidebar')}
          className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 px-4 py-3 text-white shadow-md shadow-blue-600/20 transition hover:opacity-95"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Build your resume</span>
            <span className="block text-xs text-blue-100">Free LaTeX templates, PDF in one click</span>
          </span>
          <span aria-hidden="true" className="text-lg">→</span>
        </a>
      </div>
      )}

      {/* Practice coding: shown only when coding problems exist */}
      <PracticeCard />
      </>}

      {/* Search always visible */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <SearchInput value={query} onChange={setQuery} placeholder="Search questions... (try '352' or 'Q352' for direct number lookup)" />
      </div>

      {/* Collapsible filters on mobile */}
      {isMobile ? (
        <div className="border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            aria-expanded={filtersOpen}
            aria-controls="mobile-filters"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </span>
            <svg className={`w-4 h-4 text-slate-500 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div id="mobile-filters" className={`${filtersOpen ? 'block' : 'hidden'}`}>
            <div className="p-4 space-y-4">
              <TechFilter value={tech} onChange={setTech} locked={!user} freeTechs={freeTechs} onLockedClick={onLockedTech} />
              <CategorySelect
                value={category}
                onChange={setCategory}
                options={categories}
                disabled={tech === 'all' && categories.length > 50}
              />
              <DifficultySelect
                value={difficulty}
                onChange={setDifficulty}
                questions={questions}
                tech={tech}
              />
              {user && <CompanySelect value={company} onChange={setCompany} options={companies} locked={!(user.premium || user.admin)} onLocked={onCompanyLocked} />}
              {user && <StatusSelect value={status} onChange={setStatus} />}
              <QuestionCount count={filtered.length} total={totalCount !== undefined ? totalCount : questions.length} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              aria-expanded={filtersOpen}
              aria-controls="desktop-filters"
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
              </span>
              <svg className={`w-4 h-4 text-slate-500 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div id="desktop-filters" className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${filtersOpen ? 'max-h-[520px]' : 'max-h-0'}`}>
              <div className="p-4 space-y-4">
                <TechFilter value={tech} onChange={setTech} locked={!user} freeTechs={freeTechs} onLockedClick={onLockedTech} />
                <CategorySelect
                  value={category}
                  onChange={setCategory}
                  options={categories}
                  disabled={tech === 'all' && categories.length > 50}
                />
                <DifficultySelect
                  value={difficulty}
                  onChange={setDifficulty}
                  questions={questions}
                  tech={tech}
                />
                {user && <CompanySelect value={company} onChange={setCompany} options={companies} locked={!(user.premium || user.admin)} onLocked={onCompanyLocked} />}
                {user && <StatusSelect value={status} onChange={setStatus} />}
              </div>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <QuestionCount count={filtered.length} total={totalCount !== undefined ? totalCount : questions.length} />
          </div>
        </>
      )}

      <nav ref={listRef} className="question-list flex-1 min-h-[16rem] overflow-y-auto p-2 space-y-1.5" aria-label="Question list">
        <DailyQuestionLink onSelect={onDailySelect || onSelect} selectedId={selectedId} />
        {loading && filtered.length === 0 ? (
          <Loader compact label="Loading questions…" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No questions match your filters</p>
          </div>
        ) : (
          <>
            {filtered.map(q => (
              <QuestionLink
                key={q.id}
                question={q}
                isActive={selectedId === q.id}
                onClick={() => onSelect(q.id)}
                selectedId={selectedId}
                visited={visited}
                read={read}
              />
            ))}
            {hasMore && (
              <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                Loading more…
              </div>
            )}
          </>
        )}
      </nav>
    </aside>
  )
}
