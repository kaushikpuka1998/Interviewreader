import { useEffect, useState } from 'react'
import { searchRubrics, fetchRubric, saveRubric, resetRubric, testRubric, importInterviewBanks, importRubrics } from '../lib/designPractice.js'

// Admin: the rubrics behind solo system design practice. One line per concept: "Name: term | term | term".
// Any term counts; a term's last word matches as a stem when it's 5+ letters ("replicat" matches "replication").
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
const SOURCE_STYLE = {
  manual: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  auto: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  none: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

const toLines = concepts => concepts.map(c => `${c.name}: ${c.terms.join(' | ')}`).join('\n')
const fromLines = text => text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const i = l.indexOf(':')
  const name = (i > 0 ? l.slice(0, i) : l).trim()
  const terms = (i > 0 ? l.slice(i + 1) : l).split('|').map(t => t.trim()).filter(Boolean)
  return { name, terms: terms.length ? terms : [name] }
})

// Upload the private JSON files (interview banks, hand-written rubrics) that are kept out of the public repository.
// The kind of each file is recognised from its content: banks have "ask"/"push", rubrics have stage lists.
function PrivateImport({ onDone }) {
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState([])
  const upload = async files => {
    setBusy(true)
    const out = []
    for (const file of files) {
      try {
        const data = JSON.parse(await file.text())
        const first = Object.entries(data).find(([k]) => !k.startsWith('_'))?.[1] || {}
        const isBank = 'ask' in first || 'push' in first
        const r = isBank ? await importInterviewBanks(data) : await importRubrics(data, overwrite)
        out.push({ ok: !(r.invalid?.length), text: `${file.name}: ${isBank ? 'banks' : 'rubrics'} stored ${r.stored}${r.kept ? `, kept ${r.kept} existing` : ''}${r.unknown?.length ? `, ${r.unknown.length} unknown ids (${r.unknown.slice(0, 3).join(', ')})` : ''}${r.invalid?.length ? `, ${r.invalid.length} invalid: ${r.invalid.slice(0, 2).join('; ')}` : ''}` })
      } catch (e) {
        out.push({ ok: false, text: `${file.name}: ${e.message}` })
      }
    }
    setLines(out)
    setBusy(false)
    onDone?.()
  }
  return (
    <details className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">Import private files (interview banks, hand-written rubrics)</summary>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">These files are not in the public repository. Upload the JSON from your private-data folder; you can select several at once. Banks always replace a question's bank; rubrics only fill questions that have none, unless you tick overwrite.</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input type="file" accept="application/json,.json" multiple disabled={busy} onChange={e => e.target.files.length && upload([...e.target.files])} className="text-xs" />
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} /> Overwrite existing rubrics (loses Admin edits)
        </label>
        {busy && <span className="text-xs text-slate-500">Importing…</span>}
      </div>
      {lines.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {lines.map((l, i) => <li key={i} className={l.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{l.ok ? '✓' : '✗'} {l.text}</li>)}
        </ul>
      )}
    </details>
  )
}

export default function DesignRubricsAdmin() {
  const [q, setQ] = useState('')
  const [list, setList] = useState([])
  const [selected, setSelected] = useState(null)   // { id, title }
  const [stages, setStages] = useState(null)       // [{ key, label, weight, text }]
  const [source, setSource] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sample, setSample] = useState('')
  const [test, setTest] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => searchRubrics(q).then(setList).catch(e => setMsg({ ok: false, text: e.message })), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q])

  const load = data => {
    setSource(data.rubric.source)
    setStages(data.rubric.stages.map(s => ({ key: s.key, label: s.label, weight: s.weight, text: toLines(s.concepts) })))
  }
  const open = async item => {
    setSelected(item); setMsg(null); setTest(null)
    try { load(await fetchRubric(item.id)) } catch (e) { setMsg({ ok: false, text: e.message }) }
  }
  const run = async (fn, okText) => {
    setBusy(true); setMsg(null)
    try { await fn(); if (okText) setMsg({ ok: true, text: okText }); searchRubrics(q).then(setList).catch(() => {}) }
    catch (e) { setMsg({ ok: false, text: e.message }) }
    finally { setBusy(false) }
  }
  const rubric = () => ({
    source: 'manual',
    stages: stages.map(s => ({ key: s.key, label: s.label.trim(), weight: Number(s.weight), concepts: fromLines(s.text) })),
  })
  const setStage = (i, field, value) => setStages(st => st.map((s, j) => (j === i ? { ...s, [field]: value } : s)))

  return (
    <div className="space-y-4">
    <PrivateImport onDone={() => searchRubrics(q).then(setList).catch(() => {})} />
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <div className="space-y-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search design questions…" className={input} />
        <p className="text-xs text-slate-500 dark:text-slate-400">{list.length} design questions · <span className="font-semibold">manual</span> = hand-written or edited, <span className="font-semibold">auto</span> = drafted from the model answer, <span className="font-semibold">none</span> = drafted on first use.</p>
        <ul className="max-h-[36rem] divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {list.map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => open(item)} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${selected?.id === item.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                <span className="min-w-0 truncate text-slate-800 dark:text-slate-200">{item.title}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_STYLE[item.source] || SOURCE_STYLE.none}`}>{item.source}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        {!selected ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">Pick a question to review or edit what its practice answers are scored on.</p>
        ) : !stages ? <p className="text-sm text-slate-500">Loading…</p> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selected.title}</h2>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${SOURCE_STYLE[source] || ''}`}>{source}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">One concept per line: <code>Name: term | term | term</code>. A stage earns full marks when about 60% of its concepts are covered. Weights set how much each stage counts.</p>
            {stages.map((s, i) => (
              <div key={s.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center gap-2">
                  <input value={s.label} onChange={e => setStage(i, 'label', e.target.value)} aria-label="Stage name" className={`${input} font-semibold`} />
                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">weight
                    <input type="number" min="0.5" max="10" step="0.5" value={s.weight} onChange={e => setStage(i, 'weight', e.target.value)} className={`${input} w-20`} />
                  </label>
                </div>
                <textarea value={s.text} onChange={e => setStage(i, 'text', e.target.value)} rows={Math.max(3, s.text.split('\n').length)} className={`${input} font-mono text-xs`} />
              </div>
            ))}
            {msg && <p className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => run(async () => { const r = await saveRubric(selected.id, rubric()); load(r) }, 'Rubric saved. New attempts are scored with it.')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save rubric</button>
              <button type="button" disabled={busy} onClick={() => { if (window.confirm('Discard edits and go back to the hand-written or auto-drafted rubric?')) run(async () => load(await resetRubric(selected.id)), 'Rubric reset.') }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20">Reset to default</button>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Test score</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Paste a sample answer to see how the <em>saved</em> rubric scores it. Doesn't use anyone's attempts.</p>
              <textarea value={sample} onChange={e => setSample(e.target.value)} rows={5} className={input} placeholder="A sample answer…" />
              <button type="button" disabled={busy || !sample.trim()} onClick={() => run(async () => setTest(await testRubric(selected.id, sample)))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-600 dark:text-slate-200">Score it</button>
              {test && (
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <p className="font-semibold">{test.score.toFixed(1)} / 10 · {test.words} words</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {test.stages.map(s => <li key={s.key}>{s.label}: {Math.round(s.score * 100)}%{s.missed.length ? ` · missed ${s.missed.join(', ')}` : ''}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </div>
  )
}
