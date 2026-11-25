import { useEffect, useMemo, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import Loader from './Loader.jsx'
import NotFound from './NotFound.jsx'
import { setPageSeo } from '../lib/seo.js'
import { NORMS, SORTS, fetchSalaries, lpa, pick, rangeText, similar, spanOf } from '../lib/salaries.js'

// The company's favicon, guessed from its name (amazon -> amazon.com). A guess that misses, or the placeholder globe, falls back to a coloured initial.
function CompanyLogo({ name, slug, size = 'h-11 w-11' }) {
  const [bad, setBad] = useState(false)
  const hue = [...slug].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7)
  return (
    <span className={`${size} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 dark:ring-slate-700`} style={{ backgroundColor: `hsl(${hue} 70% 92%)` }} aria-hidden="true">
      <span className="text-base font-extrabold" style={{ color: `hsl(${hue} 55% 30%)` }}>{name.trim().charAt(0).toUpperCase()}</span>
      {!bad && <img src={`https://www.google.com/s2/favicons?domain=${slug.replace(/-/g, '')}.com&sz=64`} alt="" loading="lazy" referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full bg-white object-contain p-1.5" onLoad={e => { if (e.target.naturalWidth < 32) setBad(true) }} onError={() => setBad(true)} />}
    </span>
  )
}

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950'
const chip = on => `rounded-full px-3 py-1.5 text-sm font-semibold transition ${on ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'}`
const PAGE = 48

// Software engineer pay in India: every company with its levels. "/salaries" lists and filters them; "/salaries/<company>" shows one company.
export default function SalariesPage({ slug }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => { fetchSalaries().then(setData).catch(() => setError(true)) }, [])
  const company = slug && data ? data.companies.find(c => c.slug === slug) : null

  useEffect(() => {
    if (!data) return
    if (slug) {
      if (!company) return
      const s = spanOf(company)
      setPageSeo({ title: `${company.name} Software Engineer Salary in India by Level`, path: `/salaries/${slug}`,
        description: `${company.name} software engineer salaries in India by level: median total pay ${rangeText(s.min, s.max)} across ${s.count} level${s.count > 1 ? 's' : ''}, with the experience each level usually needs.` })
    } else {
      setPageSeo({ title: 'Software Engineer Salaries in India by Company and Level', path: '/salaries',
        description: `Median total pay for software engineers in India at ${data.companies.length} companies, by level: SDE-1 to Staff and Principal. Search a company and compare.` })
    }
  }, [data, slug, company])

  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-slate-100 p-4 dark:bg-slate-900 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          {error && <NotFound title="Salaries are not available" message="Please try again in a moment." />}
          {!data && !error && <Loader label="Loading salaries…" />}
          {data && data.companies.length > 0 && slug && (company ? <CompanyView company={company} all={data.companies} /> : <NotFound title="Company not found" message="We have no salary data for this company." />)}
          {data && !data.companies.length && <NotFound title="Salaries are loading" message="The salary data is still being prepared. Refresh in a moment." />}
          {data && data.companies.length > 0 && !slug && <Index data={data} />}
        </div>
      </div>
      <Footer />
    </>
  )
}

function Index({ data }) {
  const [q, setQ] = useState('')
  const [segment, setSegment] = useState('')
  const [norm, setNorm] = useState('')
  const [sort, setSort] = useState('top')
  const [shown, setShown] = useState(PAGE)
  const rows = useMemo(() => pick(data.companies, { q, segment, norm, sort }), [data, q, segment, norm, sort])
  useEffect(() => setShown(PAGE), [q, segment, norm, sort])
  return (
    <>
      <header className={card}>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-600 dark:text-emerald-400">Salaries</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">Software engineer salaries in India</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Median total pay per year (base, stock and bonus) at {data.companies.length} companies, with the pay of every level from entry to staff and principal.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a company" aria-label="Search a company"
            className="min-w-[14rem] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Level">
          <button type="button" className={chip(!norm)} onClick={() => setNorm('')}>All levels</button>
          {NORMS.map(n => <button key={n} type="button" className={chip(norm === n)} onClick={() => setNorm(n)}>{n}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Type of company">
          <button type="button" className={chip(!segment)} onClick={() => setSegment('')}>All companies</button>
          {data.segments.map(s => <button key={s} type="button" className={chip(segment === s)} onClick={() => setSegment(s)}>{s}</button>)}
        </div>
      </header>

      <p className="px-1 text-sm text-slate-500">{rows.length} compan{rows.length === 1 ? 'y' : 'ies'}{norm ? ` with an ${norm} level` : ''}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.slice(0, shown).map(({ company: c, span }) => (
          <a key={c.slug} href={`/salaries/${c.slug}`} className={`${card} group transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md`}>
            <div className="flex items-center gap-3">
              <CompanyLogo name={c.name} slug={c.slug} />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900 group-hover:text-emerald-600 dark:text-white">{c.name}</p>
                <p className="truncate text-xs text-slate-500">{c.segment || 'Software company'}</p>
              </div>
            </div>
            <p className="mt-3 text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{rangeText(span.min, span.max)}</p>
            <p className="mt-0.5 text-xs text-slate-500">{norm ? norm : `${span.count} level${span.count > 1 ? 's' : ''}`}{!norm && c.median ? ` · median ${lpa(c.median)}` : ''}</p>
          </a>
        ))}
      </div>
      {rows.length === 0 && <div className={`${card} text-center text-sm text-slate-500`}>No company matches. Try another search or clear a filter.</div>}
      {shown < rows.length && <div className="text-center"><button type="button" onClick={() => setShown(s => s + PAGE)} className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">Show more companies</button></div>}
    </>
  )
}

function CompanyView({ company, all }) {
  const [pickLevel, setPickLevel] = useState('')
  const span = spanOf(company)
  const chosen = company.levels.find(l => l.level === pickLevel)
  const top = span.maxInr
  const lowest = company.levels[0], highest = company.levels[company.levels.length - 1]
  const near = useMemo(() => similar(all, company), [all, company])
  return (
    <>
      <nav className="text-sm"><a href="/salaries" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">← All company salaries</a></nav>
      <header className={card}>
        <div className="flex items-center gap-4">
          <CompanyLogo name={company.name} slug={company.slug} size="h-14 w-14" />
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">{company.name} software engineer salaries in India</h1>
            <p className="mt-1 text-sm text-slate-500">{company.segment || 'Software company'} · median total pay per year (base, stock and bonus)</p>
          </div>
        </div>
        {company.levels.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Level">
            <button type="button" className={chip(!pickLevel)} onClick={() => setPickLevel('')}>All levels</button>
            {company.levels.map(l => <button key={l.level} type="button" className={chip(pickLevel === l.level)} onClick={() => setPickLevel(l.level)}>{l.level}</button>)}
          </div>
        )}
      </header>

      <section className={`${card} text-center`} aria-live="polite">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">{chosen ? `Typical pay at ${chosen.level}` : span.count > 1 ? 'Pay across levels' : 'Typical pay'}</p>
        <p className="mt-2 text-4xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300 sm:text-5xl">{chosen ? lpa(chosen.lpa) : rangeText(span.min, span.max)}</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {chosen ? [chosen.norm && `${chosen.norm} equivalent`, chosen.yoe && `usually ${chosen.yoe} of experience`].filter(Boolean).join(' · ') || 'Median total pay per year'
            : `${span.count} level${span.count > 1 ? 's' : ''}, from ${lowest.level} to ${highest.level}`}
        </p>
      </section>

      {company.levels.length > 1 && (
        <section className="grid gap-3 sm:grid-cols-3">
          {[['Lowest level', lowest.level, lowest.lpa], ['Company median', 'across levels', company.median], ['Highest level', highest.level, highest.lpa]].filter(t => t[2]).map(([label, sub, v]) => (
            <div key={label} className={`${card} text-center`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{lpa(v)}</p>
              <p className="text-xs text-slate-500">{sub}</p>
            </div>
          ))}
        </section>
      )}

      <section className={card}>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Pay by level at {company.name}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Level</th><th className="pr-3">Equivalent</th><th className="pr-3">Experience</th><th className="w-2/5">Median total pay</th></tr></thead>
            <tbody>
              {company.levels.map(l => (
                <tr key={l.level} className={`border-t border-slate-100 dark:border-slate-800 ${l.level === pickLevel ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
                  <td className="py-2.5 pr-3 font-bold text-slate-900 dark:text-white">{l.level}</td>
                  <td className="pr-3 text-slate-600 dark:text-slate-400">{l.norm || '–'}</td>
                  <td className="pr-3 text-slate-600 dark:text-slate-400">{l.yoe || '–'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (l.inr / top) * 100)}%` }} /></div>
                      <span className="w-24 shrink-0 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{lpa(l.lpa)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Medians of reported total pay for software engineers in India. Individual offers vary with skills, location and negotiation.</p>
      </section>

      <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div><p className="font-bold text-slate-900 dark:text-white">Have an offer from {company.name}?</p><p className="text-sm text-slate-600 dark:text-slate-400">Share it anonymously in the compensation discussions and help others.</p></div>
        <a href="/discuss" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Share your offer</a>
      </section>

      {near.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[.14em] text-slate-500">Similar companies</h2>
          <div className="flex flex-wrap gap-2">
            {near.map(c => { const s = spanOf(c); return <a key={c.slug} href={`/salaries/${c.slug}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:ring-emerald-400 dark:bg-slate-950 dark:ring-slate-800"><CompanyLogo name={c.name} slug={c.slug} size="h-6 w-6" /><b className="text-slate-900 dark:text-white">{c.name}</b> <span className="text-slate-500">{rangeText(s.min, s.max)}</span></a> })}
          </div>
        </section>
      )}
    </>
  )
}
