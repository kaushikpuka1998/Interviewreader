// Run: node frontend/src/lib/data.test.mjs  (checks the JSON files that get pushed or applied on deploy)
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const url = (p) => new URL(p, import.meta.url)
const read = (p) => JSON.parse(readFileSync(url(p), 'utf8'))

// AWS question bulk files: required fields, unique ids and titles, valid difficulty
// scripts/ is git-ignored, so these files exist only on the author's machine; skip when absent (CI)
const awsFiles = ['../../../scripts/aws-questions.json', '../../../scripts/aws-questions-2.json'].filter(p => existsSync(url(p)))
const aws = awsFiles.flatMap(read)
const ids = new Set(), titles = new Set()
for (const q of aws) {
  assert.equal(q.tech, 'aws', q.id)
  assert.ok(q.title && q.question && q.answer && q.category, `missing field in ${q.id}`)
  assert.ok(['Basic', 'Intermediate', 'Advanced'].includes(q.difficulty), `bad difficulty in ${q.id}`)
  assert.ok(!ids.has(q.id) && !titles.has(q.title), `duplicate ${q.id}`)
  ids.add(q.id); titles.add(q.title)
}
if (awsFiles.length === 2) assert.equal(aws.length, 148)

// Topic delta: every entry changes something and keeps the topics already there (after the two renames)
const delta = read('../../../backend/src/main/resources/problem-topics-delta.json')
const rename = { Graph: 'Graph Theory', Heap: 'Heap (Priority Queue)' }
for (const [title, { from, to }] of Object.entries(delta)) {
  assert.notEqual(from, to, title)
  const next = new Set(to.split(','))
  for (const f of from.split(',')) assert.ok(next.has(rename[f] || f), `${title} lost ${f}`)
}
console.log('data tests passed')
