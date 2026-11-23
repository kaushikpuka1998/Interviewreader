import { useMemo, useState } from 'react'
import { groupHld } from '../lib/hldGroups.js'

/**
 * System design questions in collapsible groups (icon, name, done/total, chevron).
 * renderItem(x) draws one row; isDone(x) feeds the count; activeId opens the group holding the selected question;
 * forceOpen opens every group (used while searching).
 */
export default function HldGroupedList({ items, titleOf = x => x.title, renderItem, isDone = () => false, activeId, idOf = x => x.id, forceOpen = false, className = '' }) {
  const groups = useMemo(() => groupHld(items, titleOf), [items, titleOf])
  const activeGroup = useMemo(() => groups.find(g => g.items.some(x => idOf(x) === activeId))?.name, [groups, activeId, idOf])
  const [open, setOpen] = useState(() => new Set(activeGroup ? [activeGroup] : []))
  const toggle = name => setOpen(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })
  return (
    <div className={className}>
      {groups.map(g => {
        const done = g.items.filter(isDone).length
        const isOpen = forceOpen || open.has(g.name)
        return (
          <section key={g.name} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
            <button type="button" onClick={() => toggle(g.name)} aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <svg className="h-6 w-6 shrink-0 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d={g.icon} /></svg>
              <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{g.name}</span>
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${done && done === g.items.length ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`} aria-hidden="true" />
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-500" aria-label={`${done} of ${g.items.length} done`}>{done}/{g.items.length}</span>
              <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
            </button>
            {isOpen && <ul className="space-y-0.5 pb-2 pl-3">{g.items.map(x => <li key={idOf(x)}>{renderItem(x)}</li>)}</ul>}
          </section>
        )
      })}
    </div>
  )
}
