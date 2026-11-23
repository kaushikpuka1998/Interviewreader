// Groups for system design (HLD) questions: similar designs sit together, the basics come first.
// Matching is by title (first rule that matches wins), so it works for every HLD question without a database change.
// Each group has an icon (24x24 stroke path) for the grouped lists.
const I = {
  start: 'M5 3l14 9-14 9V3z',
  chat: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z',
  feed: 'M4 6h16M4 12h16M4 18h10',
  video: 'M3 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3zM17 10l4-2v8l-4-2',
  pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  search: 'M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6M9 20h.01M17 20h.01',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  gauge: 'M12 14l4-4M3.3 17a10 10 0 1 1 17.4 0',
  game: 'M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7A4.7 4.7 0 0 0 2 9.7V14a3 3 0 0 0 5.2 2l1-1.2h7.6l1 1.2A3 3 0 0 0 22 14V9.7A4.7 4.7 0 0 0 17.3 5z',
  shield: 'M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
}

export const HLD_GROUPS = [
  { name: 'Foundations & Warm-ups', icon: I.start, re: /url shortener|tinyurl|bit\.ly|pastebin|\bcrud\b|rate limit|id generator|unique id|snowflake|hit counter|to-?do|key-?value|distributed cache|design a cache|lru|management system|parking lot|library management|task management|contact management|employee management/ },
  { name: 'Video, Audio & Live', icon: I.video, re: /youtube|netflix|zoom|video|streaming platform|spotify|music|podcast|twitch|tiktok|live stream|conferenc|\bmeet\b|hotstar|prime video/ },
  { name: 'Chat & Presence', icon: I.chat, re: /whatsapp|messenger|chat|slack|discord|telegram|signal|presence|ephemeral|snapchat|instant messag|websocket|online\/offline|user status|gmail/ },
  { name: 'Feeds & Social Graphs', icon: I.feed, re: /facebook|instagram|twitter|\bx\b|linkedin|news feed|\bfeed\b|social|reddit|community|pinterest|photo sharing|follow|comment|quora|stack overflow|medium|blog/ },
  { name: 'Maps, Rides & Dispatch', icon: I.pin, re: /uber|lyft|\bola\b|\bmaps?\b|\blocation|nearby|proximity|yelp|dispatch|delivery|doordash|swiggy|zomato|food|ride|driver|geo|tracking|fleet/ },
  { name: 'Search & Discovery', icon: I.search, re: /search|autocomplete|typeahead|recommend|ranking|crawler|trending|top[- ]k|suggest/ },
  { name: 'Payments & Ledgers', icon: I.card, re: /payment|wallet|upi|bank|ledger|billing|invoice|refund|fraud|remittance|paypal|money|credit-card|financial|transaction history|double-entry|accounting|stripe|reconcil|subscription|stock|trading|\bsip\b|account and transfer/ },
  { name: 'Shopping & Bookings', icon: I.cart, re: /e-?commerce|amazon|flipkart|cart|checkout|\borders?\b|order management|inventory|flash sale|ticket|booking|airbnb|hotel|reservation|calendar|coupon|auction|marketplace|grocery|property listing|travel/ },
  { name: 'Files, Storage & Sync', icon: I.folder, re: /drive|dropbox|storage|file|upload|\bs3\b|object store|backup|\bsync\b|\bcdn\b|blob|photo storage|content-addressed/ },
  { name: 'Events, Streams & Messaging', icon: I.bolt, re: /kafka|queue|message|event|exactly-once|at-least-once|processing|pub-?sub|stream|pipeline|saga|cqrs|outbox|webhook|notification|email|\bsms\b|scheduler|\bjobs?\b|\bcron\b|dead-letter|retry|delay|idempot|publish-subscribe|rabbitmq|change-data-capture|workflow|orchestrat/ },
  { name: 'Data Stores & Consensus', icon: I.db, re: /database|\bkv\b|shard|replicat|consensus|raft|paxos|distributed lock|\block\b|time-?series|\bindex\b|lsm|b-?tree|schema|migration|leader election|leader-election|partition|quorum|cap theorem|consistency|\bap system|\bcp system|zookeeper|distributed transaction|two-phase|2pc|consistent hashing|semaphore|\blease|sequence generator|distributed counter|conflict resolution|read replicas|read\/write|polyglot|archiving/ },
  { name: 'Identity & Access', icon: I.shield, re: /auth|oauth|openid|\biam\b|rbac|abac|password|api key|login|\bsso\b|identity/ },
  { name: 'Platform & Reliability', icon: I.gauge, re: /monitor|metric|logging|\blogs?\b|tracing|observab|deploy|feature flag|config|service discovery|load balanc|api gateway|autoscal|multi-?region|failover|disaster|circuit|throttl|health[- ]check|active-(active|passive)|five-nines|region failure|service mesh|\bbff\b|backend-for-frontend|serverless|container|multi-tenant|tenant|cloud platform|traffic routing|global api/ },
  { name: 'Games, Ads & Live Data', icon: I.game, re: /game|leaderboard|\bads?\b|advert|bidding|\bscore|market data|multiplayer|polling|voting|rating|real-?time/ },
]
export const HLD_OTHER = { name: 'More Designs', icon: I.grid }

const clean = t => String(t || '').toLowerCase().replace(/high-level design \(hld\)\s*-+\s*/g, '').replace(/design (a |an |the )?/g, '')

/** The group a design question belongs to. */
export function hldGroupOf(title) {
  const t = clean(title)
  return HLD_GROUPS.find(g => g.re.test(t)) || HLD_OTHER
}

/** Items split into groups in the fixed order above; empty groups are left out. */
export function groupHld(items, titleOf = x => x.title) {
  const by = new Map()
  for (const x of items) {
    const g = hldGroupOf(titleOf(x))
    if (!by.has(g.name)) by.set(g.name, { ...g, items: [] })
    by.get(g.name).items.push(x)
  }
  return [...HLD_GROUPS, HLD_OTHER].map(g => by.get(g.name)).filter(Boolean)
}
