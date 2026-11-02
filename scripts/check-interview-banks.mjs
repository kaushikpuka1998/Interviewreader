// Validates the voice interviewer's hand-written question banks: node scripts/check-interview-banks.mjs [ids-file]
// Every bank needs a scope, one question per stage, deep dives and well-formed pushbacks whose regexes compile.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The banks are private: kept in the git-ignored private-data/ folder and imported into the database from Admin.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../private-data/interview-banks')
const STAGES = ['requirements', 'estimation', 'api', 'highlevel', 'scaling', 'reliability', 'tradeoffs']
const banks = {}
const problems = []
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  let data
  try { data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch (e) { problems.push(`${f}: invalid JSON (${e.message})`); continue }
  for (const [id, b] of Object.entries(data)) {
    if (id.startsWith('_')) continue
    if (banks[id]) problems.push(`${id}: defined twice (${f})`)
    banks[id] = b
    const p = m => problems.push(`${id} (${f}): ${m}`)
    if (!b.scope || b.scope.length < 20) p('missing scope')
    for (const s of STAGES) if (!b.ask?.[s]?.length) p(`no ${s} question`)
    if (!(b.deep?.length >= 2)) p('fewer than 2 deep dives')
    if (!(b.push?.length >= 2)) p('fewer than 2 pushbacks')
    for (const [i, row] of (b.push || []).entries()) {
      if (!Array.isArray(row) || row.length !== 5 || row.some(x => typeof x !== 'string' || !x)) { p(`push ${i} needs 5 non-empty strings`); continue }
      for (const re of [row[0], row[2]]) { try { new RegExp(re, 'i') } catch (e) { p(`push ${i} bad regex ${re}: ${e.message}`) } }
      if (new RegExp(row[2], 'i').test('')) p(`push ${i} defence regex matches empty text`)
    }
    for (const q of [...STAGES.flatMap(s => b.ask?.[s] || []), ...(b.deep || []), ...(b.push || []).map(r => r[1])]) {
      if (!/[?.]$/.test(q.trim())) p(`question should end with ? or . : ${q.slice(0, 60)}`)
    }
  }
}
const idsFile = process.argv[2]
if (idsFile) {
  const want = fs.readFileSync(idsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  const missing = want.filter(id => !banks[id])
  console.log(`coverage: ${want.length - missing.length}/${want.length}${missing.length ? ` (next missing: ${missing.slice(0, 5).join(', ')})` : ''}`)
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
console.log(`interview banks OK: ${Object.keys(banks).length} designs`)
