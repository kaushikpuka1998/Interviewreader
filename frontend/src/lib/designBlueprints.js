export function designBlueprintFor(question) {
  const text = [question?.title, question?.description, question?.prompt, question?.body].filter(Boolean).join(' ').toLowerCase()
  const generic = {
    name: 'General high-scale system',
    summary: 'Balance traffic, protect reads, buffer writes, and shard durable storage as demand grows.',
    defaultStep: 1,
    components: ['Client', 'Gateway', 'Load-balancer', 'Service', 'Redis', 'CQRS', 'Read-replica', 'Queue', 'Database', 'Sharding', 'Monitoring'],
    positions: { Client: { x: 5, y: 47 }, Gateway: { x: 20, y: 47 }, 'Load-balancer': { x: 35, y: 47 }, Service: { x: 50, y: 47 }, Redis: { x: 50, y: 16 }, CQRS: { x: 66, y: 16 }, Database: { x: 78, y: 47 }, Queue: { x: 36, y: 76 }, 'Read-replica': { x: 60, y: 76 }, Sharding: { x: 78, y: 76 }, Monitoring: { x: 5, y: 16 } },
    edges: [['Client', 'Gateway'], ['Gateway', 'Load-balancer'], ['Load-balancer', 'Service'], ['Service', 'Redis'], ['Service', 'CQRS'], ['CQRS', 'Read-replica'], ['Service', 'Queue'], ['Queue', 'Database'], ['Service', 'Database'], ['Database', 'Sharding'], ['Service', 'Monitoring']]
  }
  const positionsFor = components => {
    const special = { 'WebSocket gateway': { x: 34, y: 47 }, Presence: { x: 34, y: 16 }, Fanout: { x: 50, y: 16 }, Kafka: { x: 50, y: 76 }, 'Asset storage': { x: 66, y: 16 }, Monitoring: { x: 5, y: 16 }, 'Rate limiter': { x: 34, y: 47 }, 'Upload service': { x: 35, y: 47 }, CDN: { x: 50, y: 16 }, 'Metadata DB': { x: 78, y: 47 }, 'Search API': { x: 35, y: 47 }, Indexer: { x: 50, y: 76 }, 'Search index': { x: 78, y: 47 }, Transcoder: { x: 50, y: 47 }, 'Geo index': { x: 50, y: 16 }, 'Location store': { x: 78, y: 47 }, 'Matching service': { x: 50, y: 76 }, 'Payment API': { x: 35, y: 47 }, 'Idempotency store': { x: 50, y: 16 }, 'Ledger DB': { x: 78, y: 47 }, 'Notification API': { x: 35, y: 47 }, 'Push gateway': { x: 66, y: 47 }, 'DLQ': { x: 66, y: 76 }, 'Collaboration service': { x: 50, y: 47 }, 'CRDT store': { x: 78, y: 47 }, PubSub: { x: 50, y: 76 } }
    return Object.fromEntries(components.map((type, index) => [type, generic.positions[type] || special[type] || { x: 18 + (index % 4) * 19, y: 18 + (Math.floor(index / 4) % 3) * 29 }]))
  }
  const makeBlueprint = (name, summary, components, edges, defaultStep = 3) => ({ name, summary, components, edges, defaultStep, positions: positionsFor(components) })
  if (/(url shortener|short url|tinyurl|bit\\.ly|bitly)/.test(text)) return {
    name: 'URL shortener',
    summary: 'Create short codes on the write path, persist mappings in PostgreSQL, serve redirects from Redis with a database fallback, and process click analytics asynchronously.',
    defaultStep: 3,
    components: ['Client', 'Load Balancer', 'URL Shortener Service', 'Redis Cache', 'Base62 Encoder', 'PostgreSQL', 'Click Event Queue', 'Analytics Store'],
    positions: {
      Client: { x: 3, y: 40 },
      'Load Balancer': { x: 20, y: 40 },
      'URL Shortener Service': { x: 38, y: 40 },
      'Redis Cache': { x: 58, y: 14 },
      'Base62 Encoder': { x: 58, y: 40 },
      PostgreSQL: { x: 78, y: 40 },
      'Click Event Queue': { x: 58, y: 69 },
      'Analytics Store': { x: 78, y: 69 },
    },
    edges: [
      ['Client', 'Load Balancer'],
      ['Load Balancer', 'URL Shortener Service'],
      ['URL Shortener Service', 'Redis Cache'],
      ['URL Shortener Service', 'Base62 Encoder'],
      ['Base62 Encoder', 'PostgreSQL'],
      ['URL Shortener Service', 'PostgreSQL'],
      ['URL Shortener Service', 'Click Event Queue'],
      ['Click Event Queue', 'Analytics Store'],
    ],
  }
  if (/(rate limiter|throttl|api gateway)/.test(text)) return makeBlueprint('Rate limiting / API protection', 'Apply a distributed rate limiter before application services; use Redis for counters and protect downstream systems.', ['Client', 'Gateway', 'Rate limiter', 'Redis', 'Service', 'Database', 'Monitoring'], [['Client', 'Gateway'], ['Gateway', 'Rate limiter'], ['Rate limiter', 'Redis'], ['Rate limiter', 'Service'], ['Service', 'Database'], ['Service', 'Monitoring']])
  if (/(s3|object storage|file upload|dropbox|drive|file system|blob)/.test(text)) return makeBlueprint('File and object storage', 'Store large content in Blob/Object storage, keep metadata separately, and move expensive processing off the upload path.', ['Client', 'Gateway', 'Upload service', 'Queue', 'Blob storage', 'Metadata DB', 'CDN', 'Monitoring'], [['Client', 'Gateway'], ['Gateway', 'Upload service'], ['Upload service', 'Blob storage'], ['Upload service', 'Metadata DB'], ['Upload service', 'Queue'], ['Queue', 'CDN'], ['Upload service', 'Monitoring']])
  if (/(search|autocomplete)/.test(text)) return makeBlueprint('Search and autocomplete', 'Separate synchronous search reads from asynchronous indexing; cache hot queries and stream document changes to the indexer.', ['Client', 'Gateway', 'Search API', 'Cache', 'Kafka', 'Indexer', 'Search index', 'Database', 'Monitoring'], [['Client', 'Gateway'], ['Gateway', 'Search API'], ['Search API', 'Cache'], ['Search API', 'Search index'], ['Database', 'Kafka'], ['Kafka', 'Indexer'], ['Indexer', 'Search index'], ['Search API', 'Monitoring']])
  if (/(youtube|video|live stream|streaming)/.test(text)) return makeBlueprint('Video and live streaming', 'Uploads land in object storage; asynchronous transcoders generate renditions and a CDN serves viewers globally.', ['Client', 'Gateway', 'Upload service', 'Blob storage', 'Kafka', 'Transcoder', 'CDN', 'Metadata DB', 'Monitoring'], [['Client', 'Gateway'], ['Gateway', 'Upload service'], ['Upload service', 'Blob storage'], ['Upload service', 'Metadata DB'], ['Upload service', 'Kafka'], ['Kafka', 'Transcoder'], ['Transcoder', 'CDN'], ['Upload service', 'Monitoring']])
  if (/(uber|ola|ride|gps|location|maps)/.test(text)) return makeBlueprint('Realtime location and dispatch', 'Ingest location updates through persistent connections, stream events, index by geography, and route drivers with a matching service.', ['Client', 'Gateway', 'WebSocket gateway', 'Kafka', 'Geo index', 'Redis', 'Location store', 'Matching service', 'Monitoring'], [['Client', 'Gateway'], ['Gateway', 'WebSocket gateway'], ['WebSocket gateway', 'Kafka'], ['Kafka', 'Geo index'], ['Kafka', 'Location store'], ['Matching service', 'Redis'], ['Matching service', 'Geo index'], ['WebSocket gateway', 'Monitoring']])
  if (/(payment|wallet|ledger|accounting)/.test(text)) return makeBlueprint('Payments and ledger', 'Make writes idempotent, publish durable payment events, and keep an immutable ledger separate from read models.', ['Client', 'Gateway', 'Payment API', 'Idempotency store', 'Kafka', 'Ledger DB', 'Queue', 'Monitoring'], [['Client', 'Gateway'], ['Gateway', 'Payment API'], ['Payment API', 'Idempotency store'], ['Payment API', 'Kafka'], ['Kafka', 'Ledger DB'], ['Payment API', 'Queue'], ['Payment API', 'Monitoring']])
  if (/(notification|email|sms|push)/.test(text)) return makeBlueprint('Notification delivery', 'Route events through a durable stream, isolate provider delivery, and keep a dead-letter path for retries and failures.', ['Client', 'Gateway', 'Notification API', 'Kafka', 'Push gateway', 'DLQ', 'Database', 'Monitoring'], [['Client', 'Gateway'], ['Gateway', 'Notification API'], ['Notification API', 'Kafka'], ['Kafka', 'Push gateway'], ['Push gateway', 'DLQ'], ['Notification API', 'Database'], ['Notification API', 'Monitoring']])
  if (/(google docs|collaborative editing|document collaboration)/.test(text)) return {
    name: 'Google Docs collaborative editing',
    summary: 'Editors route through a load balancer to HTTP and WebSocket gateways. The collaboration service fans out edits through Redis/PubSub, records a durable update log in PostgreSQL, and stores CRDT snapshots in object storage.',
    defaultStep: 3,
    components: ['Clients / Editors', 'Load Balancer', 'API Gateway', 'WebSocket Gateway', 'Collaboration Service', 'Update Log', 'Redis / PubSub', 'CRDT State', 'PostgreSQL', 'Object Storage'],
    positions: {
      'Clients / Editors': { x: 42, y: 3 },
      'Load Balancer': { x: 42, y: 18 },
      'API Gateway': { x: 8, y: 36 },
      'WebSocket Gateway': { x: 73, y: 36 },
      'Collaboration Service': { x: 42, y: 53 },
      'Update Log': { x: 5, y: 69 },
      'Redis / PubSub': { x: 40, y: 69 },
      'CRDT State': { x: 75, y: 69 },
      'PostgreSQL': { x: 5, y: 84 },
      'Object Storage': { x: 75, y: 84 },
    },
    edges: [
      ['Clients / Editors', 'Load Balancer'],
      ['Load Balancer', 'API Gateway'],
      ['Load Balancer', 'WebSocket Gateway'],
      ['API Gateway', 'Update Log'],
      ['WebSocket Gateway', 'Collaboration Service'],
      ['Collaboration Service', 'Update Log'],
      ['Collaboration Service', 'Redis / PubSub'],
      ['Collaboration Service', 'CRDT State'],
      ['Update Log', 'PostgreSQL'],
      ['CRDT State', 'Object Storage'],
    ],
  }
  if (/(google docs|collaborative|video conferencing|zoom)/.test(text)) return makeBlueprint('Realtime collaboration', 'Use persistent sessions, a collaboration service, pub/sub fanout, and a conflict-aware CRDT store for concurrent edits.', ['Client', 'Gateway', 'WebSocket gateway', 'Collaboration service', 'PubSub', 'CRDT store', 'Monitoring'], [['Client', 'Gateway'], ['Gateway', 'WebSocket gateway'], ['WebSocket gateway', 'Collaboration service'], ['Collaboration service', 'PubSub'], ['Collaboration service', 'CRDT store'], ['Collaboration service', 'Monitoring']])
  if (/(whatsapp|chat|messaging|messenger)/.test(text)) return {
    name: 'Realtime messaging / WhatsApp',
    summary: 'Persistent WebSocket delivery, online presence, fanout, a durable event stream, media storage, and observability.',
    defaultStep: 4,
    components: ['Client', 'Gateway', 'WebSocket gateway', 'Presence', 'Fanout', 'Kafka', 'Redis', 'Database', 'Sharding', 'Asset storage', 'Monitoring'],
    positions: { Client: { x: 5, y: 47 }, Gateway: { x: 19, y: 47 }, 'WebSocket gateway': { x: 34, y: 47 }, Presence: { x: 34, y: 16 }, Fanout: { x: 50, y: 47 }, Kafka: { x: 50, y: 76 }, Redis: { x: 66, y: 16 }, Database: { x: 79, y: 47 }, Sharding: { x: 79, y: 76 }, 'Asset storage': { x: 66, y: 76 }, Monitoring: { x: 5, y: 16 } },
    edges: [['Client', 'Gateway'], ['Gateway', 'WebSocket gateway'], ['WebSocket gateway', 'Presence'], ['WebSocket gateway', 'Fanout'], ['Fanout', 'Kafka'], ['Kafka', 'Database'], ['Fanout', 'Redis'], ['Database', 'Sharding'], ['WebSocket gateway', 'Asset storage'], ['WebSocket gateway', 'Monitoring']]
  }
  if (/(amazon|e-?commerce|marketplace|shopping|cart|order)/.test(text)) return {
    name: 'Marketplace / Amazon',
    summary: 'Browse-heavy catalog reads use cache and asset storage; orders use a queue and isolated durable writes.',
    defaultStep: 3,
    components: ['Client', 'Gateway', 'Load-balancer', 'Service', 'Redis', 'Queue', 'Database', 'Read-replica', 'Asset storage', 'Sharding', 'Monitoring'],
    positions: { Client: { x: 5, y: 47 }, Gateway: { x: 20, y: 47 }, 'Load-balancer': { x: 35, y: 47 }, Service: { x: 50, y: 47 }, Redis: { x: 50, y: 16 }, 'Asset storage': { x: 66, y: 16 }, Database: { x: 78, y: 47 }, Queue: { x: 35, y: 76 }, 'Read-replica': { x: 60, y: 76 }, Sharding: { x: 78, y: 76 }, Monitoring: { x: 5, y: 16 } },
    edges: [['Client', 'Gateway'], ['Gateway', 'Load-balancer'], ['Load-balancer', 'Service'], ['Service', 'Redis'], ['Service', 'Asset storage'], ['Service', 'Queue'], ['Queue', 'Database'], ['Service', 'Read-replica'], ['Database', 'Read-replica'], ['Database', 'Sharding'], ['Service', 'Monitoring']]
  }
  if (/(twitter|social|feed|timeline)/.test(text)) return {
    name: 'Social feed / Twitter',
    summary: 'Use fanout and a durable stream for posts, cache hot timelines, and separate read-heavy feed traffic.',
    defaultStep: 4,
    components: ['Client', 'Gateway', 'Load-balancer', 'Service', 'Fanout', 'Kafka', 'Redis', 'Read-replica', 'Database', 'Sharding', 'Monitoring'],
    positions: { Client: { x: 5, y: 47 }, Gateway: { x: 20, y: 47 }, 'Load-balancer': { x: 35, y: 47 }, Service: { x: 50, y: 47 }, Fanout: { x: 50, y: 16 }, Kafka: { x: 35, y: 76 }, Redis: { x: 66, y: 16 }, Database: { x: 78, y: 47 }, 'Read-replica': { x: 60, y: 76 }, Sharding: { x: 78, y: 76 }, Monitoring: { x: 5, y: 16 } },
    edges: [['Client', 'Gateway'], ['Gateway', 'Load-balancer'], ['Load-balancer', 'Service'], ['Service', 'Fanout'], ['Fanout', 'Kafka'], ['Kafka', 'Database'], ['Service', 'Redis'], ['Service', 'Read-replica'], ['Database', 'Read-replica'], ['Database', 'Sharding'], ['Service', 'Monitoring']]
  }
  return generic
}
