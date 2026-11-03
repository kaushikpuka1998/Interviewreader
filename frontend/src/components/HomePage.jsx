import { useEffect, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import { fetchStats } from '../lib/api.js'
import { fetchCompanies } from '../lib/codingProblems.js'
import { techBadge, techLabel } from '../lib/badges.js'
import { setDefaultSeo } from '../lib/seo.js'
import { useFeatures } from '../lib/features.js'
import FeedbackForm, { focusFeedback } from './FeedbackForm.jsx'

// DSA sheets that open on this site, using our own coding problems.
// Hidden until the sheet problems are in the database: set to true to show the section on the home page.
const SHOW_DSA_SHEETS = false
const SHEETS = [
  { name: "Striver's A2Z DSA Sheet", by: 'Striver (TakeUForward)', count: 433, text: 'A full roadmap from basics to advanced topics.', href: '/sheets/striver-a2z', internal: true },
  { name: 'Love Babbar DSA Sheet', by: 'Love Babbar', count: 430, text: 'Placement-focused list covering every major concept.', href: '/sheets/love-babbar', internal: true },
]

const LINKS = [
  { href: '/questions', title: 'Interview questions', text: 'Read answers with code examples and diagrams, and track what you have covered.' },
  { href: '/problems', title: 'Coding problems', text: 'Solve problems with test cases and run them online.', flag: 'code_practice' },
  { href: '/practice', title: 'Practice editor', text: 'A free online editor for Java, Python, C++, Go and more.', flag: 'code_practice' },
  { href: '/resume', title: 'Resume builder', text: 'Pick a LaTeX template and export a PDF.', flag: 'resume_builder' },
]

// Hero headline cycles through these, each with its logo (Google's favicon service, as on the roadmaps page).
const HERO_COMPANIES = [
  ['Google', 'google.com'], ['Amazon', 'amazon.com'], ['Meta', 'meta.com'], ['Microsoft', 'microsoft.com'],
  ['Uber', 'uber.com'], ['Netflix', 'netflix.com'], ['Atlassian', 'atlassian.com'],
]
const logoUrl = domain => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

export default function HomePage() {
  const features = useFeatures()
  const [stats, setStats] = useState(null)
  const [companies, setCompanies] = useState([])
  useEffect(() => { fetchStats().then(setStats).catch(() => {}); fetchCompanies().then(setCompanies).catch(() => {}) }, [])
  useEffect(() => { setDefaultSeo(stats?.total) }, [stats?.total])

  // Arriving from the footer link on another page (/#feedback): the section only exists after the first render.
  useEffect(() => { if (window.location.hash === '#feedback') { setTimeout(focusFeedback, 150); setTimeout(focusFeedback, 900) } }, [])

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
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <section className="text-center">
          {/* Who prepares here: the logos double as a hint of what the roadmaps cover. */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 py-1 pl-1.5 pr-3 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            <span className="flex -space-x-1.5">
              {HERO_COMPANIES.slice(0, 5).map(([name, domain]) => (
                <img key={name} src={logoUrl(domain)} alt="" className="h-5 w-5 rounded-full bg-white p-0.5 ring-2 ring-white dark:ring-slate-800" />
              ))}
            </span>
            Prep built from real FAANG &amp; top-tech interview loops
          </div>

          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl dark:text-slate-100">
            Crack your{' '}
            <span key={heroName} className="hero-word inline-block bg-gradient-to-r from-blue-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-fuchsia-400 dark:to-pink-400">
              {heroName}
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
            <a href="/roadmaps" className="w-full rounded-xl border border-slate-300 bg-white px-7 py-3.5 font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              See company roadmaps
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No credit card. Free topics open without an account.</p>

          {/* Proof strip: only shows numbers we actually have. */}
          {stats?.total > 0 && (
            <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-3 divide-x divide-slate-200 rounded-2xl bg-white/70 py-4 shadow-sm dark:divide-slate-700 dark:bg-slate-800/50">
              {[
                [`${stats.total.toLocaleString()}+`, 'interview questions'],
                [topics.length, 'topics covered'],
                [companies.length ? `${companies.length}+` : HERO_COMPANIES.length, companies.length ? 'companies tagged' : 'company roadmaps'],
              ].map(([value, label]) => (
                <div key={label} className="px-2">
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">{value}</dd>
                  <dd className="text-xs text-slate-500 dark:text-slate-400">{label}</dd>
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

        {topics.length > 0 && (
          <section className="mt-12" aria-labelledby="topics">
            <h2 id="topics" className="mb-4 text-xl font-bold text-slate-900 dark:text-slate-100">Browse by topic</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {topics.map(([tech, count]) => (
                <a key={tech} href={`/questions?tech=${encodeURIComponent(tech)}`} className="rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${techBadge(tech)}`}>{techLabel(tech)}</span>
                  <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{count.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">questions</p>
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

        {companies.length > 0 && features.code_practice !== false && (
          <section className="mt-12" aria-labelledby="companies">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 id="companies" className="text-xl font-bold text-slate-900 dark:text-slate-100">Coding problems by company</h2>
              <a href="/problems" className="text-sm text-blue-600 hover:underline dark:text-blue-400">All problems →</a>
            </div>
            <div className="flex flex-wrap gap-2">
              {companies.slice(0, 24).map(c => (
                <a key={c.name} href={`/problems?company=${encodeURIComponent(c.name)}`} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:shadow-md dark:bg-slate-950 dark:text-slate-100">
                  {c.name} <span className="text-slate-400">{c.count}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 grid gap-3 sm:grid-cols-2" aria-label="More ways to prepare">
          {LINKS.filter(l => !l.flag || features[l.flag] !== false).map(l => (
            <a key={l.href} href={l.href} className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md dark:bg-slate-950">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{l.title} →</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{l.text}</p>
            </a>
          ))}
        </section>
        <section id="feedback" className="mt-12 scroll-mt-20" aria-labelledby="fb">
          <h2 id="fb" className="mb-1 text-center text-xl font-bold text-slate-900 dark:text-slate-100">Feedback</h2>
          <p className="mb-4 text-center text-sm text-slate-600 dark:text-slate-400">Tell us what to improve. We read every message.</p>
          <FeedbackForm />
        </section>
      </main>
      <Footer />
    </div>
  )
}
