import { ANSWERS } from './designBlueprintAnswers.js'

// Per-question reference architectures for the system-design practice canvas.
// Each entry: [title regex, name, one-line summary, columns (left → right), links].
// Links are chains: 'A>B>C' draws A→B and B→C. Positions are laid out from the columns,
// so every design gets its own shape instead of one shared template.
// Order matters: the first regex that matches the question title wins.
const C = [
  // ── Per-question designs taken from each answer's own architecture ──
  [/^design facebook/, 'Facebook', 'Requests hit the web/API tier, then a huge memcached tier that fronts the sharded social graph (TAO-style) and the ML feed-ranking service. Media is served from the CDN and privacy rules are checked on every query.',
    [['Client'], ['Web / API Tier'], ['Memcached Tier'], ['Social Graph (TAO, sharded)', 'Feed Ranking Service (ML)'], ['CDN (media)', 'Privacy Rules Check']],
    ['Client>Web / API Tier>Memcached Tier>Social Graph (TAO, sharded)', 'Memcached Tier>Feed Ranking Service (ML)', 'Client>CDN (media)', 'Web / API Tier>Privacy Rules Check']],
  [/^design uber/, 'Uber', 'Drivers publish location every few seconds into a geo index (geohash/H3). The matching service queries nearby drivers, hands the match to the trip service (state machine, fare, surge), which drives payment and Kafka events.',
    [['Rider App', 'Driver App'], ['Matching Service', 'Location Service (geo index)'], ['Trip Service'], ['Payment Service', 'Kafka Trip Events']],
    ['Rider App>Matching Service', 'Driver App>Location Service (geo index)', 'Matching Service>Location Service (geo index)', 'Matching Service>Trip Service>Payment Service', 'Trip Service>Kafka Trip Events']],
  [/^design google drive/, 'Google Drive', 'Clients hash chunks and sync deltas. The sync service stores deduplicated chunks in object storage, keeps the tree, permissions and versions in a sharded metadata DB, and pushes changes to other devices.',
    [['Client (multi-device)'], ['Sync Service'], ['Object Storage (chunks, dedup)', 'Metadata DB (sharded)'], ['CDN (downloads)', 'Sharing ACL Service', 'Other Devices']],
    ['Client (multi-device)>Sync Service>Object Storage (chunks, dedup)', 'Sync Service>Metadata DB (sharded)', 'Sync Service>Other Devices', 'Object Storage (chunks, dedup)>CDN (downloads)', 'Metadata DB (sharded)>Sharing ACL Service']],
  [/^design discord/, 'Discord', 'Text goes over WebSocket gateways to the message service, which writes to Cassandra (sharded by channel) and fans out to online members. Voice and video go over WebRTC to an SFU.',
    [['Client'], ['Text Gateway', 'Voice SFU'], ['Message Service'], ['Cassandra (by channel)', 'Online Members Fan-out', 'Roles & Permissions']],
    ['Client>Text Gateway>Message Service>Cassandra (by channel)', 'Client>Voice SFU', 'Message Service>Online Members Fan-out', 'Message Service>Roles & Permissions']],
  [/^design zoom/, 'Zoom', 'Participants set up sessions through signaling (SDP/ICE), then send one upstream to a regional SFU that forwards to the others and to recording. STUN/TURN handles hard networks.',
    [['Participant'], ['Signaling Service', 'STUN / TURN'], ['Regional SFU'], ['Other Participants', 'Recording Service']],
    ['Participant>Signaling Service>Regional SFU', 'Participant>STUN / TURN>Regional SFU', 'Regional SFU>Other Participants', 'Regional SFU>Recording Service']],
  [/^design tiktok/, 'TikTok', 'Uploads are transcoded and served from the CDN. The For You feed comes from a recommendation engine: precomputed candidates re-ranked in real time, fed by engagement events through Kafka.',
    [['Client'], ['Upload & Transcode', 'Recommendation Engine (ML)'], ['CDN', 'Candidates + Real-time Re-rank', 'Kafka Engagement Events']],
    ['Client>Upload & Transcode>CDN', 'Client>Recommendation Engine (ML)>Candidates + Real-time Re-rank', 'Client>Kafka Engagement Events>Recommendation Engine (ML)']],
  [/^design linkedin/, 'LinkedIn', 'The gateway fans out to the profile DB, a graph engine for connection degrees, the feed service and search with job matching. People You May Know is precomputed from the graph plus ML.',
    [['Client'], ['API Gateway'], ['Profile DB', 'Graph Engine (degrees)', 'Feed Service', 'Search (ES) + Jobs'], ['PYMK Precompute (graph + ML)']],
    ['Client>API Gateway>Profile DB', 'API Gateway>Graph Engine (degrees)>PYMK Precompute (graph + ML)', 'API Gateway>Feed Service', 'API Gateway>Search (ES) + Jobs']],
  [/^design airbnb/, 'Airbnb', 'Guests search by geo and dates against a cached index. Booking is transactional (it locks the date range), writes the listing calendar and payment with host/platform escrow, and reviews and messaging sit alongside.',
    [['Guest'], ['Search (geo + dates)'], ['Booking Service'], ['Listing / Calendar DB', 'Payment (escrow split)', 'Reviews & Messaging']],
    ['Guest>Search (geo + dates)>Booking Service>Listing / Calendar DB', 'Search (geo + dates)>Listing / Calendar DB', 'Booking Service>Payment (escrow split)', 'Guest>Reviews & Messaging']],
  [/^design instagram/, 'Instagram', 'Services own metadata and social actions while object storage and the CDN carry the media. Posts publish to Kafka, the feed service reads caches and post metadata, and search runs on its own index.',
    [['Web / Mobile Clients'], ['Load Balancer', 'CDN'], ['API Gateway'], ['User Service', 'Post Service', 'Feed Service', 'Engagement Service', 'Search Service'], ['Feed Cache', 'Kafka Queue'], ['User DB', 'Post Metadata DB', 'Engagement DB', 'Search Index', 'Object Storage']],
    ['Web / Mobile Clients>Load Balancer>API Gateway>User Service>User DB', 'API Gateway>Post Service>Post Metadata DB', 'Post Service>Object Storage', 'Post Service>Kafka Queue', 'API Gateway>Feed Service>Feed Cache', 'Feed Service>Kafka Queue', 'Feed Service>Post Metadata DB', 'API Gateway>Engagement Service>Engagement DB', 'Engagement Service>Kafka Queue', 'API Gateway>Search Service>Search Index', 'Web / Mobile Clients>CDN>Object Storage']],
  [/^design netflix/, 'Netflix', 'Three paths: ingestion (upload → raw storage → job queue → transcoders → encoded origin), discovery services behind the gateway, and delivery from a global CDN. Playback checks DRM.',
    [['Clients'], ['API Gateway', 'Global CDN'], ['Catalog Service', 'Recommendation Service', 'Playback Service', 'Upload Service'], ['Redis + PostgreSQL', 'Cassandra', 'DRM Service', 'Raw Storage'], ['Job Queue', 'Transcoding Workers'], ['Encoded Origin Storage']],
    ['Clients>API Gateway>Catalog Service>Redis + PostgreSQL', 'API Gateway>Recommendation Service>Cassandra', 'API Gateway>Playback Service>Redis + PostgreSQL', 'Playback Service>DRM Service', 'API Gateway>Upload Service>Raw Storage>Job Queue>Transcoding Workers>Encoded Origin Storage', 'Clients>Global CDN>Encoded Origin Storage']],

  // ── Flagship products ──────────────────────────────────────────────
  [/twitter/, 'Twitter / X', 'Tweets are written once and streamed to fan-out workers that fill follower timeline caches. Celebrity accounts are merged at read time, and search and trending consume the same stream.',
    [['Client'], ['API Gateway'], ['Tweet Service', 'Timeline Service', 'Graph Service'], ['Tweet Stream (Kafka)', 'Timeline Cache', 'Follower Graph DB'], ['Fan-out Workers', 'Tweet Store', 'Search & Trending']],
    ['Client>API Gateway>Tweet Service>Tweet Stream (Kafka)>Fan-out Workers>Timeline Cache', 'Tweet Service>Tweet Store', 'API Gateway>Timeline Service>Timeline Cache', 'Timeline Service>Tweet Store', 'API Gateway>Graph Service>Follower Graph DB', 'Fan-out Workers>Follower Graph DB', 'Tweet Stream (Kafka)>Search & Trending']],
  [/whatsapp/, 'WhatsApp', 'Phones hold a persistent connection to a gateway. Messages are queued per recipient and stored until delivery, groups fan out in the chat tier, and offline users get a push.',
    [['Mobile Client'], ['Connection Gateway'], ['Chat Service', 'Presence Service', 'Media Service'], ['Per-user Message Queue', 'Presence Cache', 'Media Storage (S3)'], ['Message Store', 'Push Gateway (APNs/FCM)', 'Group Fan-out']],
    ['Mobile Client>Connection Gateway>Chat Service>Per-user Message Queue>Message Store', 'Chat Service>Group Fan-out>Per-user Message Queue', 'Connection Gateway>Presence Service>Presence Cache', 'Connection Gateway>Media Service>Media Storage (S3)', 'Per-user Message Queue>Push Gateway (APNs/FCM)>Mobile Client']],

  // ── Messaging & Kafka ──────────────────────────────────────────────
  [/consumer group|consumer scaling/, 'Consumer group scaling', 'Partitions cap parallelism. Consumers in a group split them, offsets are committed after processing, and consumer lag drives autoscaling.',
    [['Producers'], ['Topic Partitions'], ['Consumer Group A', 'Consumer Group B'], ['Worker Pool', 'Offset Store'], ['Lag Monitor', 'Autoscaler']],
    ['Producers>Topic Partitions>Consumer Group A>Worker Pool>Offset Store', 'Topic Partitions>Consumer Group B', 'Offset Store>Lag Monitor>Autoscaler>Consumer Group A']],
  [/partitioning strategy|kafka.*partition/, 'Partition key strategy', 'Pick the key so related events land on one partition. Salt hot keys and keep the partition count fixed to protect ordering.',
    [['Producers'], ['Partitioner'], ['Partition 0', 'Partition 1', 'Partition 2'], ['Consumers'], ['Hot-key Monitor']],
    ['Producers>Partitioner>Partition 0>Consumers', 'Partitioner>Partition 1>Consumers', 'Partitioner>Partition 2>Consumers', 'Partitioner>Hot-key Monitor']],
  [/dead-letter|dead letter|\bdlq\b/, 'Dead-letter handling', 'Failed messages leave the main flow after N attempts, keep their error context, and wait in a dead-letter queue for triage and redrive.',
    [['Producers'], ['Main Topic'], ['Consumer'], ['Retry Policy', 'Dead-letter Queue'], ['Alerting', 'Redrive Tool']],
    ['Producers>Main Topic>Consumer>Retry Policy>Main Topic', 'Retry Policy>Dead-letter Queue>Alerting', 'Dead-letter Queue>Redrive Tool>Main Topic']],
  [/retry|delayed message/, 'Retry and delay tiers', 'Failures hop through delay topics with growing back-off. The main partition never blocks, and exhausted messages end in a dead-letter topic.',
    [['Producers'], ['Main Topic'], ['Consumer'], ['Retry 1m', 'Retry 10m', 'Retry 1h'], ['Dead-letter Topic']],
    ['Producers>Main Topic>Consumer>Retry 1m>Retry 10m>Retry 1h>Dead-letter Topic', 'Retry 1m>Consumer']],
  [/message ordering|ordering/, 'Ordering guarantees', 'Order only exists within a partition. Key by entity, use an idempotent producer, and process one partition per thread.',
    [['Producers'], ['Idempotent Producer'], ['Keyed Partitions'], ['Single-thread Consumer'], ['Sequence Checker', 'Gap Alerts']],
    ['Producers>Idempotent Producer>Keyed Partitions>Single-thread Consumer>Sequence Checker>Gap Alerts']],
  [/disaster recovery.*kafka|cross-region kafka|kafka disaster/, 'Kafka cross-region replication', 'Mirror topics asynchronously to a standby cluster, translate consumer offsets, and rehearse failover.',
    [['Producers'], ['Primary Cluster'], ['Mirror Link', 'Offset Translator'], ['Standby Cluster'], ['DR Consumers', 'Failover Runbook']],
    ['Producers>Primary Cluster>Mirror Link>Standby Cluster>DR Consumers', 'Primary Cluster>Offset Translator>Standby Cluster', 'Standby Cluster>Failover Runbook']],
  [/schema registry|event versioning|schema evolution/, 'Schema registry and evolution', 'Producers register schemas, the registry enforces compatibility, and consumers resolve a schema by ID and cache it.',
    [['Producers'], ['Schema Registry'], ['Compatibility Check', 'Schema Cache'], ['Topic'], ['Consumers']],
    ['Producers>Schema Registry>Compatibility Check', 'Producers>Topic>Consumers', 'Consumers>Schema Cache>Schema Registry']],
  [/outbox|change-data-capture|\bcdc\b/, 'Outbox and change data capture', 'State and event commit in one transaction. A CDC connector reads the log and publishes, so consumers dedupe.',
    [['Order Service'], ['Orders Table', 'Outbox Table'], ['CDC Connector'], ['Event Topic'], ['Consumers', 'Dedup Store']],
    ['Order Service>Orders Table', 'Order Service>Outbox Table>CDC Connector>Event Topic>Consumers>Dedup Store']],
  [/exactly-once|at-least-once|at-most-once|duplicate-event/, 'Delivery semantics', 'Choose where duplicates or losses are tolerated: commit offsets after processing, dedupe by event ID, and fence zombie producers.',
    [['Producers'], ['Transactional Producer'], ['Topic'], ['Idempotent Consumer', 'Dedup Store'], ['Sink DB']],
    ['Producers>Transactional Producer>Topic>Idempotent Consumer>Sink DB', 'Idempotent Consumer>Dedup Store']],
  [/kafka-based cache invalidation/, 'Event-driven cache invalidation', 'Writers publish change events, invalidators delete keys per region, and a TTL bounds staleness if an event is lost.',
    [['Writers'], ['Primary DB'], ['Change Topic'], ['Invalidator'], ['Regional Cache', 'TTL Safety Net']],
    ['Writers>Primary DB>Change Topic>Invalidator>Regional Cache', 'Regional Cache>TTL Safety Net']],
  [/saga orchestration|saga choreography|saga/, 'Saga with compensations', 'A saga splits a distributed transaction into local steps, and every step has a compensating action for rollback.',
    [['Client'], ['Saga Orchestrator'], ['Order Service', 'Payment Service', 'Inventory Service'], ['Event Bus'], ['Saga State Store', 'Compensation Handler']],
    ['Client>Saga Orchestrator>Order Service>Event Bus', 'Saga Orchestrator>Payment Service>Event Bus', 'Saga Orchestrator>Inventory Service>Event Bus', 'Saga Orchestrator>Saga State Store', 'Event Bus>Compensation Handler>Saga Orchestrator']],
  [/event sourcing|event replay/, 'Event sourcing with replay', 'Append events immutably, rebuild state with snapshots, and replay into a new consumer group to repair projections.',
    [['Command API'], ['Event Store'], ['Snapshot Store', 'Event Stream'], ['Projection Builder'], ['Read Model', 'Replay Tool']],
    ['Command API>Event Store>Event Stream>Projection Builder>Read Model', 'Event Store>Snapshot Store>Projection Builder', 'Replay Tool>Event Stream']],
  [/cqrs/, 'CQRS', 'Writes go through a validated model; events update denormalized read stores. Queries never touch the write model.',
    [['Client'], ['Command API', 'Query API'], ['Write Model'], ['Event Bus'], ['Read Store']],
    ['Client>Command API>Write Model>Event Bus>Read Store', 'Client>Query API>Read Store']],
  [/event-driven order|event-driven architecture|microservice communication/, 'Event-driven order flow', 'Services publish facts, not calls. The order, payment, inventory and shipping services react through topics, and the outbox prevents lost events.',
    [['Client'], ['Order Service'], ['Order Events'], ['Payment Service', 'Inventory Service', 'Shipping Service'], ['Status Read Model']],
    ['Client>Order Service>Order Events>Payment Service', 'Order Events>Inventory Service', 'Order Events>Shipping Service', 'Payment Service>Status Read Model', 'Inventory Service>Status Read Model', 'Shipping Service>Status Read Model']],
  [/analytics pipeline|real-time analytics|real-time dashboard|metrics collection/, 'Streaming analytics pipeline', 'Events stream into a processor with windows, pre-aggregated rollups land in an OLAP store, and dashboards read the rollups.',
    [['Event Sources'], ['Ingest Topic'], ['Stream Processor'], ['Rollup Store', 'Raw Archive'], ['Dashboard API']],
    ['Event Sources>Ingest Topic>Stream Processor>Rollup Store>Dashboard API', 'Stream Processor>Raw Archive']],
  [/logging pipeline|logging system|log aggregation/, 'Log aggregation', 'Agents ship structured logs into a buffer topic, indexers batch them into searchable storage, and old data tiers to cheap storage.',
    [['App Hosts'], ['Log Agent'], ['Buffer Topic'], ['Indexer'], ['Search Index', 'Cold Archive']],
    ['App Hosts>Log Agent>Buffer Topic>Indexer>Search Index', 'Indexer>Cold Archive']],
  [/distributed tracing/, 'Distributed tracing', 'Services propagate a trace ID, collectors sample spans into a store, and the UI stitches them into a request timeline.',
    [['Instrumented Services'], ['Trace Collector'], ['Sampler'], ['Span Store'], ['Trace Query API', 'Service Map']],
    ['Instrumented Services>Trace Collector>Sampler>Span Store>Trace Query API', 'Span Store>Service Map']],
  [/kafka-like|message broker|rabbitmq|publish-subscribe|message queue|task queue|retry queue/, 'Message broker internals', 'Producers append to partitioned logs that are replicated across brokers. Consumers pull by offset, and a coordinator tracks groups.',
    [['Producers'], ['Broker Cluster'], ['Partition Log', 'Replica Log'], ['Consumers'], ['Group Coordinator', 'Offset Store']],
    ['Producers>Broker Cluster>Partition Log>Consumers', 'Partition Log>Replica Log', 'Consumers>Group Coordinator>Offset Store', 'Broker Cluster>Group Coordinator']],
  [/webhook/, 'Webhook delivery', 'Events fan out to per-endpoint queues, deliveries are signed and retried with back-off, and failing endpoints are paused.',
    [['Event Producer'], ['Event Topic'], ['Delivery Workers'], ['Signed HTTP Delivery', 'Retry Queue'], ['Customer Endpoint', 'Delivery Log']],
    ['Event Producer>Event Topic>Delivery Workers>Signed HTTP Delivery>Customer Endpoint', 'Delivery Workers>Retry Queue>Delivery Workers', 'Signed HTTP Delivery>Delivery Log']],

  // ── Notifications ──────────────────────────────────────────────────
  [/real-time notification/, 'Real-time notifications', 'A persistent connection delivers instantly. Offline users fall back to mobile push, and the client acknowledges for at-least-once delivery.',
    [['Client'], ['WebSocket Gateway'], ['Connection Registry', 'Notification Bus'], ['Delivery Service'], ['Mobile Push Fallback', 'Unread Store']],
    ['Client>WebSocket Gateway>Connection Registry>Delivery Service', 'Notification Bus>Delivery Service>WebSocket Gateway', 'Delivery Service>Mobile Push Fallback', 'Delivery Service>Unread Store']],
  [/financial notification/, 'Financial notification service', 'Transactional alerts are never dropped: events are audited, sent on the right channel, retried with proof of delivery, and rate-limited for marketing.',
    [['Ledger Events'], ['Alert Rules'], ['Priority Queue'], ['Channel Router'], ['SMS / Push / Email', 'Audit Trail']],
    ['Ledger Events>Alert Rules>Priority Queue>Channel Router>SMS / Push / Email', 'Channel Router>Audit Trail']],
  [/email sending|sms sending/, 'Email / SMS sending', 'Requests are templated and queued, workers send through a provider with bounce handling, and suppression lists prevent repeat sends.',
    [['Client'], ['Send API'], ['Template Service', 'Suppression List'], ['Send Queue'], ['Provider Workers', 'Bounce Handler']],
    ['Client>Send API>Template Service>Send Queue>Provider Workers', 'Send API>Suppression List', 'Provider Workers>Bounce Handler>Suppression List']],
  [/notification/, 'Notification service', 'Producers call one API, preferences and dedup run first, priority queues feed per-channel workers, and failures go to a dead-letter queue.',
    [['Producer Services'], ['Notification API'], ['Preference Store', 'Dedup Cache', 'Priority Queue'], ['Push Worker', 'Email Worker', 'SMS Worker'], ['Provider Gateway', 'Delivery Log', 'Dead-letter Queue']],
    ['Producer Services>Notification API>Preference Store', 'Notification API>Dedup Cache', 'Notification API>Priority Queue>Push Worker>Provider Gateway', 'Priority Queue>Email Worker>Provider Gateway', 'Priority Queue>SMS Worker>Provider Gateway', 'Provider Gateway>Delivery Log', 'Priority Queue>Dead-letter Queue']],

  // ── Payments & money ───────────────────────────────────────────────
  [/payment idempotency|idempotent payment/, 'Idempotent payment API', 'Every request carries an idempotency key. The first execution stores its result, and retries return it instead of charging again.',
    [['Client'], ['API Gateway'], ['Idempotency Store'], ['Payment Service'], ['Ledger DB', 'Processor']],
    ['Client>API Gateway>Idempotency Store>Payment Service>Ledger DB', 'Payment Service>Processor']],
  [/payment failure|payment retries/, 'Payment failure recovery', 'Payments are a state machine. Timeouts trigger a status query, retries use the same idempotency key, and unresolved items go to reconciliation.',
    [['Payment API'], ['Payment State Machine'], ['Processor Client', 'Retry Scheduler'], ['Status Poller'], ['Ledger DB', 'Reconciliation Queue']],
    ['Payment API>Payment State Machine>Processor Client>Status Poller>Ledger DB', 'Payment State Machine>Retry Scheduler>Processor Client', 'Status Poller>Reconciliation Queue']],
  [/refund/, 'Refund system', 'Refunds reference the original charge, are validated against the refundable balance, executed idempotently, and post compensating ledger entries.',
    [['Support / Customer'], ['Refund API'], ['Eligibility Check'], ['Refund Worker', 'Processor'], ['Ledger DB', 'Customer Notification']],
    ['Support / Customer>Refund API>Eligibility Check>Refund Worker>Processor', 'Refund Worker>Ledger DB', 'Refund Worker>Customer Notification']],
  [/reconciliation/, 'Payment reconciliation', 'Internal ledger entries are matched against processor settlement files. Mismatches become exceptions with an audit trail.',
    [['Ledger DB', 'Processor Settlement Files'], ['Ingestion Jobs'], ['Matching Engine'], ['Exception Queue', 'Reconciled Records'], ['Ops Console']],
    ['Ledger DB>Ingestion Jobs>Matching Engine', 'Processor Settlement Files>Ingestion Jobs', 'Matching Engine>Exception Queue>Ops Console', 'Matching Engine>Reconciled Records']],
  [/subscription billing|recurring payment|invoice/, 'Recurring billing', 'A scheduler creates invoices on cycle dates, charges idempotently, retries failed cards with dunning, and sends receipts.',
    [['Plan Catalog', 'Billing Scheduler'], ['Invoice Service'], ['Charge Worker', 'Dunning Scheduler'], ['Payment Gateway'], ['Ledger DB', 'Receipt Mailer']],
    ['Billing Scheduler>Invoice Service>Charge Worker>Payment Gateway>Ledger DB', 'Plan Catalog>Invoice Service', 'Charge Worker>Dunning Scheduler>Charge Worker', 'Payment Gateway>Receipt Mailer']],
  [/fraud/, 'Fraud detection', 'Transactions are scored in the request path with cached features, risky ones go to a review queue, and models retrain from labeled outcomes.',
    [['Payment API'], ['Risk Scoring Service'], ['Feature Store', 'Rules Engine'], ['Decision Topic'], ['Manual Review Queue', 'Model Training']],
    ['Payment API>Risk Scoring Service>Feature Store', 'Risk Scoring Service>Rules Engine', 'Risk Scoring Service>Decision Topic>Manual Review Queue', 'Decision Topic>Model Training>Feature Store']],
  [/double-entry|ledger|transaction history/, 'Double-entry ledger', 'Every transfer posts balanced debit and credit entries in one transaction. The ledger is append-only, and balances are derived views.',
    [['Money Movement API'], ['Posting Service'], ['Journal (Append-only)'], ['Balance Projection', 'Audit Export'], ['Statement Service']],
    ['Money Movement API>Posting Service>Journal (Append-only)>Balance Projection>Statement Service', 'Journal (Append-only)>Audit Export']],
  [/upi/, 'UPI-style payments', 'A PSP app routes a collect or pay request through a central switch, the issuer and beneficiary banks settle, and the switch keeps the state.',
    [['Payer App'], ['PSP Backend'], ['Payment Switch'], ['Payer Bank', 'Beneficiary Bank'], ['Settlement Ledger']],
    ['Payer App>PSP Backend>Payment Switch>Payer Bank>Settlement Ledger', 'Payment Switch>Beneficiary Bank>Settlement Ledger']],
  [/international remittance/, 'International remittance', 'Compliance screening runs before a locked FX quote, funds are held in escrow, and a payout partner delivers in the destination currency.',
    [['Sender App'], ['Compliance Screening'], ['FX Quote Service'], ['Escrow Ledger'], ['Payout Partner', 'Receiver Notification']],
    ['Sender App>Compliance Screening>FX Quote Service>Escrow Ledger>Payout Partner', 'Payout Partner>Receiver Notification']],
  [/paypal|stripe|payment gateway|payment processing|payment infra/, 'Payment gateway', 'The merchant API tokenizes cards, runs risk checks, routes to an acquirer, and writes an immutable ledger. Webhooks report the outcome.',
    [['Merchant Client'], ['Payment API'], ['Tokenization Vault', 'Risk Engine'], ['Acquirer Router'], ['Ledger DB', 'Webhook Dispatcher']],
    ['Merchant Client>Payment API>Tokenization Vault', 'Payment API>Risk Engine', 'Payment API>Acquirer Router>Ledger DB', 'Ledger DB>Webhook Dispatcher>Merchant Client']],
  [/banking|credit-card|money-transfer|financial transaction|wallet/, 'Account and transfer system', 'Transfers lock accounts in a consistent order, post balanced entries in one transaction, and publish events for statements and alerts.',
    [['Client'], ['API Gateway'], ['Transfer Service'], ['Account DB', 'Idempotency Store'], ['Event Topic', 'Fraud Check']],
    ['Client>API Gateway>Transfer Service>Account DB', 'Transfer Service>Idempotency Store', 'Transfer Service>Fraud Check', 'Account DB>Event Topic']],

  // ── Social, media, messaging products ──────────────────────────────
  [/instagram|photo storage|image upload|pinterest/, 'Photo sharing', 'Uploads go straight to object storage, async workers make resized variants, the CDN serves images, and the feed is built from a graph.',
    [['Mobile Client'], ['Upload API'], ['Object Storage', 'Metadata DB'], ['Image Resizer', 'Feed Builder'], ['CDN']],
    ['Mobile Client>Upload API>Object Storage>Image Resizer>CDN', 'Upload API>Metadata DB>Feed Builder', 'Mobile Client>CDN']],
  [/zoom|google meet|video conferencing/, 'Video conferencing', 'Signaling sets up sessions, an SFU forwards media between participants, TURN relays blocked networks, and recording goes to storage.',
    [['Client'], ['Signaling Server'], ['Room Service', 'TURN Relay'], ['SFU Media Servers'], ['Recording Storage']],
    ['Client>Signaling Server>Room Service>SFU Media Servers>Recording Storage', 'Client>TURN Relay>SFU Media Servers']],
  [/youtube/, 'YouTube', 'Uploads land in raw object storage, an event starts the transcode farm (multiple renditions as HLS/DASH segments), segments are served through the CDN with adaptive bitrate, and metadata, search, recommendations and view counters hang off the pipeline.',
    [['Uploader'], ['Raw Object Storage'], ['Transcode Farm'], ['Segment Object Storage', 'Metadata DB (sharded)'], ['CDN', 'Search (Elasticsearch)', 'Recommendations (ML)'], ['Viewer', 'View Counter (distributed)']],
    ['Uploader>Raw Object Storage>Transcode Farm>Segment Object Storage>CDN>Viewer', 'Transcode Farm>Metadata DB (sharded)', 'Metadata DB (sharded)>Search (Elasticsearch)', 'Metadata DB (sharded)>Recommendations (ML)', 'Viewer>View Counter (distributed)']],
  [/tiktok|netflix|spotify|video|live-streaming|twitch|live stream/, 'Streaming platform', 'Uploads land in object storage, transcoders produce adaptive renditions, the CDN serves segments, and recommendations run separately.',
    [['Client'], ['API Gateway', 'CDN'], ['Upload Service', 'Playback Service'], ['Transcoder', 'Recommendation Service'], ['Object Storage', 'Metadata DB']],
    ['Client>API Gateway>Upload Service>Object Storage>Transcoder>Object Storage', 'Client>CDN>Object Storage', 'API Gateway>Playback Service>Metadata DB', 'Playback Service>Recommendation Service']],
  [/reddit/, 'Community and voting', 'Posts and comments live in sharded storage, votes are counted asynchronously, and ranking jobs write hot lists to cache.',
    [['Client'], ['API Gateway'], ['Post Service', 'Vote Service'], ['Vote Counter Queue', 'Ranking Job'], ['Post DB', 'Hot List Cache']],
    ['Client>API Gateway>Post Service>Post DB', 'API Gateway>Vote Service>Vote Counter Queue>Ranking Job>Hot List Cache', 'Hot List Cache>Post Service']],
  [/linkedin|facebook/, 'Social graph and feed', 'A graph store holds the connections, posts fan out to feeds, and a ranker orders a candidate set using cached features.',
    [['Client'], ['API Gateway'], ['Profile Service', 'Feed Service'], ['Graph Store', 'Feed Cache', 'Ranker'], ['Post Store']],
    ['Client>API Gateway>Profile Service>Graph Store', 'API Gateway>Feed Service>Feed Cache', 'Feed Service>Ranker>Post Store', 'Feed Service>Graph Store']],
  [/snapchat/, 'Ephemeral messaging', 'Snaps are uploaded to encrypted storage with a TTL, recipients get a push, and a viewed event triggers deletion.',
    [['Mobile Client'], ['Snap API'], ['Encrypted Blob Store', 'Delivery Queue'], ['Push Service'], ['Expiry Worker']],
    ['Mobile Client>Snap API>Encrypted Blob Store', 'Snap API>Delivery Queue>Push Service>Mobile Client', 'Encrypted Blob Store>Expiry Worker']],
  [/discord|slack|telegram|chat/, 'Chat platform', 'Persistent connections go through gateway shards, messages are written to a partitioned store, and channel fan-out runs via pub/sub.',
    [['Client'], ['WebSocket Gateway'], ['Presence Service', 'Channel Service'], ['Message Bus'], ['Message Store', 'Media Storage']],
    ['Client>WebSocket Gateway>Presence Service', 'WebSocket Gateway>Channel Service>Message Bus>Message Store', 'Channel Service>Media Storage']],
  [/gmail/, 'Email service', 'SMTP ingress passes spam and virus filters, mail is stored per user, and a search index is built asynchronously.',
    [['Mail Client'], ['SMTP Gateway'], ['Spam and Virus Filter'], ['Mailbox Store', 'Index Queue'], ['Search Index', 'Attachment Storage']],
    ['Mail Client>SMTP Gateway>Spam and Virus Filter>Mailbox Store>Attachment Storage', 'Spam and Virus Filter>Index Queue>Search Index']],
  [/calendar|meeting-room|restaurant reservation|booking|reservation|ticket/, 'Booking and calendar', 'A booking service reserves a slot with a short hold and a unique constraint, payments confirm it, and events send reminders.',
    [['Client'], ['API Gateway'], ['Availability Service'], ['Slot Hold Cache', 'Booking DB'], ['Reminder Scheduler', 'Payment Service']],
    ['Client>API Gateway>Availability Service>Slot Hold Cache', 'Availability Service>Booking DB>Reminder Scheduler', 'Booking DB>Payment Service']],
  [/google maps|real-time gps|ride-location|\bola\b|\buber\b|gps tracking/, 'Location and dispatch', 'Devices stream GPS over persistent connections. A geo index serves nearby searches, a matcher assigns, and history is archived off-path.',
    [['Driver / Rider App'], ['Location Gateway'], ['Location Stream'], ['Geo Index', 'Matching Service'], ['Trip DB', 'History Archive']],
    ['Driver / Rider App>Location Gateway>Location Stream>Geo Index>Matching Service>Trip DB', 'Location Stream>History Archive']],
  [/airbnb|property listing|travel booking|airline/, 'Listings and reservations', 'Search runs on an index, availability is checked against a reservation store, and a hold avoids double booking.',
    [['Client'], ['API Gateway'], ['Search Service', 'Reservation Service'], ['Listing Index', 'Availability Cache', 'Reservation DB'], ['Payment Service']],
    ['Client>API Gateway>Search Service>Listing Index', 'API Gateway>Reservation Service>Availability Cache', 'Reservation Service>Reservation DB>Payment Service']],
  [/swiggy|zomato|food-delivery|grocery|food delivery/, 'Order and delivery marketplace', 'Catalog reads come from cache, an order service coordinates the restaurant and payment, and a dispatcher assigns a courier on live location.',
    [['Customer App'], ['API Gateway'], ['Catalog Service', 'Order Service'], ['Catalog Cache', 'Dispatch Service'], ['Order DB', 'Courier Location Store']],
    ['Customer App>API Gateway>Catalog Service>Catalog Cache', 'API Gateway>Order Service>Order DB', 'Order Service>Dispatch Service>Courier Location Store']],
  [/flipkart|e-commerce platform|amazon/, 'E-commerce platform', 'Browsing is cached and CDN-served. Orders go through a queue, inventory is reserved atomically, and search is a separate index.',
    [['Client'], ['API Gateway', 'CDN'], ['Catalog Service', 'Cart & Order Service', 'Search Service'], ['Catalog Cache', 'Order Queue', 'Inventory Service'], ['Catalog DB', 'Order DB']],
    ['Client>API Gateway>Catalog Service>Catalog Cache>Catalog DB', 'API Gateway>Cart & Order Service>Order Queue>Order DB', 'Cart & Order Service>Inventory Service>Order DB', 'API Gateway>Search Service', 'Client>CDN']],
  [/search|autocomplete|elasticsearch/, 'Search and autocomplete', 'Writes publish change events to an indexer. Queries hit a sharded inverted index, a prefix cache serves suggestions, and ranking blends text and clicks.',
    [['Client'], ['Search API'], ['Query Cache', 'Ranker'], ['Search Index (Sharded)'], ['Indexer', 'Source DB']],
    ['Client>Search API>Query Cache', 'Search API>Search Index (Sharded)>Ranker', 'Source DB>Indexer>Search Index (Sharded)']],
  [/recommendation/, 'Recommendation serving', 'Batch jobs precompute candidates into a key-value store, a feature store keeps training and serving consistent, and the API re-ranks.',
    [['Client'], ['Recommendation API'], ['Candidate Store', 'Feature Store'], ['Re-ranker'], ['Training Pipeline', 'Event Log']],
    ['Client>Recommendation API>Candidate Store', 'Recommendation API>Feature Store', 'Recommendation API>Re-ranker', 'Event Log>Training Pipeline>Candidate Store']],
  [/stock price|trading application|sip stock|live sports/, 'Real-time market / score feed', 'A feed handler normalizes updates, a conflation layer sends latest values, edge nodes fan out to clients, and an order path stays strongly consistent.',
    [['Feed Source'], ['Feed Handler'], ['Conflation Layer'], ['Fan-out Edge', 'Order Service'], ['Client', 'Order DB']],
    ['Feed Source>Feed Handler>Conflation Layer>Fan-out Edge>Client', 'Client>Order Service>Order DB']],
  [/bidding/, 'Real-time bidding', 'Bid requests hit an in-memory auction service under a hard deadline, budgets are pacing counters, and results stream to billing.',
    [['Ad Exchange'], ['Bid Gateway'], ['Auction Service'], ['Budget Pacing Cache', 'Targeting Index'], ['Impression Stream']],
    ['Ad Exchange>Bid Gateway>Auction Service>Budget Pacing Cache', 'Auction Service>Targeting Index', 'Auction Service>Impression Stream']],
  [/multiplayer|game backend/, 'Multiplayer game backend', 'Players connect to regional game servers through matchmaking. The server is authoritative, state syncs by tick, and results persist off the hot path.',
    [['Game Client'], ['Matchmaker'], ['Game Server Fleet'], ['State Sync', 'Session Cache'], ['Player Profile DB', 'Leaderboard']],
    ['Game Client>Matchmaker>Game Server Fleet>State Sync', 'Game Server Fleet>Session Cache', 'Game Server Fleet>Player Profile DB', 'Player Profile DB>Leaderboard']],
  [/websocket connections|presence|online\/offline/, 'Presence and connection tier', 'Gateway nodes hold the connections, heartbeats refresh a TTL key, and presence changes publish only to interested subscribers.',
    [['Client'], ['Connection Gateway'], ['Heartbeat Handler'], ['Presence Store (TTL)', 'Subscription Registry'], ['Presence Pub/Sub']],
    ['Client>Connection Gateway>Heartbeat Handler>Presence Store (TTL)', 'Presence Store (TTL)>Presence Pub/Sub>Connection Gateway', 'Subscription Registry>Presence Pub/Sub']],
  [/polling|voting|feedback|rating/, 'Votes and ratings', 'Votes are idempotent writes, counters aggregate asynchronously, and results are served from cache.',
    [['Client'], ['API Gateway'], ['Vote Service'], ['Vote Log', 'Counter Aggregator'], ['Results Cache']],
    ['Client>API Gateway>Vote Service>Vote Log>Counter Aggregator>Results Cache', 'Client>Results Cache']],
  [/blog|to-do|task management|contact management|employee management|library management|parking lot|simple chat/, 'CRUD application', 'A small stateless service over a relational store: a cache for reads, search on the side, and a background worker for notifications.',
    [['Client'], ['Load Balancer'], ['App Service'], ['Cache', 'Relational DB'], ['Background Worker']],
    ['Client>Load Balancer>App Service>Cache', 'App Service>Relational DB', 'Relational DB>Background Worker']],

  // ── Storage ────────────────────────────────────────────────────────
  [/resumable|large-file|file upload|multipart/, 'Resumable file upload', 'Clients upload chunks directly to storage with signed URLs. A session store tracks received offsets, so any failure resumes.',
    [['Client'], ['Upload Session API'], ['Session Store'], ['Chunk Storage'], ['Assembler', 'Virus Scanner']],
    ['Client>Upload Session API>Session Store', 'Client>Chunk Storage>Assembler', 'Assembler>Virus Scanner']],
  [/dropbox/, 'Dropbox', 'The client watches the folder, hashes 4 MB blocks and uploads only the changed ones. The sync service records file → blocks and versions, deduplicated blocks go to storage, and the notification service tells other devices to pull deltas.',
    [['Client Watcher'], ['Sync Service'], ['Metadata DB (sharded)', 'Block Storage (dedup)', 'Notification Service', 'Conflict Copy Handler'], ['Other Devices']],
    ['Client Watcher>Sync Service>Metadata DB (sharded)', 'Client Watcher>Block Storage (dedup)', 'Sync Service>Block Storage (dedup)', 'Sync Service>Notification Service>Other Devices', 'Other Devices>Block Storage (dedup)', 'Sync Service>Conflict Copy Handler']],
  [/google drive|document storage/, 'File sync and storage', 'A metadata service tracks the tree, content-addressed chunks live in object storage, and a notification channel tells devices to sync.',
    [['Desktop Client'], ['Sync API'], ['Metadata DB', 'Block Service'], ['Object Storage', 'Change Notifier'], ['Sharing Service']],
    ['Desktop Client>Sync API>Metadata DB', 'Sync API>Block Service>Object Storage', 'Metadata DB>Change Notifier>Desktop Client', 'Metadata DB>Sharing Service']],
  [/deduplication|content-addressable/, 'Content-addressed storage', 'Chunks are stored by hash, so identical data is stored once. A reference counter and a garbage collector reclaim unused chunks.',
    [['Client'], ['Chunker + Hasher'], ['Chunk Index'], ['Chunk Store'], ['Reference Counter', 'Garbage Collector']],
    ['Client>Chunker + Hasher>Chunk Index>Chunk Store', 'Chunk Index>Reference Counter>Garbage Collector>Chunk Store']],
  [/object storage|s3|cold storage|archiving/, 'Object storage', 'A flat key space with sharded metadata, erasure-coded data nodes, and lifecycle tiering to cheaper classes.',
    [['Client'], ['Front-end API'], ['Metadata Shards'], ['Data Nodes (Erasure Coded)'], ['Lifecycle Tiering', 'Repair Service']],
    ['Client>Front-end API>Metadata Shards>Data Nodes (Erasure Coded)>Lifecycle Tiering', 'Data Nodes (Erasure Coded)>Repair Service']],
  [/distributed file system/, 'Distributed file system', 'A metadata master holds the namespace, large blocks are replicated on chunk servers, and clients read the data directly from them.',
    [['Client'], ['Metadata Master'], ['Edit Log + Standby'], ['Chunk Servers'], ['Re-replication']],
    ['Client>Metadata Master>Edit Log + Standby', 'Client>Chunk Servers', 'Metadata Master>Chunk Servers>Re-replication']],
  [/backup|restore|archiv/, 'Backup and restore', 'Base snapshots plus a WAL archive allow point-in-time recovery. Copies are encrypted, cross-region, and restore-tested.',
    [['Primary DB'], ['Backup Agent'], ['Snapshot Store', 'WAL Archive'], ['Cross-region Copy'], ['Restore Test Job', 'Restore Runbook']],
    ['Primary DB>Backup Agent>Snapshot Store>Cross-region Copy>Restore Test Job', 'Backup Agent>WAL Archive>Cross-region Copy', 'Cross-region Copy>Restore Runbook']],

  // ── Data infrastructure ────────────────────────────────────────────
  [/time-series/, 'Time-series database', 'Writes buffer in a WAL and memtable, flush into time-partitioned columnar blocks, and a downsampler applies retention.',
    [['Metrics Writers'], ['Ingest Gateway'], ['WAL + Memtable'], ['Time-partitioned Blocks'], ['Downsampler', 'Query Engine']],
    ['Metrics Writers>Ingest Gateway>WAL + Memtable>Time-partitioned Blocks>Downsampler', 'Time-partitioned Blocks>Query Engine']],
  [/key-value|nosql|document database|distributed database|distributed cache|distributed configuration cache/, 'Distributed key-value store', 'A consistent-hash ring places keys, replicas serve quorum reads and writes, and gossip detects failures and repairs divergence.',
    [['Client'], ['Coordinator Node'], ['Hash Ring'], ['Replica A', 'Replica B', 'Replica C'], ['Anti-entropy Repair', 'Gossip Membership']],
    ['Client>Coordinator Node>Hash Ring>Replica A', 'Hash Ring>Replica B', 'Hash Ring>Replica C', 'Replica A>Anti-entropy Repair', 'Replica B>Gossip Membership']],
  [/consistent hashing|shard rebalancing|database sharding|database partitioning|sharding/, 'Sharding and rebalancing', 'A router maps keys to shards through a directory. Virtual nodes spread the load, and a rebalancer moves ranges with dual reads during migration.',
    [['Client'], ['Shard Router'], ['Shard Directory', 'Rebalancer'], ['Shard 1', 'Shard 2', 'Shard 3'], ['Backfill Job']],
    ['Client>Shard Router>Shard Directory', 'Shard Router>Shard 1', 'Shard Router>Shard 2', 'Shard Router>Shard 3', 'Rebalancer>Backfill Job>Shard 3', 'Shard Directory>Rebalancer']],
  [/replica|replication|read\/write splitting|failover/, 'Replication and failover', 'The primary streams its log to replicas. A proxy splits reads from writes, and a failover manager promotes a replica and fences the old primary.',
    [['App'], ['Read/Write Proxy'], ['Primary DB'], ['Replica 1', 'Replica 2'], ['Failover Manager']],
    ['App>Read/Write Proxy>Primary DB>Replica 1', 'Primary DB>Replica 2', 'Read/Write Proxy>Replica 1', 'Failover Manager>Primary DB', 'Failover Manager>Replica 1']],
  [/relational database|polyglot|database migration|schema migration|zero-downtime database/, 'Safe database change', 'Expand, migrate, then contract: dual-write, backfill in batches, verify with checksums, flip reads by flag, and keep rollback.',
    [['App (Old + New)'], ['Feature Flag'], ['Old Schema', 'New Schema'], ['Backfill Job', 'CDC Sync'], ['Verifier', 'Rollback Switch']],
    ['App (Old + New)>Feature Flag>Old Schema', 'Feature Flag>New Schema', 'Old Schema>CDC Sync>New Schema', 'Backfill Job>New Schema', 'New Schema>Verifier>Rollback Switch']],
  [/consensus|raft|zookeeper|leader-election|leader election|lease|quorum/, 'Consensus group', 'An odd-sized replicated group elects a leader, commits entries on a majority, and clients read and write through the leader.',
    [['Client'], ['Leader Node'], ['Follower 1', 'Follower 2'], ['Replicated Log'], ['Election Timer', 'Snapshot Store']],
    ['Client>Leader Node>Follower 1', 'Leader Node>Follower 2', 'Leader Node>Replicated Log>Snapshot Store', 'Follower 1>Election Timer>Leader Node']],
  [/lock|semaphore/, 'Distributed lock', 'Locks are leases with fencing tokens issued by a consensus store, so a paused client with an expired lease cannot corrupt the data.',
    [['Client A', 'Client B'], ['Lock Service'], ['Consensus Store'], ['Fencing Token Issuer'], ['Protected Resource']],
    ['Client A>Lock Service>Consensus Store>Fencing Token Issuer>Protected Resource', 'Client B>Lock Service']],
  [/distributed id|sequence generator|id generator|distributed counter/, 'ID / counter generation', 'Each node owns a time-ordered ID range (a Snowflake-style layout), and counters are sharded then summed to avoid a hot key.',
    [['Service Nodes'], ['ID Generator'], ['Worker ID Registry'], ['Clock Sync Guard'], ['Sharded Counters', 'Aggregator']],
    ['Service Nodes>ID Generator>Worker ID Registry', 'ID Generator>Clock Sync Guard', 'Service Nodes>Sharded Counters>Aggregator']],
  [/cap theorem|cp system|ap system|consistency|conflict resolution/, 'Consistency model trade-off', 'The same request path runs in two modes: a quorum (CP) path rejects during partitions, and a local-write (AP) path accepts and reconciles later.',
    [['Client'], ['Coordinator'], ['Quorum Path (CP)', 'Local Write Path (AP)'], ['Replica Set'], ['Conflict Resolver', 'Read Repair']],
    ['Client>Coordinator>Quorum Path (CP)>Replica Set', 'Coordinator>Local Write Path (AP)>Replica Set', 'Replica Set>Conflict Resolver', 'Replica Set>Read Repair']],
  [/two-phase commit|2pc|distributed transaction/, 'Two-phase commit', 'A coordinator asks every participant to prepare, durably logs its decision, then commits or aborts. Blocked participants rely on the log.',
    [['Client'], ['Transaction Coordinator'], ['Participant A', 'Participant B'], ['Prepare Log'], ['Recovery Process']],
    ['Client>Transaction Coordinator>Participant A', 'Transaction Coordinator>Participant B', 'Transaction Coordinator>Prepare Log', 'Prepare Log>Recovery Process>Transaction Coordinator']],
  [/multi-region|active-active|active-passive|global|region failure|five-nines|billions|cloud platform|disaster recovery/, 'Multi-region architecture', 'Global routing sends users to the nearest healthy region. Each region is a self-contained cell, data replicates asynchronously, and failover is rehearsed.',
    [['Users'], ['Global Traffic Router'], ['Region A Cell', 'Region B Cell'], ['Replicated Data Layer'], ['Health Monitor', 'Failover Controller']],
    ['Users>Global Traffic Router>Region A Cell>Replicated Data Layer', 'Global Traffic Router>Region B Cell>Replicated Data Layer', 'Health Monitor>Failover Controller>Global Traffic Router', 'Region A Cell>Health Monitor', 'Region B Cell>Health Monitor']],

  // ── Platform & infrastructure ──────────────────────────────────────
  [/kubernetes|container scheduling|orchestration platform/, 'Container orchestration', 'A declarative API server persists desired state in a consensus store. The scheduler places pods, and node agents reconcile continuously.',
    [['kubectl / CI'], ['API Server'], ['etcd-style Store', 'Scheduler'], ['Controllers'], ['Node Agent', 'Container Runtime']],
    ['kubectl / CI>API Server>etcd-style Store', 'API Server>Scheduler', 'API Server>Controllers>Node Agent>Container Runtime']],
  [/serverless/, 'Serverless platform', 'Events invoke functions in microVMs. A warm pool cuts cold starts, a placement service picks hosts, and usage is metered.',
    [['Trigger / HTTP'], ['Invocation Router'], ['Placement Service', 'Warm Pool'], ['MicroVM Hosts'], ['Usage Metering', 'Log Stream']],
    ['Trigger / HTTP>Invocation Router>Placement Service>MicroVM Hosts', 'Invocation Router>Warm Pool>MicroVM Hosts', 'MicroVM Hosts>Usage Metering', 'MicroVM Hosts>Log Stream']],
  [/service mesh/, 'Service mesh', 'A sidecar next to each service handles mTLS, retries and telemetry, while a control plane pushes policy and certificates.',
    [['Service A'], ['Sidecar Proxy A'], ['Sidecar Proxy B'], ['Service B'], ['Control Plane', 'Telemetry Backend']],
    ['Service A>Sidecar Proxy A>Sidecar Proxy B>Service B', 'Control Plane>Sidecar Proxy A', 'Control Plane>Sidecar Proxy B', 'Sidecar Proxy A>Telemetry Backend']],
  [/service discovery/, 'Service discovery', 'Instances register with a health-checked registry. Clients cache the lookup results, and DNS or sidecars use them for routing.',
    [['Service Instances'], ['Registry'], ['Health Checker'], ['Client-side Cache'], ['Calling Service']],
    ['Service Instances>Registry>Health Checker>Registry', 'Registry>Client-side Cache>Calling Service']],
  [/api gateway|bff|backend-for-frontend|global api platform|api key|rate limit|token bucket|sliding-window/, 'Gateway and rate limiting', 'The edge authenticates and rate-limits using Redis counters before any app service runs, and routes by tenant and version.',
    [['Client'], ['Edge / WAF'], ['API Gateway'], ['Rate Limiter', 'Auth Service'], ['Redis Counters', 'Backend Services']],
    ['Client>Edge / WAF>API Gateway>Rate Limiter>Redis Counters', 'API Gateway>Auth Service', 'API Gateway>Backend Services']],
  [/configuration|feature flag/, 'Configuration and feature flags', 'Edits are validated and versioned, an event pushes changes to a local cache in each SDK, and rollouts are percentage-based.',
    [['Admin UI'], ['Config API'], ['Versioned Store', 'Audit Log'], ['Change Stream'], ['Client SDK Cache']],
    ['Admin UI>Config API>Versioned Store>Change Stream>Client SDK Cache', 'Config API>Audit Log']],
  [/cron|scheduler|job scheduler|workflow/, 'Job scheduler', 'Schedules are stored durably, a leader triggers due jobs into a queue, workers run them with leases, and failures retry.',
    [['Job Definitions'], ['Scheduler Leader'], ['Due-job Queue'], ['Workers', 'Lease Store'], ['Run History', 'Retry Handler']],
    ['Job Definitions>Scheduler Leader>Due-job Queue>Workers>Run History', 'Workers>Lease Store', 'Workers>Retry Handler>Due-job Queue']],
  [/health-check|circuit-breaker/, 'Resilience layer', 'Callers wrap dependencies with timeouts and a circuit breaker. Health checks feed the router, and a fallback answers when the circuit is open.',
    [['Caller Service'], ['Circuit Breaker'], ['Dependency'], ['Health Checker'], ['Fallback', 'Alerting']],
    ['Caller Service>Circuit Breaker>Dependency', 'Health Checker>Dependency', 'Circuit Breaker>Fallback', 'Health Checker>Alerting']],
  [/oauth|openid|basic authentication|password reset|authentication service/, 'Authentication service', 'The authorization server issues short-lived tokens through the code + PKCE flow. Refresh tokens rotate, and keys are published for validation.',
    [['Client App'], ['Authorization Server'], ['User Store', 'Token Store'], ['Key Service (JWKS)'], ['Resource API']],
    ['Client App>Authorization Server>User Store', 'Authorization Server>Token Store', 'Authorization Server>Key Service (JWKS)>Resource API', 'Client App>Resource API']],
  [/rbac|abac|iam|authorization/, 'Authorization architecture', 'Services ask a policy decision point, policies live as versioned code, a local cache keeps latency low, and decisions are audited.',
    [['Service (PEP)'], ['Policy Decision Point'], ['Policy Store', 'Attribute Source'], ['Decision Cache'], ['Audit Log']],
    ['Service (PEP)>Policy Decision Point>Policy Store', 'Policy Decision Point>Attribute Source', 'Policy Decision Point>Decision Cache', 'Policy Decision Point>Audit Log']],
  [/multi-tenant|tenant/, 'Multi-tenant SaaS', 'Tenant-aware routing, quotas and row-level isolation. Large tenants move to dedicated shards, and a control plane manages onboarding.',
    [['Tenant Users'], ['Tenant-aware Gateway'], ['Application Services'], ['Shared Pool DB', 'Dedicated Shard'], ['Control Plane', 'Metering']],
    ['Tenant Users>Tenant-aware Gateway>Application Services>Shared Pool DB', 'Application Services>Dedicated Shard', 'Control Plane>Tenant-aware Gateway', 'Application Services>Metering']],
]

const KIND_RULES = [
  ['entry', /^(application|applications|apps?\b|web\b|mobile|browser|desktop|participant|customer|rider|driver|sender|payer|merchant|player|guest|broadcaster|backup agent|devices|business services|producer service|seller|developer|operator|engineer|client|clients|mobile client|desktop client|web client|users?|producers?|client app|web \/ mobile( clients?)?|clients?|uploader|viewer|caller|admin ui|payer app|sender app|merchant client|customer app|game client|mail client|driver|support|tenant users|event sources?|event producer|feed source|ad exchange|metrics writers|writers|app hosts|kubectl|trigger|service instances|app \(old)/i],
  ['observability', /monitor|metrics|tracing|alert|dashboard|observab|telemetry|log agent|health check/i],
  ['coordination', /collab|crdt|zookeeper|etcd|consensus|leader|lock|lease|scheduler|coordinator|orchestrator|registry|discovery|saga|raft|election|fencing|control plane|failover|rebalancer|policy decision|state machine/i],
  ['storage', /database|\bdb\b|storage|store|ledger|journal|index|archive|snapshot|backup|blob|bucket|metadata|catalog|table|shard \d|replica \d|replica [abc]|partition log|block|chunk|log$|audit|history|vault/i],
  ['messaging', /queue|kafka|topic|stream|broker|pub\/?sub|redis|cache|bus|dlq|dead-letter|partition|outbox|retry \d|counter/i],
]

export function nodeKind(type) {
  const hit = KIND_RULES.find(([, re]) => re.test(type))
  return hit ? hit[0] : /load.?balancer/i.test(type) ? 'balancer' : 'compute'
}

const norm = t => String(t || '').toLowerCase().replace(/\.$/, '').trim()
const ANSWER_INDEX = new Map(ANSWERS.map(a => [norm(a[0]), a]))

// Pure concepts and internal plumbing have no client → load balancer front door.
const NO_FRONT_DOOR = /cap theorem|\bap system|\bcp system|eventual consistency|strong consistency|conflict resolution|consensus|raft|two-phase|event versioning|schema evolution|schema registry|token bucket|sliding-window|quorum|consistent hashing|container scheduling|at-most-once|at-least-once|exactly-once|duplicate-event|retry queue|retry topics|dead-letter|message ordering|partitioning strategy|consumer scaling|consumer group|event replay|cache invalidation|distributed (lease|semaphore|lock|counter|sequence|id)|leader-election|zookeeper|database (replication|failover|partitioning|sharding|backup|restore|migration)|read replicas|read\/write splitting|shard rebalancing|online schema|backup across|data archiving|cross-region kafka|kafka disaster|multi-region writes|disaster recovery|outbox|change-data-capture|cdc-based|double-entry|polyglot|time-series|key-value|document database|nosql|distributed database|globally distributed database|kafka-like|message broker|rabbitmq|publish-subscribe|sqs|object storage|distributed file system|content-addressable|file deduplication|cold storage|kubernetes|entire cloud|service mesh|circuit-breaker|health-check|saga|event sourcing|cqrs|sip stock/i

const LB_RE = /load.?balancer|\blb\b/i
const GW_RE = /gateway|\bbff\b|edge/i

// Put a Client → Load Balancer → API Gateway front door on designs that lack one.
function addFrontDoor(cols, links) {
  const comps = cols.flat()
  const edges = links.flatMap(chain => {
    const p = chain.split('>').map(x => x.trim())
    return p.slice(1).map((to, i) => [p[i], to])
  })
  const incoming = new Set(edges.map(e => e[1]))
  const sources = comps.filter(c => !incoming.has(c))
  const entries = sources.filter(c => nodeKind(c) === 'entry')
  let chain = []
  if (!comps.some(c => LB_RE.test(c))) chain.push('Load Balancer')
  if (!comps.some(c => GW_RE.test(c))) chain.push('API Gateway')
  let addClient = !entries.length
  if (!chain.length && !addClient) return { cols, edges }
  const budget = 7 - cols.length
  if (chain.length + (addClient ? 1 : 0) > budget && chain.length === 2) chain = ['Load Balancer / API Gateway']
  if (chain.length + (addClient ? 1 : 0) > budget && addClient) addClient = false
  if (chain.length + (addClient ? 1 : 0) > budget || chain.length + (addClient ? 1 : 0) === 0) return { cols, edges }

  const out = edges.map(e => e.slice())
  let insertAt
  let starts
  let targets
  if (entries.length) {
    insertAt = Math.max(...entries.map(e => cols.findIndex(c => c.includes(e)))) + 1
    starts = entries
    targets = [...new Set(edges.filter(e => entries.includes(e[0])).map(e => e[1]))]
    for (let i = out.length - 1; i >= 0; i--) if (entries.includes(out[i][0])) out.splice(i, 1)
  } else {
    insertAt = 0
    starts = addClient ? ['Client'] : []
    targets = sources
  }
  const fresh = [...(addClient ? [['Client']] : []), ...chain.map(c => [c])]
  const newCols = cols.map(c => c.slice())
  newCols.splice(insertAt, 0, ...fresh)
  const seq = [...(entries.length ? [] : addClient ? ['Client'] : []), ...chain]
  if (entries.length) {
    entries.forEach(e => out.push([e, seq[0] || targets[0]]))
  }
  for (let i = 1; i < seq.length; i++) out.push([seq[i - 1], seq[i]])
  const tail = seq[seq.length - 1]
  if (entries.length) {
    if (chain.length) targets.forEach(t => out.push([tail, t]))
  } else {
    targets.forEach(t => out.push([tail, t]))
  }
  void starts
  return { cols: newCols, edges: out }
}

const build = ([title, name, summary, cols0, links0]) => {
  let cols = cols0
  let edges = links0.flatMap(chain => {
    const p = chain.split('>').map(x => x.trim())
    return p.slice(1).map((to, i) => [p[i], to])
  })
  if (!NO_FRONT_DOOR.test(String(title).toLowerCase())) {
    const r = addFrontDoor(cols0, links0)
    cols = r.cols
    edges = r.edges
  }
  const step = cols.length < 2 ? 0 : Math.min(18.5, 81 / (cols.length - 1))
  const positions = {}
  cols.forEach((col, ci) => col.forEach((type, ri) => {
    positions[type] = { x: +(3 + ci * step).toFixed(1), y: col.length === 1 ? 40 : +(6 + ri * (66 / (col.length - 1))).toFixed(1) }
  }))
  return { name, summary, components: cols.flat(), edges, positions, defaultStep: 3 }
}

export function catalogBlueprintFor(title) {
  const exact = ANSWER_INDEX.get(norm(title))
  if (exact) return build(exact)
  const hit = C.find(([re]) => re.test(norm(title)))
  return hit ? build(hit) : null
}
