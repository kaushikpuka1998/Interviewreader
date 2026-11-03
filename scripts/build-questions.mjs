// Builds frontend/src/data/questions.json from java/ and react/ markdown files.
// Run with: node scripts/build-questions.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'frontend', 'public')
fs.mkdirSync(outDir, { recursive: true })

const TOPICS = {
  java: [
    ['01-core-java-oops.md', 'Core Java & OOP'],
    ['02-collections-framework.md', 'Collections & Generics'],
    ['03-multithreading-concurrency.md', 'Multithreading & Concurrency'],
    ['04-java8-to-21-features.md', 'Java 8-21 Features'],
    ['05-jvm-memory-gc.md', 'JVM Architecture & GC'],
    ['06-spring-framework.md', 'Spring Framework & Microservices'],
    ['07-jpa-hibernate-db.md', 'JPA, Hibernate & Security'],
    ['08-streams-lambda.md', 'Java Streams & Lambdas'],
    ['09-java8-functional.md', 'Java 8 Functional Programming'],
    ['10-junit-mockito-testing.md', 'JUnit & Mockito Testing'],
  ],
  hld: [
    ['01-fundamentals.md', 'HLD Fundamentals'],
    ['02-easy-design-problems.md', 'Easy Design Problems'],
    ['03-core-distributed-systems.md', 'Core Distributed Systems'],
    ['04-database-storage.md', 'Database & Storage'],
    ['05-kafka-event-driven.md', 'Kafka & Event-Driven'],
    ['06-major-product-systems.md', 'Major Product Systems'],
    ['07-fintech-payments.md', 'Fintech & Payments'],
    ['08-advanced-distributed-systems.md', 'Advanced Distributed Systems'],
    ['09-realtime-high-scale.md', 'Realtime & High Scale'],
    ['10-expert-complex-systems.md', 'Expert & Complex Systems'],
    ['11-followup-questions.md', 'Interview Follow-Up Questions'],
  ],
  react: [
    ['01-react-basics-jsx.md', 'React Basics & JSX'],
    ['02-state-props-lifecycle.md', 'State, Props & Lifecycle'],
    ['03-react-hooks-in-depth.md', 'React Hooks Deep Dive'],
    ['04-performance-optimization.md', 'Performance & Optimization'],
    ['05-state-management-ecosystem.md', 'State Management & Ecosystem'],
    ['06-routing-forms-testing.md', 'Routing, Forms & Testing'],
    ['07-advanced-patterns-nextjs.md', 'Advanced Patterns & Next.js'],
  ],
  node: [
    ['01-node-fundamentals.md', 'Node.js Fundamentals'],
    ['02-modules-npm.md', 'Modules & npm'],
    ['03-event-loop-async.md', 'Event Loop & Async'],
    ['04-streams-buffers-events.md', 'Streams, Buffers & Events'],
    ['05-filesystem-process-os.md', 'File System, Process & OS'],
    ['06-http-networking.md', 'HTTP & Networking'],
    ['07-express-rest-apis.md', 'Express & REST APIs'],
    ['08-databases-orm.md', 'Databases & ORMs'],
    ['09-security-authentication.md', 'Security & Authentication'],
    ['10-performance-testing-deploy.md', 'Performance, Testing & Deployment'],
  ],
  microservices: [
    ['01-communication-data-patterns.md', 'Communication & Data Patterns'],
    ['02-infra-observability-realworld.md', 'Infrastructure, Observability & Real-World'],
    ['03-per-stack-microservices.md', 'Per-Stack (Java/Node/SQL/React)'],
    ['04-realtime-communication.md', 'Real-Time Communication (Polling/WebSocket/WebRTC)'],
  ],
  kafka: [
    ['01-kafka-deep-dive.md', 'Apache Kafka Deep Dive'],
    ['02-producers.md', 'Kafka Producers'],
    ['03-consumers-offsets.md', 'Kafka Consumers & Offsets'],
    ['04-consumer-groups-rebalancing.md', 'Consumer Groups & Rebalancing'],
    ['05-replication-reliability.md', 'Replication & Reliability'],
    ['06-delivery-semantics-transactions.md', 'Delivery Semantics & Transactions'],
    ['07-internals-storage.md', 'Kafka Internals & Storage'],
    ['08-performance-tuning.md', 'Performance & Tuning'],
    ['09-connect-streams-schema.md', 'Kafka Connect, Streams & Schema'],
    ['10-production-system-design-security.md', 'Production, System Design & Security'],
  ],
  'design-patterns': [
    ['01-creational-patterns.md', 'Creational Patterns'],
    ['02-structural-patterns.md', 'Structural Patterns'],
    ['03-behavioral-patterns.md', 'Behavioral Patterns'],
    ['04-solid-enterprise-patterns.md', 'SOLID & Enterprise Patterns'],
    ['05-distributed-architecture-patterns.md', 'Distributed & Architecture Patterns'],
  ],
  sql: [
    ['01-basics-select.md', 'SQL Basics & SELECT'],
    ['02-joins.md', 'Joins'],
    ['03-aggregation-grouping.md', 'Aggregation & Grouping'],
    ['04-subqueries-cte-windows.md', 'Subqueries, CTEs & Window Functions'],
    ['05-advanced-scenarios.md', 'Advanced Query Scenarios'],
  ],
}

function parseFile(relPath, tech) {
  const file = path.join(root, tech, relPath)
  if (!fs.existsSync(file)) {
    console.warn(`MISSING: ${file}`)
    return []
  }
  const raw = fs.readFileSync(file, 'utf-8')
  const lines = raw.split('\n')
  const questions = []
  let cur = null
  let section = null
  let inFence = false   // true while inside a ``` code fence

  const pushCur = () => {
    if (cur && cur.answer) {
      cur.tech = tech
      questions.push(cur)
    }
    cur = null
    inFence = false
  }

  for (const line of lines) {
    const qMatch = line.match(/^###\s+Q(\d+)\.\s+(.*)$/)
    if (qMatch) {
      pushCur()
      cur = {
        id: Number(qMatch[1]),
        number: Number(qMatch[1]),
        title: qMatch[2].trim(),
        question: qMatch[2].trim(),
        difficulty: 'Basic',
        category: '',
        answer: '',
        code: '',
        codeLang: '',
      }
      continue
    }
    if (!cur) continue

    // Inside a code fence, capture verbatim — don't interpret #, ---, etc.
    if (section === 'code' && line.trim().startsWith('```')) {
      inFence = !inFence
      cur.code += line + '\n'
      continue
    }
    if (inFence) {
      cur.code += line + '\n'
      continue
    }

    if (/^\*\*Difficulty:\*\*/i.test(line)) {
      const m = line.match(/`(\w+)`/)
      if (m) cur.difficulty = m[1]
      continue
    }
    if (/^\*\*Category:\*\*/i.test(line)) {
      const m = line.match(/^\*\*Category:\*\*\s*(.*)$/i)
      if (m) cur.category = m[1].trim().replace(/`/g, '')
      continue
    }
    if (/^####\s+Answer/i.test(line)) {
      section = 'answer'
      continue
    }
    if (/^####\s+Code Example/i.test(line)) {
      section = 'code'
      continue
    }
    if (/^---+\s*$/.test(line)) {
      section = null
      continue
    }
    if (/^#{1,4}\s/.test(line) && !/^####\s/.test(line)) {
      // a new heading that isn't answer/code marks end of code section
      if (section === 'code') section = null
      continue
    }

    if (section === 'answer') {
      cur.answer += line + '\n'
    } else if (section === 'code') {
      // Verbatim markdown (fences captured above); supports multiple blocks
      cur.code = (cur.code || '') + line + '\n'
    }
  }
  pushCur()

  // Finalize
  for (const q of questions) {
    q.answer = q.answer.replace(/```[ \t]+text[ \t]*(\r?\n|$)/g, '```text$1').trim()
    if (q.code) q.code = q.code.replace(/```[ \t]+text[ \t]*(\r?\n|$)/g, '```text$1').trim()
  }
  return questions
}

const all = []
for (const [tech, topics] of Object.entries(TOPICS)) {
  for (const [file] of topics) {
    all.push(...parseFile(file, tech))
  }
}

// Assign unique IDs: tech + number, and keep original number for display
let uniqueId = 1
for (const q of all) {
  q.id = `${q.tech}-${uniqueId}` // globally unique: files restart Q-numbering, so tech-number collides
  q.displayNumber = q.number
  q.sortKey = uniqueId++
}

// Sort by sortKey (which preserves file order)
all.sort((a, b) => a.sortKey - b.sortKey)
const merged = all

// Append the verbatim code section (already fenced markdown) to the answer
for (const q of merged) {
  if (q.code) {
    q.answer = (q.answer ? q.answer + '\n\n' : '') + q.code
  }
  delete q.code
  delete q.codeLang
}

const json = JSON.stringify(merged, null, 2)
fs.writeFileSync(path.join(outDir, 'questions.json'), json)

// Also bundle into the backend jar (classpath) so prod seeding works without the frontend dir on disk.
const backendDir = path.join(root, 'backend', 'src', 'main', 'resources')
if (fs.existsSync(backendDir)) {
  fs.writeFileSync(path.join(backendDir, 'questions.json'), json)
}

console.log(`Wrote ${merged.length} questions to frontend/public/ and backend/src/main/resources/`)