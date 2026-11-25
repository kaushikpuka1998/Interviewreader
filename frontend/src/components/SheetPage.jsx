import { useEffect, useMemo, useState } from 'react'
import TopBar from './TopBar.jsx'
import { fetchCodingProblems } from '../lib/codingProblems.js'
import { fetchSolvedIds } from '../lib/code.js'
import { isLoggedIn } from '../lib/auth.js'
import { difficultyBadge } from '../lib/badges.js'
import { setPageSeo } from '../lib/seo.js'

const key = t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// A curated DSA sheet (Striver A2Z, Love Babbar). Problems we have as coding problems open in the practice editor;
// the rest are listed by name until they are added.
export default function SheetPage({ slug }) {
  const [sheet, setSheet] = useState(null)
  const [problems, setProblems] = useState([])
  const [solved, setSolved] = useState(() => new Set())
  const [error, setError] = useState('')
  const [onlyOurs, setOnlyOurs] = useState(false)
  const [open, setOpen] = useState(() => new Set())

  useEffect(() => {
    fetch(`/sheets/${slug}.json`).then(r => r.ok ? r.json() : Promise.reject(new Error('Sheet not found.'))).then(s => {
      setSheet(s)
      setPageSeo({ title: `${s.title} | InterviewReader`, description: `Work through the ${s.title} with problems you can run online.`, path: `/sheets/${slug}`, jsonLd: undefined })
    }).catch(e => setError(e.message))
    fetchCodingProblems().then(setProblems).catch(() => {})
    if (isLoggedIn()) fetchSolvedIds().then(ids => setSolved(new Set(ids))).catch(() => {})
  }, [slug])

  const byTitle = useMemo(() => new Map(problems.map(p => [key(p.title), p])), [problems])
  const find = p => byTitle.get(key(p.ours || p.title))

  const totals = useMemo(() => {
    if (!sheet) return { all: 0, ours: 0, done: 0 }
    let all = 0, ours = 0, done = 0
    for (const s of sheet.sections) for (const p of s.problems) {
      all++
      const f = find(p)
      if (f) { ours++; if (solved.has(f.id)) done++ }
    }
    return { all, ours, done }
  }, [sheet, byTitle, solved])

  const toggle = name => setOpen(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })

  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-slate-100 p-3 sm:p-4 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl">
          <a href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Home</a>
          {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {sheet && (
            <>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{sheet.title}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                By {sheet.by} · {totals.all} problems · {totals.ours} open here{isLoggedIn() ? ` · ${totals.done} solved` : ''}
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={onlyOurs} onChange={e => setOnlyOurs(e.target.checked)} /> Show only problems available here
              </label>
              <div className="mt-4 space-y-3">
                {sheet.sections.map(sec => {
                  const rows = sec.problems.map(p => ({ p, f: find(p) })).filter(r => !onlyOurs || r.f)
                  if (!rows.length) return null
                  const done = rows.filter(r => r.f && solved.has(r.f.id)).length
                  const avail = rows.filter(r => r.f).length
                  const isOpen = open.has(sec.name) || onlyOurs
                  return (
                    <section key={sec.name} className="overflow-hidden rounded-2xl bg-white dark:bg-slate-950">
                      <button type="button" onClick={() => toggle(sec.name)} aria-expanded={isOpen} className="flex w-full items-center justify-between px-4 py-3 text-left">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{sec.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{isLoggedIn() ? `${done}/` : ''}{avail} here · {rows.length} total {isOpen ? '▾' : '▸'}</span>
                      </button>
                      {isOpen && (
                        <ul className="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                          {rows.map(({ p, f }) => (
                            <li key={p.title + p.url} className="flex items-center gap-3 px-4 py-2 text-sm">
                              {f ? (
                                <a href={`/practice?id=${f.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
                                  {solved.has(f.id) && <span className="mr-1 text-emerald-600">✓</span>}{p.title}
                                </a>
                              ) : (
                                <span className="min-w-0 flex-1 truncate text-slate-400 dark:text-slate-500">{p.title}</span>
                              )}
                              {!f && <span className="shrink-0 text-[11px] text-slate-400">coming soon</span>}
                              {p.difficulty && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${difficultyBadge(f?.difficulty || (p.difficulty === 'Easy' ? 'Basic' : p.difficulty === 'Medium' ? 'Intermediate' : p.difficulty === 'Hard' ? 'Advanced' : p.difficulty))}`}>{f?.difficulty || p.difficulty}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
