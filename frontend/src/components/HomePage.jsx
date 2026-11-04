import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

// Light-mode tile colours per topic: a tinted face, a matching border and a thicker coloured top edge, so the tiles read clearly
// against the white page. (Dark mode keeps its plain dark tiles.)
const TILE = {
  java: 'border-orange-200 border-t-orange-500 bg-orange-50 hover:border-orange-400 hover:border-t-orange-600 hover:bg-orange-100',
  react: 'border-cyan-200 border-t-cyan-500 bg-cyan-50 hover:border-cyan-400 hover:border-t-cyan-600 hover:bg-cyan-100',
  node: 'border-green-200 border-t-green-600 bg-green-50 hover:border-green-400 hover:border-t-green-600 hover:bg-green-100',
  sql: 'border-purple-200 border-t-purple-500 bg-purple-50 hover:border-purple-400 hover:border-t-purple-600 hover:bg-purple-100',
  hld: 'border-teal-200 border-t-teal-600 bg-teal-50 hover:border-teal-400 hover:border-t-teal-600 hover:bg-teal-100',
  golang: 'border-sky-200 border-t-sky-500 bg-sky-50 hover:border-sky-400 hover:border-t-sky-600 hover:bg-sky-100',
  kafka: 'border-slate-300 border-t-slate-600 bg-slate-100 hover:border-slate-400 hover:border-t-slate-600 hover:bg-slate-100',
  microservices: 'border-rose-200 border-t-rose-500 bg-rose-50 hover:border-rose-400 hover:border-t-rose-600 hover:bg-rose-100',
  'design-patterns': 'border-amber-200 border-t-amber-500 bg-amber-50 hover:border-amber-400 hover:border-t-amber-600 hover:bg-amber-100',
  misc: 'border-emerald-200 border-t-emerald-600 bg-emerald-50 hover:border-emerald-400 hover:border-t-emerald-600 hover:bg-emerald-100',
  angular: 'border-red-200 border-t-red-500 bg-red-50 hover:border-red-400 hover:border-t-red-600 hover:bg-red-100',
  rails: 'border-pink-200 border-t-pink-500 bg-pink-50 hover:border-pink-400 hover:border-t-pink-600 hover:bg-pink-100',
  behavioral: 'border-emerald-200 border-t-emerald-500 bg-emerald-50 hover:border-emerald-400 hover:border-t-emerald-600 hover:bg-emerald-100',
}
const TILE_DEFAULT = 'border-slate-200 border-t-slate-400 bg-slate-50 hover:border-slate-400 hover:border-t-slate-600 hover:bg-slate-100'
// Tiles are laid out as a centred, wrapping row (not a rigid grid): with 13 topics a grid always strands one tile alone at the left
// of the last row; this keeps every tile the same size and centres the short last row. The widths are 1/2, 1/3 or 1/4 minus the gap.
const TILE_BASIS = 'basis-[calc(50%-0.375rem)] sm:basis-[calc(33.333%-0.5rem)] lg:basis-[calc(25%-0.5625rem)]'

// Hero headline cycles through these, each with its logo (Google's favicon service, as on the roadmaps page).
const HERO_COMPANIES = [
  ['Google', 'google.com'], ['Amazon', 'amazon.com'], ['Meta', 'meta.com'], ['Microsoft', 'microsoft.com'],
  ['Uber', 'uber.com'], ['Netflix', 'netflix.com'], ['Atlassian', 'atlassian.com'], ['Apple', 'apple.com'], ['Walmart', 'walmart.com'],
]
// The headline word wears each company's own colours. `letters` = one colour per letter (Google), `gradient` = the logo's colours
// as a text gradient (Microsoft); otherwise a single colour, with a lighter `dark` shade where the brand colour would be too dim
// (or, for Uber, invisible) on the dark page.
const BRAND = {
  Google: { letters: ['#4285F4', '#EA4335', '#FBBC05', '#4285F4', '#34A853', '#EA4335'] },
  Amazon: { color: '#E88A00', dark: '#FF9900' },
  Meta: { color: '#0866FF', dark: '#4C9BFF' },
  Microsoft: { gradient: 'linear-gradient(90deg,#F25022 0%,#7FBA00 36%,#00A4EF 68%,#FFB900 100%)' },
  Uber: { color: '#000000', dark: '#FFFFFF' },
  Netflix: { color: '#E50914', dark: '#FF2B38' },
  Atlassian: { color: '#0052CC', dark: '#4C9AFF' },
  Apple: { color: '#1D1D1F', dark: '#F5F5F7' },
  Walmart: { color: '#0071CE', dark: '#4DA3FF' },
}
const logoUrl = domain => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

// Inline colours for the headline word (see BRAND). Gradient words are clipped to the text; the rest set CSS variables that the
// light/dark classes read.
function brandStyle(name) {
  const b = BRAND[name]
  if (!b) return { '--brand': '#047857', '--brand-dark': '#34d399' }
  if (b.gradient) return { backgroundImage: b.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
  if (b.letters) return {}
  return { '--brand': b.color, '--brand-dark': b.dark || b.color }
}

// The headline, with the company name that rotates every 2.2 s. It owns its own state, so a tick re-renders only this heading and
// not the whole home page (topic tiles, company chips, link cards), which is what the page used to redo every 2.2 s.
function HeroHeadline() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    // A background tab doesn't need to animate, so it skips the tick.
    const t = setInterval(() => { if (!document.hidden) setIdx(i => (i + 1) % HERO_COMPANIES.length) }, 2200)
    return () => clearInterval(t)
  }, [])
  const heroName = HERO_COMPANIES[idx][0]
  // The word's box follows the word: narrow for "Meta", wide for "Microsoft", and the rest of the line glides to fit (width transition).
  // Measured from the word itself on each change, and again after the web font loads and when the window resizes.
  // The width goes straight onto the element (not through state), so a change costs one render of this heading instead of two.
  const word = useRef(null)
  const box = useRef(null)
  const measure = useCallback(() => { if (word.current && box.current) box.current.style.setProperty('--hero-w', `${word.current.offsetWidth}px`) }, [])
  useLayoutEffect(measure, [heroName, measure])
  useEffect(() => {
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])
  const brand = BRAND[heroName]
  return (
    <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl dark:text-slate-100">
      Crack your{' '}
      {/* The word's padding (cancelled by the negative margin) lets the clipped gradient paint the descender of a "g" instead of cutting it off.
          On a phone the word has its own line (always three lines, so the text below never jumps); from sm up it sits inline
          and its box grows or shrinks to the word. */}
      <span ref={box} className="block text-center sm:inline-flex sm:w-[var(--hero-w)] sm:justify-center sm:align-baseline sm:transition-[width] sm:duration-500 sm:ease-out motion-reduce:transition-none">
        <span ref={word} key={heroName} className="hero-word -mb-[0.2em] inline-block shrink-0 whitespace-nowrap pb-[0.2em] text-[color:var(--brand)] dark:text-[color:var(--brand-dark,var(--brand))]"
          style={brandStyle(heroName)}>
          {brand?.letters ? [...heroName].map((ch, i) => <span key={i} style={{ color: brand.letters[i % brand.letters.length] }}>{ch}</span>) : heroName}
        </span>
      </span>
      {' '}interview.
    </h1>
  )
}

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

  return (
    <div className="flex min-h-screen flex-col bg-white bg-[radial-gradient(70rem_28rem_at_50%_-8rem,#bfe9d6,transparent_70%),radial-gradient(40rem_24rem_at_100%_30rem,#d3efe2,transparent_70%)] dark:bg-slate-900 dark:bg-none">
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

          <HeroHeadline />

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
            <div className="flex flex-wrap justify-center gap-3">{Array.from({ length: 13 }, (_, i) => <div key={i} className={`h-[124px] animate-pulse rounded-2xl bg-emerald-50 dark:bg-slate-950 ${TILE_BASIS}`} />)}</div>
          </div>
        )}
        {topics.length > 0 && (
          <section className="mt-12" aria-labelledby="topics">
            <h2 id="topics" className="mb-4 flex items-center gap-2.5 text-xl font-bold text-slate-900 dark:text-slate-100"><span className="h-5 w-1 rounded-full bg-emerald-600 dark:hidden" aria-hidden="true" />Browse by topic</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {topics.map(([tech, count]) => (
                <a key={tech} href={`/questions?tech=${encodeURIComponent(tech)}`} className={`${TILE_BASIS} rounded-2xl border border-t-4 p-4 shadow-md shadow-slate-900/5 transition duration-200 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-slate-900/20 hover:ring-2 hover:ring-slate-900/5 ${TILE[tech] || TILE_DEFAULT} dark:border-0 dark:bg-slate-950 dark:shadow-sm dark:hover:translate-y-0 dark:hover:bg-slate-950 dark:hover:shadow-md dark:hover:ring-0`}>
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
              {/* grow: each row stretches to the full width, so the chips line up with the "All problems" link on the right */}
              {companies.slice(0, 24).map(c => (
                <a key={c.name} href={`/problems?company=${encodeURIComponent(c.name)}`} className="inline-flex grow items-center justify-center gap-2 rounded-full border border-emerald-300 bg-gradient-to-b from-white to-emerald-50 py-1.5 pl-4 pr-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700 hover:from-emerald-600 hover:to-emerald-700 hover:text-white hover:shadow-lg hover:shadow-emerald-900/25 cursor-pointer group dark:border-slate-700 dark:bg-slate-800/50 dark:bg-none dark:px-4 dark:py-2 dark:font-medium dark:text-slate-100 dark:shadow-none dark:hover:-translate-y-0.5 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-white dark:hover:shadow-lg dark:hover:shadow-slate-900/30 dark:text-center">
                  {c.name} <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold tabular-nums text-white transition-colors group-hover:bg-white group-hover:text-emerald-800 pointer-events-none dark:bg-slate-700 dark:p-1 dark:px-2 dark:text-xs dark:font-semibold dark:text-slate-300 dark:group-hover:bg-slate-600 dark:group-hover:text-slate-200">{c.count}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2" aria-label="More ways to prepare">
          {LINKS.filter(l => !l.flag || features[l.flag] !== false).map(l => (
            <a key={l.href} href={l.href}
              className={`group flex items-start gap-4 rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${l.featured
                ? 'border-orange-300 bg-gradient-to-r from-orange-50 via-amber-50 to-white shadow-md shadow-orange-900/5 hover:border-orange-500 hover:from-orange-100 hover:via-amber-100 hover:shadow-lg hover:shadow-orange-900/15 sm:col-span-2 sm:items-center sm:p-6 dark:border-orange-400/40 dark:from-orange-500/15 dark:via-amber-500/10 dark:to-transparent dark:shadow-sm dark:hover:border-orange-400/70 dark:hover:from-orange-500/15 dark:hover:via-amber-500/10'
                : 'border-slate-200 bg-white hover:border-emerald-600 hover:bg-emerald-50 hover:shadow-lg hover:shadow-emerald-900/15 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-400/60 dark:hover:bg-slate-950'}`}>
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
