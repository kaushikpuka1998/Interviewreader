// The voice interviewer's follow-up questions. No AI: questions come from banks of templates, filled with what is
// specific to this interview: the design's name, its rubric's missed points, its known challenges (from the model
// answer), the technologies the candidate just mentioned, and what-if scenarios. Each template is used at most once
// per interview, so two interviews (or two turns) rarely sound the same.

const pickFresh = (list, used, key) => {
  const fresh = list.map((t, i) => [t, `${key}#${i}`]).filter(([, id]) => !used.has(id))
  if (!fresh.length) return null
  const [t, id] = fresh[Math.floor(Math.random() * fresh.length)]
  used.add(id)
  return t
}
// Fills a template; the result starts with a capital letter even when it opens with a filled-in phrase.
const fill = (t, vars) => {
  const out = t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
  return out.charAt(0).toUpperCase() + out.slice(1)
}
// "celebrity problem" -> "the celebrity problem"; "retries + DLQ" -> "retries and DLQ" (read aloud well).
const thePhrase = p => {
  const x = String(p).replace(/\s*\+\s*/g, ' and ').replace(/\s*&\s*/g, ' and ').trim()
  return /^(the|a|an|how|what|when|why|which)\b|^\w+ing\b/i.test(x) ? x : `the ${x}`
}

/** "Design a URL shortener (like bit.ly)." -> "the URL shortener"; "Design Twitter/X." -> "Twitter/X". */
export function systemName(title) {
  const m = String(title).replace(/\s*\(.*?\)\s*/g, ' ').replace(/[.?!]\s*$/, '').trim().match(/^design\s+(?:(a|an|the)\s+)?(.+)$/i)
  if (!m) return 'this system'
  return m[1] ? `the ${m[2].trim()}` : m[2].trim()
}

// ---- Stage questions: first ask about a stage the candidate hasn't covered. Several phrasings each. ----
const STAGE = {
  requirements: [
    'Before we go deeper, what are the core features {system} must support, and which non-functional requirements matter most?',
    "Let's pin down scope. What's in and out for {system}, and what are the latency and availability targets?",
    'Who uses {system}, and what do they do most often? That decides what we optimise for.',
  ],
  estimation: [
    "Let's size {system}. Roughly how many users and requests per second, and how much storage over a few years?",
    'Give me a back-of-the-envelope estimate for {system}: peak traffic, read to write ratio, and data growth.',
    'How big does {system} get? Walk me through the numbers: daily users, requests per second, storage per year.',
  ],
  api: [
    'What would the main APIs of {system} look like, and how would you model the data?',
    'Sketch the key endpoints for {system}, and the tables or collections behind them. Which database, and why?',
    'Walk me through the data model for {system}: the main entities, their keys, and how they relate.',
  ],
  highlevel: [
    'Walk me through the high-level architecture of {system}. What are the main components, and how does a request flow through them?',
    'Draw the big picture for {system}: clients, services, storage. Follow one request end to end.',
    "Let's see the overall design of {system}. Which services do you need, and how do they talk to each other?",
  ],
  scaling: [
    'Say traffic to {system} grows ten times. Where are the bottlenecks, and how would you scale them?',
    'How does {system} scale out? Talk about caching, sharding and replication where they apply.',
    "What's the first thing in {system} to fall over under heavy load, and what's your fix?",
  ],
  reliability: [
    'What happens when one of the components of {system} fails? How do you stay available and avoid losing data?',
    'How does {system} cope with failures: a server crash, a network partition, a slow dependency?',
    'Walk me through failure handling in {system}: retries, timeouts, and how you make sure nothing is lost or duplicated.',
  ],
  tradeoffs: [
    'What trade-offs did you make in {system}, and what would you change at a different scale?',
    'If you had to defend one decision in {system} to a sceptical reviewer, which one, and why is it right?',
    "What's the weakest part of your design for {system}, and what would you do with more time?",
  ],
}

// ---- Missed rubric points: specific phrasings for common ones, then a general fallback. ----
const CONCEPT = [
  [/monitor|alert|observab/i, ['How would you know {system} is unhealthy? What would you monitor and alert on?']],
  [/qps|traffic|throughput|request/i, ['How many requests per second should {system} handle at peak? Walk me through the maths.']],
  [/storage|data size|capacity/i, ['How much storage does {system} need over five years? Show me the calculation.']],
  [/data model|schema|entit/i, ['What tables or collections does {system} need, and what are the key fields and indexes?']],
  [/database|db choice|datastore/i, ['Which database would you pick for {system}, and why that one over the alternatives?']],
  [/idempot|duplicate|exactly.once/i, ['What happens in {system} if the same request is processed twice? How do you make it safe?']],
  [/consisten/i, ['Which parts of {system} need strong consistency, and where is eventual consistency fine?']],
  [/cach/i, ['What would you cache in {system}, where does the cache sit, and how do you invalidate it?']],
  [/shard|partition/i, ['How would you partition the data in {system}? What is the shard key, and how do you avoid hot shards?']],
  [/replica|failover/i, ['How is data replicated in {system}, and what happens during a failover?']],
  [/queue|async|kafka|stream/i, ['Which work in {system} should be asynchronous, and how would a queue fit in?']],
  [/rate.?limit|throttl|abuse/i, ['How do you protect {system} from abuse and traffic spikes? Where would rate limiting sit?']],
  [/secur|auth|encrypt|privacy/i, ['How do you secure {system}: authentication, authorisation and protecting user data?']],
  [/id gen|unique id|short code|key gen/i, ['How does {system} generate unique IDs across many servers without collisions?']],
  [/search|index/i, ['How does search work in {system}, and how do you keep the index in sync with the data?']],
  [/notif|push/i, ['How does {system} notify users, and how do you handle users who are offline?']],
  [/real.?time|websocket|presence/i, ['How does {system} push updates in real time, and how do you scale those connections?']],
  [/feed|timeline|fan.?out/i, ['How is the feed built in {system}: fan-out on write, on read, or a mix? Why?']],
  [/geo|location|nearby|map/i, ['How does {system} find things near a user efficiently? Which spatial index would you use?']],
  [/media|image|video|cdn|upload/i, ['How does {system} store and serve media? Where does the CDN come in?']],
  [/analytic|count|metric/i, ['How would {system} count and report usage without slowing down the main path?']],
  [/expir|ttl|cleanup/i, ['How does {system} expire old data, and how do you clean it up without hurting performance?']],
  [/payment|transaction|ledger/i, ['How do you make money movement in {system} correct, even if a step fails halfway?']],
]
const CONCEPT_FALLBACK = {
  soft: ["Here's a hint: think about {concept}. How would {system} handle it?", 'A small nudge: {concept} matters here. Any thoughts on it?'],
  moderate: ['What about {concept} in {system}?', "You haven't touched on {concept} yet. How would you approach it?", 'How would {system} handle {concept}?'],
  hard: ["I still haven't heard about {concept}. Be specific: how does it work in {system}?", "I haven't heard anything on {concept} yet. Walk me through it, step by step."],
}

// ---- Technologies the candidate names: a real interviewer picks up on them. ----
const TECH = [
  { re: /\b(redis|memcached?)\b/i, push: [['{tech} keeps everything in memory. If it restarts, haven\'t you just lost that data? Why trust it here?', 'persist|aof|rdb|snapshot|replica|rebuild|source of truth|cache.?aside|warm|backed by|database|ttl', 'the database']], q: ['You mentioned {tech}. What exactly do you keep in it, and how do you keep it consistent with the database?'],
    hard: ['What happens to {system} when the {tech} cluster goes down, or comes back cold?', 'How do you stop a thundering herd on the database when a hot {tech} key expires?'] },
  { re: /\b(kafka|rabbitmq|sqs|pub ?sub|message queue|queue)\b/i, push: [["Isn't {tech} overkill here? A plain database table used as a queue would be much easier to run.", 'throughput|replay|retention|partition|consumer group|decoupl|backpressure|burst|durab|ordering|fan.?out|scal|million', 'a database table']], q: ['Why {tech} here? What does it decouple in {system}?'],
    hard: ['With {tech}, how do you handle duplicate or out-of-order messages?', 'What happens to {system} if consumers fall hours behind on {tech}?'] },
  { re: /\b(cassandra|dynamo ?db|mongo ?db|hbase|bigtable|scylla ?db|no ?sql)\b/i, push: [["{tech} is only eventually consistent. Won't users sometimes not see what they just wrote? Wouldn't Postgres be safer?", 'quorum|tunable|consistency level|read.your.writes|lightweight transaction|lwt|partition key|write.heavy|availability|cap theorem|scale out|horizontal', 'Postgres']], q: ['Why {tech} over a relational database for {system}? What is your partition key?'],
    hard: ['How do you avoid hot partitions in {tech} for {system}?', 'What queries become hard with {tech}, and how do you serve them?'] },
  { re: /\b(postgres(ql)?|mysql|sql server|relational|rdbms|sql)\b/i, push: [["A single {tech} won't survive this write volume. Shouldn't you use a NoSQL store like Cassandra from day one?", 'shard|partition|replica|vertical|transaction|acid|join|index|connection pool|citus|vitess|good enough|until|consisten', 'Cassandra']], q: ['Can a single {tech} instance handle this load? When would you shard it, and on what key?'],
    hard: ['Walk me through how you would shard {tech} for {system} without downtime.', 'Which {tech} indexes do you need, and what do they cost on writes?'] },
  { re: /\b(cdn|cloudfront|akamai)\b/i, push: [['Why pay for a {tech}? Your own servers could serve these files directly.', 'latency|edge|bandwidth|offload|origin|geograph|cache hit|closer|egress', 'serving from your servers']], q: ['What goes on the {tech}, and how do you invalidate content when it changes?'],
    hard: ['How do you serve private or user-specific content through the {tech} securely?'] },
  { re: /\b(load balancer|nginx|haproxy|elb)\b/i, q: ['How does the {tech} pick a server, and how does it notice one is unhealthy?'],
    hard: ['What happens to in-flight requests when a server behind the {tech} dies?'] },
  { re: /\b(websockets?|long polling|server.sent events|sse)\b/i, push: [['{tech} connections are painful to scale. Why not just poll every few seconds?', 'latency|real.?time|battery|overhead|wasted|empty response|push|server load|pub.?sub|instant', 'polling']], q: ['How do you route a message to the right {tech} connection when there are many servers?'],
    hard: ['How many {tech} connections can one server hold, and what happens when it restarts?'] },
  { re: /\b(elastic ?search|solr|search index|inverted index)\b/i, push: [["Why add {tech}? A LIKE query on the main database would do.", 'inverted index|relevance|full.?text|ranking|scal|latency|tokeni|fuzzy|full table scan', 'a LIKE query']], q: ['How do you keep {tech} in sync with the primary database?'],
    hard: ['What happens to search results if {tech} falls behind the database by a few minutes?'] },
  { re: /\b(s3|object storage|blob storage|gcs)\b/i, push: [['Why {tech}? You could keep the files in the database as blobs and skip a system.', 'cost|size|durab|cheap|cdn|stream|bloat|backup|scal|large file', 'database blobs']], q: ['How do clients upload large files to {tech}, and how do you control who can read them?'],
    hard: ['How do you handle an upload that fails halfway into {tech}?'] },
  { re: /\b(consistent hashing)\b/i, push: [['Why {tech}? Plain modulo hashing is much simpler.', 'rehash|remap|move|minimal|joins|leaves|virtual node|rebalanc|add a node|remove a node', 'modulo hashing']], q: ['How does {tech} help when nodes join or leave? What are virtual nodes for?'],
    hard: ['With {tech}, how do you rebalance without a storm of cache misses?'] },
  { re: /\b(shard(ing|s)?|partition(ing|s)?)\b/i, push: [['Sharding adds a lot of complexity. Couldn\'t one bigger database machine handle this?', 'write|storage|limit|vertical|ceiling|hot|throughput|single machine|single point|terabyte', 'one bigger machine']], q: ["What's your shard key, and how do you avoid hot shards?"],
    known: ["You're sharding by {key}. What happens when one {key} gets far more traffic than the rest?", 'With {key} as the shard key, how do you serve a query that needs data from many shards?'],
    hard: ['How would you reshard {system} when one shard gets too big?'] },
  { re: /\b(replicas?|replication)\b/i, q: ['Is the replication synchronous or asynchronous? What can you lose on failover?'],
    hard: ['How do you stop users reading stale data from a lagging replica?'] },
  { re: /\b(bloom filters?)\b/i, q: ['Where does the {tech} sit, and what happens on a false positive?'], hard: [] },
  { re: /\b(zookeeper|etcd|leader election|raft|paxos)\b/i, q: ['How does {tech} fit in, and what happens during a network partition?'], hard: ['How do you avoid split brain with {tech}?'] },
  { re: /\b(snowflake|uuid|ticket server|id generator)\b/i, q: ['How does {tech} keep IDs unique across servers? Are they sortable by time?'], hard: ['What happens to {tech} IDs if a server clock goes backwards?'] },
  { re: /\b(geohash|quad ?tree|s2|h3)\b/i, q: ['How do you query nearby items with {tech}, and how do you handle cell boundaries?'], hard: [] },
  { re: /\b(microservices?)\b/i, push: [['Why {tech}? A single service would be far simpler for a small team.', 'independent|deploy|scal|ownership|isolation|team|fault|boundar|blast radius', 'a monolith']], q: ['How do these {tech} talk to each other, and what happens when one gets slow?'], hard: ['How do you trace one user request across all those {tech}?'] },
  { re: /\b(spark|hadoop|batch job|cron)\b/i, q: ['How fresh does the data from the {tech} need to be, and how long does a run take?'], hard: [] },
]
/** Technologies named in a reply, in the order they appear: [{ i, tech }]. */
export function techsIn(text) {
  const found = []
  TECH.forEach((t, i) => { const m = String(text).match(t.re); if (m) found.push({ i, tech: m[0], at: m.index }) })
  return found.sort((a, b) => a.at - b.at)
}

// ---- What-if scenarios: pressure tests, mostly for the Hard interviewer. ----
const SCENARIOS = [
  'Traffic to {system} spikes twenty times during a big event. What breaks first, and what do you do?',
  'An entire data centre goes down. How does {system} keep serving users?',
  'Your cache hit rate suddenly drops from 95 to 30 percent. What happens to {system}, and how do you recover?',
  'A bad deploy corrupts some data in {system}. How would you detect it and recover?',
  'Users on another continent say {system} is slow. What would you change?',
  'The main database for {system} is at 90 percent CPU. How do you find and fix the bottleneck?',
]

// ---- Known hard parts of this design (from its model answer). ----
const CHALLENGE = {
  soft: ['One tricky part of {system} is {main}. How might you approach it?{hint}', 'Let me point you at {main}. Any ideas for handling it in {system}?{hint}'],
  moderate: ["Let's talk about {main}. How would you handle that in {system}?", 'How would {system} deal with {main}?', "What's your approach to {main} here?"],
  hard: ['I want depth on {main}. What exactly happens, step by step, and where does it break?', 'Walk me through {main} in {system}{detail}. What are the failure cases?'],
}
const splitChallenge = c => {
  const m = String(c).match(/^(.*?)\s*\((.*)\)\s*$/)
  return m ? { main: m[1], detail: m[2] } : { main: c, detail: '' }
}

// How much of each kind each interviewer asks.
const MIX = {
  soft: { tech: 0, techEvery: 99, challenges: 1, scenarios: 0 },
  moderate: { tech: 2, techEvery: 3, challenges: 3, scenarios: 1 },
  hard: { tech: 4, techEvery: 2, challenges: 4, scenarios: 2 },
}

/** Fresh per interview. */
export const newPlanState = () => ({ used: new Set(), asked: {}, techAsked: 0, techDone: new Set(), challengesAsked: 0, scenariosAsked: 0, turns: 0 })

/**
 * The interviewer's next move after a reply: { kind, text, stageKey? } or null when the interview should end.
 * stages: the probe result [{ key, label, score, missed }]; persona: { threshold, perStage, maxFollowUps }.
 */
export function planNext({ style, persona, stages, system, lastReply, challenges = [], deep = [], state }) {
  if (state.turns >= persona.maxFollowUps) return null
  state.turns++
  const mix = MIX[style] || MIX.moderate
  const vars = { system }

  // 1. React to a technology the candidate just named (Moderate/Hard), every few turns.
  const newTech = techsIn(lastReply).find(t => !state.techDone.has(t.i))
  if (newTech && state.techAsked < mix.tech && state.turns % mix.techEvery === 1 % mix.techEvery) {
    const bank = TECH[newTech.i]
    // If they already said what they shard by, build on it instead of asking for it.
    const key = bank.known && String(lastReply).match(/\bby\s+([a-z][\w ]{1,18}?)(?=\s*(?:[,.;!?]|$)|\s+(?:and|so|across|because|which|to|with)\b)/i)?.[1]
    if (key) {
      const k = pickFresh(bank.known, state.used, `tech${newTech.i}-known`)
      if (k) { state.techDone.add(newTech.i); state.techAsked++; return { kind: 'tech', tech: newTech.tech, text: fill(k, { ...vars, key: key.trim() }) } }
    }
    const q = pickFresh(style === 'hard' && bank.hard.length ? [...bank.hard, ...bank.q] : bank.q, state.used, `tech${newTech.i}`)
    if (q) {
      state.techDone.add(newTech.i)
      state.techAsked++
      return { kind: 'tech', tech: newTech.tech, text: fill(q, { ...vars, tech: newTech.tech }) }
    }
  }

  // 2. The first stage that is still thin, in interview order. One general question per stage; after that only a
  //    question about a specific missed point, and if there's nothing specific left to ask, move on.
  for (const weak of stages) {
    if (weak.score >= persona.threshold || (state.asked[weak.key] || 0) >= persona.perStage) continue
    const n = state.asked[weak.key] || 0
    state.asked[weak.key] = n + 1
    let q = null
    if (n === 0) {
      q = pickFresh(STAGE[weak.key] || [`Let's talk about ${weak.label.toLowerCase()} for {system}. How would you approach it?`], state.used, `stage-${weak.key}`)
      if (q) return { kind: 'stage', stageKey: weak.key, text: fill(q, vars) }
    } else if (weak.missed) {
      const specific = CONCEPT.find(([re]) => re.test(weak.missed))
      q = specific && style !== 'soft' ? pickFresh(specific[1], state.used, `concept${CONCEPT.indexOf(specific)}`) : null
      q = q || pickFresh(CONCEPT_FALLBACK[style] || CONCEPT_FALLBACK.moderate, state.used, `fallback-${style}`)
      if (q) return { kind: 'concept', stageKey: weak.key, text: fill(q, { ...vars, concept: weak.missed.toLowerCase() }) }
    }
    state.asked[weak.key] = persona.perStage   // nothing new to ask on this stage
  }

  // 3. This design's known hard parts: hand-written deep dives first, then ones built from the model answer.
  if (state.challengesAsked < mix.challenges && deep.length) {
    const q = pickFresh(deep, state.used, 'deep')
    if (q) { state.challengesAsked++; return { kind: 'challenge', text: fill(q, vars) } }
  }
  if (state.challengesAsked < mix.challenges && challenges.length) {
    const c = pickFresh(challenges, state.used, 'challenge-item')
    if (c) {
      const { main, detail } = splitChallenge(c)
      const t = pickFresh(CHALLENGE[style] || CHALLENGE.moderate, state.used, `challenge-${style}`) || CHALLENGE.moderate[0]
      state.challengesAsked++
      return { kind: 'challenge', text: fill(t, { ...vars, main: thePhrase(main), hint: detail ? ` A hint: think about ${detail}.` : '', detail: detail ? `, including ${detail}` : '' }) }
    }
  }

  // 4. Pressure tests.
  if (state.scenariosAsked < mix.scenarios) {
    const q = pickFresh(SCENARIOS, state.used, 'scenario')
    if (q) { state.scenariosAsked++; return { kind: 'scenario', text: fill(q, vars) } }
  }

  // 5. Any technology mentioned earlier but not yet probed (Hard keeps digging).
  if (style === 'hard' && state.techAsked < mix.tech) {
    for (const t of techsIn(lastReply)) {
      if (state.techDone.has(t.i)) continue
      const q = pickFresh(TECH[t.i].q, state.used, `tech${t.i}`)
      if (q) { state.techDone.add(t.i); state.techAsked++; return { kind: 'tech', tech: t.tech, text: fill(q, { ...vars, tech: t.tech }) } }
    }
  }
  state.turns--
  return null
}

// Generic words the tech banks match on but that sound odd in a reaction ("Good, shard works well here").
const GENERIC_TECH = /^(queue|message queue|pub ?sub|shard\w*|partition\w*|replicas?|replication|sql|relational|rdbms|load balancer|microservices?|batch job|cron|search index|inverted index|object storage|blob storage|no ?sql|leader election|websockets?|long polling)$/i
const pick = list => list[Math.floor(Math.random() * list.length)]
// Generic words read aloud as a thing ("relational" -> "relational database"); product names capitalised.
const SPOKEN_TECH = { relational: 'relational database', rdbms: 'relational database', sql: 'SQL database', nosql: 'NoSQL store', 'no sql': 'NoSQL store' }
const prettyTech = t => SPOKEN_TECH[String(t).toLowerCase()] || (/^[a-z0-9]+$/.test(t) && t.length <= 3 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1))
const words = t => (String(t).trim() ? String(t).trim().split(/\s+/).length : 0)

/** A short reaction to the last reply that names the product the candidate chose, when there is one. */
export function reaction(style, lastReply, fallbackAcks) {
  const t = techsIn(lastReply).map(x => x.tech).find(x => !GENERIC_TECH.test(x))
  if (t && Math.random() < 0.6) {
    const name = prettyTech(t)
    if (style === 'hard') return pick([`${name}. Okay.`, `Hmm, ${name}.`, `${name}, noted.`])
    if (style === 'soft') return pick([`Nice, ${name} is a good choice.`, `Good, ${name} works well here.`])
    return pick([`Okay, ${name} makes sense.`, `${name}, got it.`, `Right, ${name}.`])
  }
  return pick(fallbackAcks)
}

// ---- Reflecting the candidate's own words back ("So you're sharding by user id."). ----
const PRODUCTS = 'Redis|Memcached|Kafka|RabbitMQ|SQS|Cassandra|DynamoDB|MongoDB|Postgres|PostgreSQL|MySQL|Elasticsearch|S3|CDN|HBase|Bigtable|ZooKeeper|Spanner'
const END = '(?=\\s*(?:[,.;!?]|$)|\\s+(?:and|so|because|which|to|with|then|but)\\b)'
const STOP = /^(it|them|this|that|those|these|everything|data|stuff|things?)$/i
export function reflect(reply) {
  const text = String(reply)
  let m = text.match(new RegExp(`\\b(?:partition|shard)(?:ed|ing|s)?\\s+(?:the\\s+)?([a-z][\\w ]{0,20}?)\\s*\\bby\\s+([a-z][\\w ]{1,20}?)${END}`, 'i'))
  if (m) return `So you're sharding ${STOP.test(m[1].trim()) || !m[1].trim() ? '' : `${/^(the|a|an|our|my)\b/i.test(m[1].trim()) ? '' : 'the '}${m[1].trim()} `}by ${m[2].trim()}.`
  m = text.match(new RegExp(`\\b(?:store|keep|put|save|cache)(?:s|d|ing)?\\s+(?:the\\s+|all\\s+|each\\s+)?([a-z][\\w' ]{2,25}?)\\s+in\\s+(${PRODUCTS})\\b`, 'i'))
  if (m && !STOP.test(m[1].trim())) return `So the ${m[1].trim()} live in ${m[2]}.`
  m = text.match(new RegExp(`\\buse\\s+(${PRODUCTS})\\s+(?:for|to)\\s+([a-z][\\w ]{3,30}?)${END}`, 'i'))
  if (m) return `So ${m[1]} handles ${m[2].trim()}.`
  return null
}

// ---- Judging a reply to pushback. Rule-based: reasons and technical knowledge vs giving in or guessing. ----
const CAVE = /\b(you('re| are) (right|correct)|good point|fair point|(i|we)('ll| will| can| could| should) (just )?(switch|change|move|go with|use)|let('s| us) (just )?(switch|change|go with|use)|okay,? (then )?(i|we)('ll| will)? ?(switch|change)|makes sense,? (i|we)('ll| will))/i
const UNSURE = /\b(i('m| am) not (sure|certain)|i don'?t know|no idea|not sure|i guess|maybe|probably)\b/i
const REASON = /\b(because|since|so that|which means|trade.?offs?|instead|whereas|that's why|the reason|in exchange|at the cost|otherwise)\b/i
export function judgePushback(reply, defend) {
  const re = new RegExp(`\\b(${defend})\\w*`, 'gi')
  const terms = [...new Set((String(reply).match(re) || []).map(t => t.toLowerCase()))]
  const reasons = REASON.test(reply)
  if (CAVE.test(reply) && !terms.length) return { outcome: 'caved', terms }
  if (terms.length && reasons) return { outcome: 'strong', terms }
  if (terms.length || (reasons && words(reply) >= 20)) return { outcome: 'ok', terms }
  if (UNSURE.test(reply)) return { outcome: 'unsure', terms }
  if (CAVE.test(reply)) return { outcome: 'caved', terms }
  return { outcome: words(reply) < 12 ? 'unsure' : 'ok', terms }
}

const IDK = /\b(i don'?t know|no idea|not sure (about|how)|i'?m not familiar|i have no clue|can you (give|help)( me)?( with)? (a )?hint|i'?m stuck)\b/i
const RELATIONAL = /\b(postgres(ql)?|mysql|sql server|relational|rdbms)\b/i
const NOSQL = /\b(cassandra|dynamo ?db|mongo ?db|hbase|bigtable|scylla ?db)\b/i
const FAN_WRITE = /\bfan.?out on write|push (model|to (all )?(the )?followers)\b/i
const FAN_READ = /\bfan.?out on read|pull model\b/i
const PUSH_LIMIT = { soft: 1, moderate: 2, hard: 4 }

const TRANSITIONS = {
  soft: ['Great, let\'s move on.', 'Okay, next thing.', 'Lovely. Next,'],
  moderate: ['Okay, switching gears.', "Let's move on.", 'Alright, next topic.'],
  hard: ['Moving on.', 'Next.', "Let's switch."],
}
const OUTCOME_REACTION = {
  strong: { soft: ['Great answer, that\'s exactly the trade-off.'], moderate: ['Fair point, that answers it.', 'Good, that holds up.', 'Okay, convincing.'], hard: ['Okay. That holds up.', "Fine, I'll accept that."] },
  ok: { soft: ['Okay, that works.'], moderate: ["Okay, I'll accept that.", 'Alright, reasonable.'], hard: ["Hmm, okay. I'm not fully convinced, but let's move on.", 'Partly convincing.'] },
  unsure: { soft: ["That's okay, it's a tricky one."], moderate: ["Okay. That's worth reading up on."], hard: ['Worth reading up on before a real round.'] },
}

/** Fresh per interview. */
export const newInterviewState = () => ({ ...newPlanState(), pending: null, pushes: 0, pushedTopics: new Set(), signals: [], firstRel: null, firstNoSql: null, contradictions: new Set(), lastKind: null, lastQuestion: null, idkCount: 0, nudged: new Set(), seenTech: [] })

/**
 * The interviewer's whole turn after a reply: { text, kind, stageKey?, end?, beat }. Handles pushback judging,
 * "I don't know", too-short replies, contradictions, pushback, then the next planned question. `beat` is a
 * natural pause (ms) before speaking, longer after a longer answer.
 */
export function respond({ style, persona, stages, system, reply, challenges = [], bank = null, followUps = [], state, acks }) {
  const vars = { system }
  const beat = 350 + Math.min(1400, words(reply) * 7) + Math.floor(Math.random() * 300)
  const say = (text, extra = {}) => { state.lastKind = extra.kind || state.lastKind; state.lastQuestion = text; return { beat, ...extra, text: text.trim() } }
  const prefix = style === 'hard' && words(reply) > 220 ? 'Let me stop you there. ' : ''
  techsIn(reply).forEach(t => { if (!state.seenTech.some(s => s.i === t.i)) state.seenTech.push(t) })

  // 1. The reply to a pushback: judge it, react, and follow up once if they gave in without a reason.
  if (state.pending) {
    const p = state.pending
    state.pending = null
    const j = judgePushback(reply, p.defend)
    state.signals.push({ topic: p.topic, outcome: j.outcome, terms: j.terms.slice(0, 4) })
    state.pushCooldown = 2   // no fresh pushback right after one: a real interviewer lets the answer land
    if (j.outcome === 'caved') {
      const switchedTo = techsIn(reply).map(t => t.tech).find(t => t.toLowerCase() !== String(p.topic).toLowerCase())
      const choice = switchedTo ? prettyTech(switchedTo) : p.alt || 'that'
      return say(`${prefix}${pick(['Why the change?', 'Hold on, why switch?', 'Interesting, so you\'d change it?'])} What makes ${choice} the better fit for ${system}, and what do you lose?`, { kind: 'pushback-followup' })
    }
    const r = fill(pick(OUTCOME_REACTION[j.outcome][style] || OUTCOME_REACTION[j.outcome].moderate), { term: j.terms[0] ? prettyTech(j.terms[0]) : 'that' })
    const next = planWithBank({ style, persona, stages, system, reply, challenges, bank, followUps, state })
    return next ? say(`${prefix}${r} ${next.text}`, next) : say(r, { end: true })
  }

  // 2. "I don't know": a hint on Friendly/Moderate, "take a guess" on Hard, then move on.
  if (IDK.test(reply) && words(reply) < 30) {
    state.idkCount++
    const weak = stages.find(s => s.score < persona.threshold && s.missed)
    if (!state.nudged.has(state.lastQuestion) && state.lastQuestion) {
      state.nudged.add(state.lastQuestion)
      if (style === 'hard') return say(`${pick(['Take a guess.', "That's fine, reason it out loud."])} How would you approach it from first principles?`, { kind: 'nudge' })
      return say(weak ? `No problem. A hint: think about ${weak.missed.toLowerCase()}. How might that work in ${system}?` : 'No problem. Start simple: what is the most basic version that works?', { kind: 'nudge' })
    }
    const next = planWithBank({ style, persona, stages, system, reply, challenges, bank, followUps, state })
    return next ? say(`${pick(['Okay, let\'s move on.', 'Alright, let\'s leave that.'])} ${next.text}`, next) : say('Okay.', { end: true })
  }

  // 3. A very short answer: ask for more, once per question.
  if (words(reply) < 8 && state.lastQuestion && !state.nudged.has(state.lastQuestion)) {
    state.nudged.add(state.lastQuestion)
    return say(pick(['Can you go a bit deeper on that?', 'Say more. Walk me through the details.', 'Expand on that a little. How exactly would it work?']), { kind: 'nudge' })
  }

  // 4. Contradictions with what they said earlier.
  const rel = reply.match(RELATIONAL)?.[0], nos = reply.match(NOSQL)?.[0]
  if (rel && !state.firstRel) state.firstRel = { name: rel, turn: state.turns }
  if (nos && !state.firstNoSql) state.firstNoSql = { name: nos, turn: state.turns }
  if (style !== 'soft' && !state.contradictions.has('db')) {
    const earlier = rel && !nos && state.firstNoSql && state.firstNoSql.turn < state.turns ? [state.firstNoSql.name, rel]
      : nos && !rel && state.firstRel && state.firstRel.turn < state.turns ? [state.firstRel.name, nos] : null
    if (earlier) {
      state.contradictions.add('db')
      return say(`${prefix}Wait. Earlier you said ${prettyTech(earlier[0])}, and now ${prettyTech(earlier[1])}. Which one stores what, and why do you need both?`, { kind: 'contradiction' })
    }
  }
  if (!state.contradictions.has('fan') && !/hybrid|both|celebrit/i.test(reply)) {
    if ((FAN_READ.test(reply) && state.saidFanWrite) || (FAN_WRITE.test(reply) && state.saidFanRead)) {
      state.contradictions.add('fan')
      return say(`${prefix}Earlier you went with one fan-out approach, now the other. When does each apply in ${system}?`, { kind: 'contradiction' })
    }
  }
  if (FAN_WRITE.test(reply)) state.saidFanWrite = true
  if (FAN_READ.test(reply)) state.saidFanRead = true

  // 5. Pushback on a choice they just made: the design's own pushbacks first, then the technology's.
  const limit = PUSH_LIMIT[style] || 2
  const pushTurn = style === 'hard' || (style === 'moderate' ? state.turns % 2 === 1 : state.turns >= 3)
  if (state.pushCooldown > 0) state.pushCooldown--
  if (state.pushes < limit && pushTurn && !state.pushCooldown) {
    // Triggers are written as short phrases; let a couple of extra words sit between their parts ("store every location update in").
    const loose = t => new RegExp(t.replace(/ /g, '\\W+(?:\\w+\\W+){0,2}'), 'i')
    const own = (bank?.push || []).find(([trigger, claim]) => !state.pushedTopics.has(claim) && trigger && loose(trigger).test(reply))
    if (own) {
      const [, claim, defend, alt, topic] = own
      state.pushedTopics.add(claim); state.pushes++
      state.pending = { topic: topic || alt || claim.slice(0, 60), defend, alt }
      return say(`${prefix}${style === 'soft' ? 'Just to check: ' : ''}${fill(claim, vars)}`, { kind: 'pushback' })
    }
    const t = techsIn(reply).find(x => TECH[x.i].push && !state.pushedTopics.has(`tech${x.i}`))
    if (t) {
      const [claim, defend, alt] = TECH[t.i].push[0]
      state.pushedTopics.add(`tech${t.i}`); state.pushes++
      state.pending = { topic: prettyTech(t.tech), defend, alt }
      return say(`${prefix}${style === 'soft' ? 'Just to check: ' : ''}${fill(claim, { ...vars, tech: prettyTech(t.tech) })}`, { kind: 'pushback' })
    }
  }

  // 6. The next planned question, with a natural lead-in.
  const next = planWithBank({ style, persona, stages, system, reply, challenges, bank, followUps, state })
  if (!next) return say('', { end: true })
  const reflection = Math.random() < 0.5 ? reflect(reply) : null
  const lead = reflection || (state.lastKind && state.lastKind !== next.kind && Math.random() < 0.5 ? pick(TRANSITIONS[style] || TRANSITIONS.moderate) : reaction(style, reply, acks))
  return say(`${prefix}${lead} ${next.text}`, next)
}

/** planNext, preferring this design's own hand-written questions, and calling back to earlier answers now and then. */
function planWithBank({ style, persona, stages, system, reply, challenges, bank, followUps = [], state }) {
  // The design's own stage question goes first for a thin stage it hasn't asked about yet.
  if (bank?.ask) {
    for (const weak of stages) {
      if (weak.score >= persona.threshold || (state.asked[weak.key] || 0) > 0) continue
      const q = pickFresh(bank.ask[weak.key] || [], state.used, `bank-${weak.key}`)
      if (q && state.turns < persona.maxFollowUps) {
        state.turns++
        state.asked[weak.key] = 1
        return { kind: 'stage', stageKey: weak.key, text: fill(q, { system }) }
      }
      break
    }
  }
  // Deep dives: the current model answer's own follow-up questions first (they track edits to the answer), then the bank's.
  const next = planNext({ style, persona, stages, system, lastReply: reply, challenges, deep: [...followUps, ...(bank?.deep || [])], state })
  if (!next) return null
  // Memory: tie a challenge or scenario back to a technology they named earlier.
  const earlier = state.seenTech.find(t => !GENERIC_TECH.test(t.tech) && !techsIn(reply).some(x => x.i === t.i))
  if ((next.kind === 'challenge' || next.kind === 'scenario') && earlier && Math.random() < 0.5 && style !== 'soft') {
    next.text = `Thinking back to the ${prettyTech(earlier.tech)} you mentioned earlier: ${next.text.charAt(0).toLowerCase()}${next.text.slice(1)}`
  }
  return next
}
