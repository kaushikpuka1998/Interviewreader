// Run: node frontend/src/lib/interviewer.test.mjs
import assert from 'node:assert/strict'
import { planNext, newPlanState, systemName, reaction, techsIn } from './interviewer.js'

assert.equal(systemName('Design an SMS sending service.'), 'the SMS sending service')
assert.equal(systemName('Design a URL shortener (like bit.ly).'), 'the URL shortener')
assert.equal(systemName('Design Twitter/X.'), 'Twitter/X')
assert.deepEqual(techsIn('Redis in front of Cassandra').map(t => t.tech), ['Redis', 'Cassandra'])
assert.equal(reaction('moderate', 'we shard by user id', ['Okay.']), 'Okay.')   // generic words are not echoed back

// A whole Hard interview where nothing improves: every question is different, starts with a capital, and it ends.
const stages = ['requirements', 'estimation', 'api', 'highlevel', 'scaling', 'reliability', 'tradeoffs']
  .map(key => ({ key, label: key, score: 0, missed: 'monitoring' }))
const state = newPlanState(), seen = new Set()
for (;;) {
  const next = planNext({ style: 'hard', persona: { threshold: 0.75, perStage: 3, maxFollowUps: 14 }, stages, system: 'Twitter/X',
    lastReply: 'Redis and Kafka with Cassandra', challenges: ['celebrity problem', 'retries + DLQ'], state })
  if (!next) break
  assert.ok(!seen.has(next.text), `repeated: ${next.text}`)
  assert.match(next.text, /^[A-Z]/)
  assert.doesNotMatch(next.text, /\+/)
  seen.add(next.text)
}
assert.ok(seen.size >= 10 && seen.size <= 14, `asked ${seen.size}`)
console.log(`interviewer planner OK (${seen.size} distinct questions)`)
