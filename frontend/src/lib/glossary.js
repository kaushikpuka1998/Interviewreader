import { useEffect, useReducer } from 'react'

// Hover definitions for words/units inside answers. Add a line here to teach a new term.
// Text after '||' is shown as an "Example" line. Units are matched case-sensitively (GB ≠ gb); words are matched case-insensitively.
const UNITS = {
  KB: 'Kilobyte: 1,024 bytes (~10³). A short text file or a small JSON response.',
  MB: 'Megabyte: ~1 million bytes (~10⁶). A photo or a minute of MP3 audio.',
  GB: 'Gigabyte: ~1 billion bytes (~10⁹). An HD movie, or a typical server’s RAM chunk.',
  TB: 'Terabyte: ~1 trillion bytes (~10¹²). 1,000 GB, a laptop or single-disk scale.',
  PB: 'Petabyte: ~1 quadrillion bytes (~10¹⁵). 1,000 TB, big-data warehouse scale.',
  EB: 'Exabyte: 1,000 PB (~10¹⁸). Internet-company-wide storage scale.',
  ms: 'Millisecond: 1/1,000 of a second. A network hop in one data centre is ~0.5 ms.',
  RPS: 'Requests per second: how many requests the system handles each second.',
  QPS: 'Queries per second: how many reads/queries are served each second.',
  TPS: 'Transactions per second: how many writes/transactions complete each second.',
}

const WORDS = {
  thousand: '1,000 (10³). Written K, e.g. 10K = 10 thousand.',
  thousands: '1,000 (10³) each. Written K.',
  million: '1,000,000 (10⁶). Written M, e.g. 5M users.',
  millions: '1,000,000 (10⁶) each. Written M.',
  billion: '1,000,000,000 (10⁹). Written B, e.g. 2B events a day.',
  billions: '1,000,000,000 (10⁹) each. Written B.',
  trillion: '1,000,000,000,000 (10¹²). 1,000 billion.',
  trillions: '1,000,000,000,000 (10¹²) each.',
  starvation: 'A thread or request never gets the resource (CPU, lock, queue slot) because others keep jumping ahead of it, so it waits forever. Fix with fair locks, priorities that age, or bounded queues.||Example: a low-priority job never runs because high-priority jobs keep arriving.',
  deadlock: 'Two or more threads each hold a lock the other needs, so none can ever proceed. Avoid by always taking locks in the same order or using timeouts.||Example: T1 holds A and wants B, T2 holds B and wants A.',
  livelock: 'Threads keep reacting to each other and changing state but make no progress, like two people stepping aside in a corridor forever.',
  'race condition': 'The result depends on the timing of threads touching shared data. Fix with locks, atomics or immutable data.',
  idempotent: 'Doing it once or many times has the same effect. Makes retries safe (e.g. PUT, or a payment with an idempotency key).',
  throughput: 'How much work completes per unit time (requests/second, MB/second).',
  latency: 'How long one request takes from start to finish. Often quoted as p50, p95, p99.',
  p99: '99th-percentile latency: 99% of requests are faster than this, 1% are slower. Shows the tail, not the average.',
  sharding: 'Splitting data across several databases by a key (e.g. user id) so each holds only a slice.',
  replication: 'Keeping copies of data on several nodes for availability and read scale.',
  'eventual consistency': 'Replicas may briefly disagree, but if writes stop they all converge to the same value.',
  backpressure: 'Telling a fast producer to slow down when the consumer can’t keep up, instead of letting queues grow without limit.',
  'thundering herd': 'Many clients hit the same resource at once (e.g. a cache key expires), overwhelming it.',
  'cache stampede': 'A popular cache entry expires and many requests rebuild it simultaneously, hammering the database.',
  'single point of failure': 'One component whose failure takes the whole system down. Remove it with redundancy.',
  spof: 'Single point of failure: one component whose failure takes the whole system down.',

  // ---- Java & concurrency ----
  mutex: 'Mutual-exclusion lock: only one thread at a time can hold it, so only one runs the guarded code.',
  semaphore: 'A counter that lets up to N threads in at once; extra threads wait. A mutex is a semaphore with N = 1.',
  volatile: 'Java keyword: reads/writes of the field always go to main memory, so other threads see the latest value. It does not make count++ atomic.',
  immutable: 'An object that can never change after it is created. Safe to share between threads without locks (e.g. String).',
  'thread-safe': 'Correct when many threads use it at the same time, with no corrupted state or lost updates.',
  'thread safe': 'Correct when many threads use it at the same time, with no corrupted state or lost updates.',
  'thread pool': 'A fixed set of reusable worker threads that pick tasks from a queue, so you don’t pay thread-creation cost per task.',
  'context switch': 'The CPU pausing one thread and resuming another. It saves/restores state, so too many threads waste time on switching.',
  atomicity: 'All-or-nothing: an operation either fully happens or not at all, and no one sees a half-done state.',
  reentrant: 'A lock the same thread can acquire again without blocking itself (e.g. synchronized, ReentrantLock).',
  'compare-and-swap': 'CPU instruction: “set to new only if the value is still what I expect.” Basis of lock-free atomics.||Example: AtomicInteger.incrementAndGet() retries a CAS until it wins.',
  'false sharing': 'Two threads write different variables that sit on the same CPU cache line, so the cores keep invalidating each other’s cache and slow down.',
  'busy waiting': 'Looping and re-checking a condition instead of sleeping, which burns CPU while you wait.',
  'virtual thread': 'Java 21 lightweight thread managed by the JVM, not the OS. You can run millions, and blocking calls are cheap.',
  completablefuture: 'Java class for async pipelines: run work in the background and chain steps with thenApply / thenCompose / thenCombine.',
  'garbage collection': 'The JVM automatically freeing memory of objects nothing references any more.',
  'stop-the-world': 'A GC pause where all application threads are frozen while the collector works. Long pauses = latency spikes.',
  'memory leak': 'Objects that are no longer needed but are still referenced, so GC can’t free them and memory keeps growing.',
  metaspace: 'JVM native memory that holds class metadata (replaced PermGen in Java 8).',
  jit: 'Just-In-Time compiler: turns hot bytecode into optimised machine code while the program runs.',
  'type erasure': 'Java removes generic type info at compile time, so List<String> and List<Integer> are the same List at runtime.',
  autoboxing: 'Java automatically converting between primitives and wrappers (int ⇄ Integer). Can create hidden objects and NPEs.',
  'fail-fast': 'Iterators that throw ConcurrentModificationException if the collection is changed while you loop over it.',
  'weak reference': 'A reference that does not stop GC from collecting the object. Used in caches like WeakHashMap.',
  polymorphism: 'Same call, different behaviour depending on the real object type (method overriding / interfaces).',
  encapsulation: 'Hiding an object’s internal state behind methods so it can only change in controlled ways.',
  // ---- Spring & JPA / SQL ----
  'dependency injection': 'Objects receive their collaborators from outside (the container) instead of creating them with new. Easier to test and swap.',
  'inversion of control': 'The framework calls your code and creates objects for you, instead of your code controlling the flow.',
  aop: 'Aspect-Oriented Programming: add cross-cutting behaviour (logging, transactions, security) around methods without editing them.',
  'spring bean': 'An object created and managed by the Spring container, injected wherever it is needed.',
  'n+1': 'Query problem: 1 query loads N parents, then N more queries load each parent’s children. Fix with JOIN FETCH or batch fetching.',
  'lazy loading': 'Loading data only when first accessed, not up front. Saves work, but can cause extra queries or LazyInitializationException.',
  'dirty checking': 'Hibernate/Angular compares current state with a saved snapshot to find what changed, then updates only that.',
  orm: 'Object-Relational Mapper: maps classes to tables so you work with objects instead of SQL (Hibernate/JPA).',
  acid: 'Atomicity, Consistency, Isolation, Durability: the guarantees of a database transaction.',
  'optimistic locking': 'Assume conflicts are rare: check a version number on save and fail if someone else changed the row.',
  'pessimistic locking': 'Lock the row when you read it so nobody else can change it until you finish.',
  'isolation level': 'How much one transaction can see of another’s uncommitted work: read uncommitted < read committed < repeatable read < serializable.',
  'dirty read': 'Reading data another transaction has changed but not yet committed (it may be rolled back).',
  'phantom read': 'Re-running a query inside a transaction returns new rows that another transaction inserted.',
  normalization: 'Splitting data into related tables to remove duplication and update anomalies.',
  denormalization: 'Deliberately duplicating data to make reads faster, at the cost of harder writes.',
  'covering index': 'An index that holds all columns a query needs, so the database never touches the table.',
  'b-tree': 'Balanced tree used by most database indexes; keeps keys sorted so lookups and range scans are O(log n).',
  mvcc: 'Multi-Version Concurrency Control: readers see a snapshot while writers create new row versions, so reads don’t block writes.',
  'write-ahead log': 'Changes are first appended to a log on disk, then applied. Lets the database recover after a crash.',
  'two-phase commit': 'Coordinator asks all participants to “prepare”, then tells everyone to commit. Atomic across systems, but blocks on failure.',
  // ---- Microservices & patterns ----
  saga: 'A long business transaction split into local steps, each with a compensating undo step if a later step fails.',
  'outbox pattern': 'Write the event to an “outbox” table in the same DB transaction as your data; a relay publishes it later. No lost or phantom events.',
  'circuit breaker': 'Stops calling a failing service for a while (open), then tries a few calls (half-open) before closing again, so failures don’t cascade.',
  bulkhead: 'Isolate resources (thread pools, connections) per dependency so one slow service can’t sink the whole app.',
  'service mesh': 'Infrastructure layer of sidecar proxies that handles retries, TLS and tracing between services without app code.',
  sidecar: 'A helper process deployed next to your service that handles cross-cutting work (proxying, logging, TLS).',
  'api gateway': 'Single entry point for clients that routes requests and handles auth, rate limiting and aggregation.',
  'service discovery': 'How services find each other’s current addresses when instances come and go (registry like Eureka/Consul, or DNS).',
  'strangler fig': 'Migrate a monolith gradually by routing one feature at a time to new services until the old system can be switched off.',
  cqrs: 'Command Query Responsibility Segregation: separate models for writing and for reading, each optimised for its job.',
  'event sourcing': 'Store every change as an event instead of the current state; rebuild state by replaying the events.',
  'dead letter queue': 'A queue where messages that keep failing are parked, so they don’t block everything else and can be inspected later.',
  dlq: 'Dead letter queue: where messages that keep failing are parked for inspection.',
  coupling: 'How much one module depends on another. Low coupling = you can change one without breaking the other.',
  cohesion: 'How closely the parts of a module belong together. High cohesion = one clear responsibility.',
  'solid principles': 'Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion.',
  'technical debt': 'Shortcuts taken now that make future changes slower, like interest you pay until you refactor.',
  singleton: 'Design pattern: exactly one instance of a class, with one global access point.',
  'observer pattern': 'Subjects notify all subscribed observers when they change (basis of events/listeners).',
  // ---- Kafka ----
  'consumer group': 'Consumers sharing a group id split a topic’s partitions between them; each message goes to one consumer per group.',
  'consumer lag': 'How far a consumer is behind the latest message in a partition. Growing lag means it can’t keep up.',
  rebalance: 'Kafka reassigning partitions among the consumers in a group when members join, leave or crash. Processing pauses briefly.',
  'exactly-once': 'Each message affects the result exactly once, even with retries. Kafka does this with idempotent producers + transactions.',
  'at-least-once': 'Never lose a message but may deliver it twice, so consumers must be idempotent.',
  'at-most-once': 'Never duplicates, but a message can be lost if processing fails.',
  'log compaction': 'Kafka keeps only the latest message per key and discards older ones, like a changelog of current state.',
  'zero-copy': 'Sending file data to the network without copying it through application memory. A big reason Kafka is fast.',
  // ---- Node ----
  'event loop': 'The loop that picks the next callback/promise when the call stack is empty. It lets single-threaded JS/Node do non-blocking I/O.',
  libuv: 'The C library behind Node that provides the event loop and a thread pool for file, DNS and crypto work.',
  microtask: 'A promise callback. Microtasks run after the current code and before the next timer or I/O callback.',
  middleware: 'A function that sits between the request and the handler (logging, auth, parsing) and calls next() to continue.',
  'callback hell': 'Deeply nested callbacks that are hard to read. Fixed with promises or async/await.',
  // ---- React / JS / Angular ----
  reconciliation: 'React diffing the new virtual DOM against the old one to work out the smallest set of real DOM changes.',
  'virtual dom': 'A lightweight JS copy of the UI. React compares copies and only updates the parts of the real DOM that changed.',
  hydration: 'Attaching event handlers to server-rendered HTML so it becomes interactive in the browser.',
  'prop drilling': 'Passing props through many components that don’t use them just to reach a deep child. Solved with context or a store.',
  memoization: 'Caching a function’s result for the same inputs so it isn’t recomputed (useMemo, useCallback, React.memo).',
  'stale closure': 'A callback that still sees old variable values from an earlier render. Fix with correct hook dependencies.',
  closure: 'A function that remembers variables from the scope where it was created, even after that scope has finished.',
  hoisting: 'JS moves declarations to the top of their scope before running. var is hoisted as undefined; let/const are not usable early.',
  debounce: 'Wait until the user stops triggering an event for X ms, then run once (e.g. search-as-you-type).',
  throttle: 'Run at most once every X ms no matter how often the event fires (e.g. scroll handlers).',
  'tree shaking': 'The bundler dropping exports that are never imported, so unused code doesn’t ship.',
  'code splitting': 'Breaking the bundle into chunks loaded on demand, so the first page loads faster.',
  'error boundary': 'React component that catches render errors in its children and shows a fallback instead of crashing the whole app.',
  'controlled component': 'A form input whose value is held in React state and updated through onChange.',
  'higher-order component': 'A function that takes a component and returns a new one with extra behaviour.',
  'change detection': 'Angular checking whether data changed so it can update the view. OnPush limits checks to input/event changes.',
  rxjs: 'Library for composing async streams (Observables) with operators like map, switchMap and debounceTime.',
  observable: 'A stream of values over time you can subscribe to. Lazy: nothing runs until someone subscribes.',
  // ---- Go ----
  goroutine: 'A very cheap Go thread managed by the Go runtime. Start one with go f(). Thousands are fine.',
  'race detector': 'Go tool (go test -race) that finds unsynchronised concurrent access to the same variable.',
  'escape analysis': 'Compiler check that decides whether a value can live on the stack or must be moved to the heap.',
  // ---- Security & general ----
  cors: 'Cross-Origin Resource Sharing: the browser rule/headers that decide whether a page from one origin may call an API on another.',
  csrf: 'Cross-Site Request Forgery: a malicious site makes your browser send an authenticated request. Stop with CSRF tokens or SameSite cookies.',
  xss: 'Cross-Site Scripting: attacker injects JavaScript into a page that other users load. Stop by escaping output and using CSP.',
  'sql injection': 'Attacker input is treated as SQL. Prevent by using parameterised queries/prepared statements.',
  jwt: 'JSON Web Token: a signed token carrying claims (user id, expiry). Servers verify the signature instead of looking up a session.',
  oauth: 'Standard for delegated access: an app gets a limited token to act for a user without ever seeing their password.',
  sso: 'Single Sign-On: log in once and access multiple apps.',
  'rate limiting': 'Capping how many requests a client can make in a time window to protect the service.',
  'big o': 'Notation for how run time or memory grows with input size n (O(1), O(log n), O(n), O(n²)).',
  lru: 'Least Recently Used: when the cache is full, evict the entry that hasn’t been used for the longest time.',
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Terms saved by admins (database) override the built-in ones above.
let custom = {}
let RE
const listeners = new Set()
function rebuild() {
  const keys = [...new Set([...Object.keys(UNITS), ...Object.keys(WORDS), ...Object.keys(custom)])].sort((a, b) => b.length - a.length)
  // ponytail: lookarounds instead of \b so "500GB" and "2KB" match too; optional plural suffix.
  RE = new RegExp(`(?<![A-Za-z_])(${keys.map(esc).join('|')})(?:e?s)?(?![A-Za-z_])`, 'gi')
}
rebuild()

/** Splits text into [{text}|{text, hint}] pieces; hint present when the piece is a known term. */
export function glossify(text) {
  const out = []
  let last = 0
  for (const m of String(text).matchAll(RE)) {
    const word = m[1]
    const shown = m[0]
    // Units match exactly ("gb"/"Mb" are skipped); words match any case.
    const lower = word.toLowerCase()
    const hint = custom[lower] ?? UNITS[word] ?? WORDS[lower]
    if (!hint) continue
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: shown, hint })
    last = m.index + shown.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** Rows from GET /glossary: [{id, term, definition, example}] -> active custom terms. */
export function applyGlossary(rows) {
  custom = {}
  for (const r of rows || []) custom[r.term] = r.example ? `${r.definition}||${r.example}` : r.definition
  rebuild()
  listeners.forEach(fn => fn())
}

let loading = null
export function fetchGlossary({ fresh = false } = {}) {
  loading ||= fetch(`${API_BASE}/glossary`, fresh ? { cache: 'no-store' } : undefined)
    .then(r => (r.ok ? r.json() : []))
    .catch(() => [])
    .finally(() => { loading = null })
  return loading
}

async function write(url, init, fail) {
  const res = await fetch(`${API_BASE}${url}`, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || fail)
  applyGlossary(body)
  return body
}
export const saveGlossaryTerm = (t) => write('/admin/glossary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) }, 'Could not save the term.')
export const deleteGlossaryTerm = (id) => write(`/admin/glossary/${id}`, { method: 'DELETE' }, 'Could not delete the term.')

/** Call once in a component that renders answers: loads admin terms and re-renders when they arrive. */
let loaded = false
export function useGlossary() {
  const [, tick] = useReducer(x => x + 1, 0)
  useEffect(() => {
    listeners.add(tick)
    if (!loaded) { loaded = true; fetchGlossary().then(applyGlossary) }
    return () => listeners.delete(tick)
  }, [])
}
