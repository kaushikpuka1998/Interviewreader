import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import QotdCard from './QotdCard.jsx'
import { fetchStats } from '../lib/api.js'
import { fetchCompanies } from '../lib/codingProblems.js'
import { techBadge, techLabel } from '../lib/badges.js'
import { setDefaultSeo } from '../lib/seo.js'
import { useFeatures } from '../lib/features.js'

// DSA sheets that open on this site, using our own coding problems.
// Hidden until the sheet problems are in the database: set to true to show the section on the home page.
const SHOW_DSA_SHEETS = false
const SHEETS = [
  { name: "Striver's A2Z DSA Sheet", by: 'Striver (TakeUForward)', count: 433, text: 'A full roadmap from basics to advanced topics.', href: '/sheets/striver-a2z', internal: true },
  { name: 'Love Babbar DSA Sheet', by: 'Love Babbar', count: 430, text: 'Placement-focused list covering every major concept.', href: '/sheets/love-babbar', internal: true },
]

const LINKS = [
  { href: '/question-of-the-day', icon: '🔥', tone: 'orange', featured: true, tag: 'New', title: 'Daily challenge', text: 'A question to read and a coding problem to solve, new every day. Do both to build your streak.' },
  { href: '/questions', icon: '📖', tone: 'blue', title: 'Interview questions', text: 'Read answers with code examples and diagrams, and track what you have covered.' },
  { href: '/problems', icon: '🧩', tone: 'emerald', title: 'Coding problems', text: 'Solve problems with test cases and run them online.', flag: 'code_practice' },
  { href: '/practice', icon: '💻', tone: 'violet', title: 'Practice editor', text: 'A free online editor for Java, Python, C++, Go and more.', flag: 'code_practice' },
  { href: '/resume', icon: '📄', tone: 'rose', title: 'Resume builder', text: 'Pick a LaTeX template and export a PDF.', flag: 'resume_builder' },
]
const TONES = {
  orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
}

// Hero headline cycles through these, each with its logo (Google's favicon service, as on the roadmaps page).
const HERO_COMPANIES = [
  ['Google', 'google.com'], ['Amazon', 'amazon.com'], ['Meta', 'meta.com'], ['Microsoft', 'microsoft.com'],
  ['Uber', 'uber.com'], ['Netflix', 'netflix.com'], ['Atlassian', 'atlassian.com'],
]
const logoUrl = domain => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

export default function HomePage() {
  const features = useFeatures()
  // null = still loading (placeholders hold the space so nothing below jumps down when the numbers arrive); {} / [] = loaded or failed.
  const [stats, setStats] = useState(null)
  const [companies, setCompanies] = useState(null)
  useEffect(() => { fetchStats().then(setStats).catch(() => setStats({})); fetchCompanies().then(setCompanies).catch(() => setCompanies([])) }, [])
  useEffect(() => { setDefaultSeo(stats?.total) }, [stats?.total])

  // Feedback moved to its own page; old links (emails, bookmarks) to /#feedback land there.
  useEffect(() => { if (window.location.hash === '#feedback') window.location.replace(`/feedback${window.location.search}`) }, [])

  const topics = Object.entries(stats?.byTech || {}).sort((a, b) => b[1] - a[1])

  // Rotate the company in the headline every 2.2s (the word itself animates via .hero-word).
  const [heroIdx, setHeroIdx] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_COMPANIES.length), 2200)
    return () => clearInterval(t)
  }, [])
  const [heroName] = HERO_COMPANIES[heroIdx]

  return (
    <div className="flex min-h-screen flex-col bg-white bg-[radial-gradient(70rem_28rem_at_50%_-8rem,#d6f1e6,transparent_70%),radial-gradient(40rem_24rem_at_100%_30rem,#e6f6ef,transparent_70%)] dark:bg-slate-900 dark:bg-none">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <section className="text-center">
          {/* Who prepares here: the logos double as a hint of what the roadmaps cover. */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/15 bg-white py-1 pl-1.5 pr-3 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:shadow-none">
            <span className="flex -space-x-1.5">
              {HERO_COMPANIES.slice(0, 5).map(([name, domain]) => (
                <img key={name} src={logoUrl(domain)} alt="" width="20" height="20" decoding="async" className="h-5 w-5 rounded-full bg-white p-0.5 ring-2 ring-white dark:ring-slate-800" />
              ))}
            </span>
            Prep built from real FAANG &amp; top-tech interview loops
          </div>

          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl dark:text-slate-100">
            Crack your{' '}
            {/* The cell is as wide as the longest name (the others are invisible spacers), so the line never re-wraps as the word changes. */}
            <span className="inline-grid align-baseline">
              {HERO_COMPANIES.map(([n]) => <span key={n} aria-hidden="true" className="invisible col-start-1 row-start-1">{n}</span>)}
              <span key={heroName} className="hero-word col-start-1 row-start-1 bg-gradient-to-r from-blue-600 via-fuchsia-500 to-pink-500 bg-clip-text text-center text-transparent dark:from-blue-400 dark:via-fuchsia-400 dark:to-pink-400">
                {heroName}
              </span>
            </span>
            {' '}interview.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-400">
            One real answer at a time:{' '}
            {stats?.total ? <strong className="font-semibold text-slate-900 dark:text-slate-100">{stats.total.toLocaleString()}+ questions</strong> : 'Thousands of questions'} with clear answers
            hands-on <strong className="font-semibold text-slate-900 dark:text-slate-100"> DSA coding problems</strong>, focused preparation roadmaps for <strong className="font-semibold text-slate-900 dark:text-slate-100">DSA, System Design, Behavioural Interviews</strong> plus<strong className="font-semibold text-slate-900 dark:text-slate-100"> technical interview discussions</strong> covering for Java, React, Node.js, Go, SQL, system design and more.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/questions" className="w-full rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700 sm:w-auto">
              Start practicing free →
            </a>
            <a href="/roadmaps" className="w-full rounded-xl border border-emerald-700/25 bg-white px-7 py-3.5 font-semibold text-emerald-900 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700/50 hover:bg-emerald-50 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:shadow-none dark:hover:bg-slate-800">
              See company roadmaps
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">No credit card. Free topics open without an account.</p>
          <QotdCard className="mt-8" />

          {/* Proof strip: only shows numbers we actually have; a same-size placeholder holds the space while they load. */}
          {!stats && <div className="mx-auto mt-10 h-[88px] max-w-3xl animate-pulse rounded-2xl bg-emerald-50 dark:bg-slate-800/50" aria-hidden="true" />}
          {stats?.total > 0 && (
            <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-3 divide-x divide-emerald-900/10 rounded-2xl border border-emerald-900/10 bg-white py-4 shadow-md shadow-emerald-900/5 dark:divide-slate-700 dark:border-0 dark:bg-slate-800/50 dark:shadow-sm">
              {[
                [`${stats.total.toLocaleString()}+`, 'interview questions'],
                [topics.length, 'topics covered'],
                [companies?.length ? `${companies.length}+` : HERO_COMPANIES.length, companies?.length ? 'companies tagged' : 'company roadmaps'],
              ].map(([value, label]) => (
                <div key={label} className="px-2">
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">{value}</dd>
                  <dd className="text-xs text-slate-600 dark:text-slate-400">{label}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {features.mock_interview !== false && features.new_badge_interview === true && (
          <a href="/interview" aria-label="Book a free mock interview" className="mt-10 block overflow-hidden rounded-3xl shadow-lg transition hover:shadow-xl">
            <img src="/promo/mock-interview.png" alt="Free for 2 weeks: mock interviews with a real person. Book yours free." className="block h-auto w-full" />
          </a>
        )}

        {!stats && (
          <div className="mt-12" aria-hidden="true">
            <div className="mb-4 h-7 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-[116px] animate-pulse rounded-2xl bg-white dark:bg-slate-950" />)}</div>
          </div>
        )}
        {topics.length > 0 && (
          <section className="mt-12" aria-labelledby="topics">
            <h2 id="topics" className="mb-4 flex items-center gap-2.5 text-xl font-bold text-slate-900 dark:text-slate-100"><span className="h-5 w-1 rounded-full bg-emerald-600 dark:hidden" aria-hidden="true" />Browse by topic</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {topics.map(([tech, count]) => (
                <a key={tech} href={`/questions?tech=${encodeURIComponent(tech)}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-900/10 dark:border-0 dark:bg-slate-950 dark:hover:shadow-md">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${techBadge(tech)}`}>{techLabel(tech)}</span>
                  <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{count.toLocaleString()}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">questions</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {SHOW_DSA_SHEETS && (
        <section className="mt-12" aria-labelledby="sheets">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="sheets" className="text-xl font-bold text-slate-900 dark:text-slate-100">DSA sheets</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {SHEETS.map(s => (
              <a key={s.name} href={s.href} className="rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-slate-950">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name} →</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.by} · {s.count} problems</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{s.text}</p>
              </a>
            ))}
          </div>
        </section>
        )}

        {!companies && features.code_practice !== false && <div className="mt-12 min-h-[190px]" aria-hidden="true"><div className="mb-4 h-7 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /><div className="h-[130px] animate-pulse rounded-2xl bg-emerald-50 dark:bg-slate-950/60" /></div>}
        {companies?.length > 0 && features.code_practice !== false && (
          <section className="mt-12" aria-labelledby="companies">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 id="companies" className="flex items-center gap-2.5 text-xl font-bold text-slate-900 dark:text-slate-100"><span className="h-5 w-1 rounded-full bg-emerald-600 dark:hidden" aria-hidden="true" />Coding problems by company</h2>
              <a href="/problems" className="text-sm font-medium text-emerald-700 hover:underline dark:text-blue-400">All problems →</a>
            </div>
            <div className="flex flex-wrap gap-2">
              {companies.slice(0, 24).map(c => (
                <a key={c.name} href={`/problems?company=${encodeURIComponent(c.name)}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-emerald-500/60 hover:bg-emerald-50 hover:shadow-md dark:border-0 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-950">
                  {c.name} <span className="font-semibold text-emerald-700 dark:font-normal dark:text-slate-400">{c.count}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2" aria-label="More ways to prepare">
          {LINKS.filter(l => !l.flag || features[l.flag] !== false).map(l => (
            <a key={l.href} href={l.href}
              className={`group flex items-start gap-4 rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${l.featured
                ? 'border-orange-300 bg-gradient-to-r from-orange-50 via-amber-50 to-white shadow-md shadow-orange-900/5 hover:border-orange-400 sm:col-span-2 sm:items-center sm:p-6 dark:border-orange-400/40 dark:from-orange-500/15 dark:via-amber-500/10 dark:to-transparent dark:shadow-sm dark:hover:border-orange-400/70'
                : 'border-slate-200 bg-white hover:border-emerald-500/50 hover:shadow-emerald-900/10 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-400/60'}`}>
              <span className={`flex shrink-0 items-center justify-center rounded-xl ${TONES[l.tone]} ${l.featured ? 'h-14 w-14 text-3xl' : 'h-11 w-11 text-2xl'}`} aria-hidden="true">{l.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <h3 className={`font-semibold text-slate-900 dark:text-slate-100 ${l.featured ? 'text-lg' : ''}`}>{l.title}</h3>
                  {l.tag && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{l.tag}</span>}
                </span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">{l.text}</span>
              </span>
              <span className="mt-1 shrink-0 text-lg text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-500" aria-hidden="true">→</span>
            </a>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  )
}
