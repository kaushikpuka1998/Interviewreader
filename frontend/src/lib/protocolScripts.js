// Message-by-message scripts for the protocol explorer. Each script(loss) returns the messages in order.
// A message: { from, to, label, sub, t (ms, send time), phase, info, size, fields, detail, st, status, proto, srcIp, dashed }.
// from === to is a local step (a note on that lifeline). st sets a state label on an actor once the message is delivered.

export const ACTORS = {
  c: { name: 'Client', ip: '10.42.0.17', icon: '💻' },
  s: { name: 'Server', ip: '198.51.100.42', icon: '🖥️' },
  b: { name: 'Browser', ip: '10.42.0.17', icon: '💻' },
  r: { name: 'Resolver', ip: '10.42.0.1', icon: '🧭' },
  root: { name: 'Root server', ip: '198.41.0.4', icon: '🌐' },
  tld: { name: 'Top-level server', ip: '192.5.6.30', icon: '🏷️' },
  auth: { name: 'Owner’s server', ip: '203.0.113.53', icon: '📒' },
}

const m = (from, to, label, sub, o = {}) => ({ from, to, label, sub, ...o })

const udp = loss => [
  m('c', 's', 'Voice packet #1', 'one datagram · 96 B of audio', { t: 0, phase: 'Send', info: '49152 → 4100 Len=96', size: 104,
    detail: 'No handshake and no setup: the very first packet already carries data. Nothing is remembered between packets, so every datagram is self-contained.',
    fields: [['Source port', '49152'], ['Destination port', '4100'], ['Length', '104 (8 header + 96 data)'], ['Checksum', '0x3f1a']] }),
  m('c', 's', 'Voice packet #2', 'one datagram · 96 B of audio', { t: 20, info: '49152 → 4100 Len=96', size: 104,
    detail: 'Sent 20 ms later without waiting for any reply. The sender never slows down for the receiver: UDP has no flow control and no congestion control.',
    fields: [['Source port', '49152'], ['Destination port', '4100'], ['Length', '104'], ['Checksum', '0x91c0']] }),
  m('c', 's', 'Voice packet #3', loss ? 'dropped on the way' : 'one datagram · 96 B of audio', { t: 40, info: '49152 → 4100 Len=96', size: 104, status: loss ? 'lost' : 'ok',
    detail: loss
      ? 'This datagram is dropped (a full router queue, a weak Wi-Fi link). The sender is never told: UDP has no ACK and no retransmission.'
      : 'Delivered. UDP does not guarantee order, so datagrams may also overtake each other on the path.',
    fields: [['Source port', '49152'], ['Destination port', '4100'], ['Length', '104'], ['Checksum', '0x07de']] }),
  m('s', 'c', 'Voice packet back', 'server → client · 96 B', { t: 80, phase: 'Reply', info: '4100 → 49152 Len=96', size: 104,
    detail: 'The server answers with its own independent datagrams. There is no connection, so "reply" is just another packet going the other way.',
    fields: [['Source port', '4100'], ['Destination port', '49152'], ['Length', '104'], ['Checksum', '0xb2a4']] }),
  m('c', 'c', loss ? 'Hide the gap' : 'Play in order', loss ? 'app-level recovery' : 'jitter buffer', { t: 100, phase: 'Application',
    detail: loss
      ? 'Recovery is the application’s job. It sees the missing sequence number (RTP), then conceals 20 ms of audio or uses forward error correction. A retransmission would arrive too late for live voice, which is why voice uses UDP.'
      : 'The app reorders frames in a small jitter buffer and plays them. Had a frame gone missing it would conceal the gap rather than wait for it.' }),
]

const tcpSeg = (n, seq, o) => m('c', 's', `Segment ${n}`, `seq=${seq} · 1460 B`, { info: `49152 → 443 [PSH, ACK] Seq=${seq} Len=1460`, size: 1514,
  fields: [['Flags', 'PSH, ACK'], ['Sequence number', String(seq)], ['Payload', '1460 bytes'], ['Window', '64240']], ...o })

const tcp = loss => [
  m('c', 's', 'SYN', 'SYN = “can we talk?”', { plain: 'SYN means “synchronise”: the client opens the conversation and proposes starting sequence numbers.', t: 0, phase: 'Handshake', info: '49152 → 443 [SYN] Seq=0 MSS=1460', size: 74, st: { c: 'SYN_SENT', s: 'LISTEN' },
    detail: 'The client picks a random initial sequence number and offers its options (maximum segment size, window scaling, SACK). Nothing can be sent until both sides agree.',
    fields: [['Flags', 'SYN'], ['Sequence number', '0 (relative)'], ['Window', '64240'], ['Options', 'MSS 1460, SACK, WS 7']] }),
  m('s', 'c', 'SYN-ACK', 'SYN-ACK = “yes, and you?”', { plain: 'The server answers “yes” (ACK) and also proposes its own starting numbers (SYN).', t: 20, info: '443 → 49152 [SYN, ACK] Seq=0 Ack=1', size: 74, st: { c: 'ESTABLISHED', s: 'SYN_RCVD' },
    detail: 'The server accepts, picks its own sequence number and acknowledges the client’s (ack = client seq + 1).',
    fields: [['Flags', 'SYN, ACK'], ['Sequence number', '0'], ['Acknowledgment', '1'], ['Window', '65160']] }),
  m('c', 's', 'ACK', 'ACK = “got it” · open', { plain: 'The client says “got it”. Both sides are now agreed, and data can flow.', t: 40, info: '49152 → 443 [ACK] Seq=1 Ack=1', size: 66, st: { s: 'ESTABLISHED' },
    detail: 'Both sides now agree on sequence numbers: one full round trip spent before the first byte of data. The client may send data together with this ACK.',
    fields: [['Flags', 'ACK'], ['Sequence number', '1'], ['Acknowledgment', '1']] }),
  tcpSeg(1, 1, { t: 40, phase: 'Data', detail: 'Every byte is numbered. Segment 1 carries bytes 1 to 1460, so the receiver can rebuild the stream in order.' }),
  tcpSeg(2, 1461, { t: 41, status: loss ? 'lost' : 'ok', sub: loss ? 'seq=1461 · dropped' : 'seq=1461 · 1460 B',
    detail: loss ? 'Segment 2 (bytes 1461 to 2920) is dropped on the path. The sender does not know yet; it keeps sending within its window.' : 'Delivered. TCP segments can arrive in any order; sequence numbers put them back.' }),
  tcpSeg(3, 2921, { t: 42, detail: 'Segment 3 (bytes 2921 to 4380) arrives.' + (loss ? ' It is out of order: the receiver is still waiting for byte 1461.' : '') }),
  loss
    ? m('s', 'c', 'Dup ACK', 'ack=1461 · SACK 2921-4381', { t: 62, info: '443 → 49152 [ACK] Ack=1461 SACK=2921-4381', size: 78,
      detail: 'The receiver keeps asking for byte 1461 and, via SACK, tells the sender it already holds 2921 to 4380. That is a clear "only this part is missing" signal (fast retransmit triggers after about 3 duplicate ACKs).',
      fields: [['Flags', 'ACK'], ['Acknowledgment', '1461 (still waiting here)'], ['SACK block', '2921 – 4381'], ['Window', '64240']] })
    : m('s', 'c', 'ACK', 'ack=4381 · cumulative', { t: 62, info: '443 → 49152 [ACK] Ack=4381', size: 66,
      detail: 'One cumulative ACK covers everything up to byte 4380. Delayed ACKs let the receiver acknowledge several segments at once.',
      fields: [['Flags', 'ACK'], ['Acknowledgment', '4381'], ['Window', '64240']] }),
  ...(loss ? [
    tcpSeg(2, 1461, { t: 64, phase: 'Recovery', sub: 'retransmit · seq=1461', label: 'Retransmit seg 2', info: '49152 → 443 [ACK] Seq=1461 Len=1460 [Retransmission]',
      detail: 'Only the missing segment is resent, not the whole transfer. The congestion window also shrinks, so TCP slows down after loss.' }),
    m('s', 'c', 'ACK', 'ack=4381 · gap filled', { t: 84, info: '443 → 49152 [ACK] Ack=4381', size: 66,
      detail: 'The gap is filled, so the cumulative ACK jumps from 1461 to 4381. The application receives all bytes in order, never seeing the loss, only some added delay.',
      fields: [['Flags', 'ACK'], ['Acknowledgment', '4381']] }),
  ] : []),
  m('c', 's', 'FIN', 'FIN = “I have no more data”', { plain: 'FIN means “finish”. The client is saying: I have nothing more to send you. It can still receive.', t: 100, phase: 'Close', info: '49152 → 443 [FIN, ACK]', size: 66, st: { c: 'FIN_WAIT_1', s: 'CLOSE_WAIT' },
    detail: 'The client has no more data. Each direction of a TCP connection is closed on its own.', fields: [['Flags', 'FIN, ACK']] }),
  m('s', 'c', 'ACK', 'ACK = “got it”', { plain: 'ACK means “acknowledged”: the server confirms it received the client’s FIN. It may still have data of its own to send.', t: 120, info: '443 → 49152 [ACK]', size: 66, st: { c: 'FIN_WAIT_2' },
    detail: 'The server acknowledges the FIN. The client-to-server direction is closed; the server may still send data.', fields: [['Flags', 'ACK']] }),
  m('s', 'c', 'FIN', 'FIN = “I have no more data”', { plain: 'FIN means “finish”. Now the server says the same: it has nothing more to send, so both directions are closed and the connection can end.', t: 125, info: '443 → 49152 [FIN, ACK]', size: 66, st: { s: 'LAST_ACK', c: 'TIME_WAIT' },
    detail: 'The server closes its direction too. The client waits in TIME_WAIT (about 60 s) in case its final ACK is lost.', fields: [['Flags', 'FIN, ACK']] }),
  m('c', 's', 'ACK', 'ACK = “got it” · closed', { plain: 'The client confirms the server’s FIN. After this the connection is fully closed.', t: 145, info: '49152 → 443 [ACK]', size: 66, st: { s: 'CLOSED' },
    detail: 'The final ACK. The server is closed immediately; the client lingers in TIME_WAIT before forgetting the connection.', fields: [['Flags', 'ACK']] }),
]

const dns = loss => { const d = loss ? 1000 : 0; return [
  m('c', 'r', 'Query: A api.example.com', 'UDP 53 · recursion desired', { t: 0, phase: 'Ask the resolver', info: 'Standard query 0x1a2b A api.example.com', size: 74, proto: 'DNS', status: loss ? 'lost' : 'ok',
    detail: loss
      ? 'The query packet is lost. DNS usually runs over UDP, so there is no connection to notice it: the client simply waits for a timeout.'
      : 'Your device asks its configured resolver (often your ISP, router, or 1.1.1.1). One small UDP packet, no handshake.',
    fields: [['Transaction ID', '0x1a2b'], ['Flags', 'RD (recursion desired)'], ['QNAME', 'api.example.com'], ['QTYPE', 'A (IPv4 address)']] }),
  ...(loss ? [m('c', 'r', 'Retry same query', 'after timeout (~1 s)', { t: 1000, info: 'Standard query 0x1a2b A api.example.com [retry]', size: 74, proto: 'DNS',
    detail: 'After the timeout the client repeats the query, often to a second resolver. Resolution works, but the user waited a full second. Large replies (over about 512 B, or DNSSEC) set the TC bit and the client retries over TCP.',
    fields: [['Transaction ID', '0x1a2b'], ['QNAME', 'api.example.com']] })] : []),
  m('r', 'root', 'api.example.com A?', 'cache miss → ask root', { t: 1 + d, phase: 'Walk the hierarchy', info: 'Query A api.example.com', size: 74, proto: 'DNS',
    detail: 'The resolver has nothing cached, so it starts at the top: one of 13 root server identities (hundreds of anycast machines).' }),
  m('root', 'r', 'Referral: top-level server', 'it knows who runs .com', { t: 21 + d, info: 'Response: NS .com → a.gtld-servers.net', size: 190, proto: 'DNS',
    detail: 'The root does not know the answer but knows which top-level server handles .com. It returns a referral (NS records plus their IPs as glue).',
    fields: [['Answer', 'none'], ['Authority', 'com. NS a.gtld-servers.net'], ['Additional', 'a.gtld-servers.net A 192.5.6.30']] }),
  m('r', 'tld', 'api.example.com A?', 'ask the top-level server', { t: 22 + d, info: 'Query A api.example.com', size: 74, proto: 'DNS',
    detail: 'The same question, now sent to the top-level server, the one that manages every .com name.' }),
  m('tld', 'r', 'Referral: owner’s server', 'ns1.example.com', { t: 42 + d, info: 'Response: NS example.com → ns1.example.com', size: 170, proto: 'DNS',
    detail: 'The top-level server points to the owner’s name server, the one example.com’s owner configured.',
    fields: [['Authority', 'example.com. NS ns1.example.com'], ['Additional', 'ns1.example.com A 203.0.113.53']] }),
  m('r', 'auth', 'api.example.com A?', 'ask the owner’s own server', { t: 43 + d, info: 'Query A api.example.com', size: 74, proto: 'DNS',
    detail: 'Finally the owner’s own (authoritative) server, the only one that holds the real record.' }),
  m('auth', 'r', 'Answer: 203.0.113.10', 'A · TTL 300 · aa', { t: 63 + d, info: 'Response: A 203.0.113.10 TTL=300', size: 90, proto: 'DNS',
    detail: 'The authoritative answer. The aa flag marks it as coming from the source. TTL says for how many seconds it may be cached.',
    fields: [['Flags', 'QR, AA, RD, RA'], ['Answer', 'api.example.com. A 203.0.113.10'], ['TTL', '300 seconds']] }),
  m('r', 'r', 'Cache for 300 s', 'next lookups are instant', { t: 64 + d, phase: 'Cache & answer',
    detail: 'The resolver stores the answer (and the referral NS records) until the TTL expires. Everyone behind this resolver skips the whole walk for the next five minutes.' }),
  m('r', 'c', 'Answer: 203.0.113.10', 'A · TTL 300', { t: 65 + d, info: 'Response 0x1a2b A 203.0.113.10', size: 90, proto: 'DNS',
    detail: 'The client now has an IP address and can open a TCP or QUIC connection to it. A cached repeat of this lookup takes one round trip to the resolver instead of the full walk.',
    fields: [['Transaction ID', '0x1a2b'], ['Answer', '203.0.113.10'], ['TTL', '300']] }),
] }

const quic = loss => [
  m('c', 's', 'Initial · ClientHello', 'UDP 443 · padded to 1200 B', { t: 0, phase: 'Handshake', info: 'Initial, DCID=8394c8f0, CRYPTO ClientHello', size: 1252, proto: 'QUIC', status: loss ? 'lost' : 'ok',
    detail: loss
      ? 'The first packet is lost. QUIC runs its own loss detection (it is not on top of TCP), so the client sets a probe timer and will resend.'
      : 'One UDP datagram carries the TLS 1.3 ClientHello. QUIC has no separate TCP handshake: transport and encryption setup are combined.',
    fields: [['Packet type', 'Initial'], ['Destination conn. ID', '8394c8f0'], ['TLS SNI', 'api.example.com'], ['ALPN', 'h3'], ['Key share', 'x25519']] }),
  ...(loss ? [m('c', 's', 'Initial (PTO resend)', 'probe timeout fired', { t: 330, info: 'Initial, retransmitted CRYPTO ClientHello', size: 1252, proto: 'QUIC',
    detail: 'No reply after the probe timeout, so the client sends the ClientHello again. Only the lost data is retransmitted, in a new packet with a new packet number.' })] : []),
  m('s', 'c', 'Initial + Handshake', 'ServerHello · cert · Finished', { t: loss ? 350 : 20, info: 'Initial ServerHello + Handshake (EE, Cert, CertVerify, Fin)', size: 1280, proto: 'QUIC',
    detail: 'The server replies with its hello and, in the same flight, its encrypted certificate and Finished message (two packet types coalesced in one datagram).',
    fields: [['Packet types', 'Initial + Handshake'], ['Certificate', 'api.example.com (encrypted)'], ['Handshake', 'complete on server side']] }),
  m('c', 'c', 'Verify cert, derive keys', '1-RTT keys ready', { t: loss ? 370 : 40,
    detail: 'The client checks the certificate chain, then derives the keys used for application data.' }),
  m('c', 's', 'Handshake Finished + GET /', 'HTTP/3 request, stream 0', { t: loss ? 370 : 40, phase: 'First request', info: 'Handshake Fin + 1-RTT STREAM 0 HEADERS GET /', size: 220, proto: 'QUIC',
    detail: 'The request rides in the same flight as the final handshake message. Total: 1 round trip before the response starts, versus about 2 to 3 for TCP + TLS 1.2. With a session ticket (0-RTT) the request can go in the very first packet.',
    fields: [['Packet type', '1-RTT (short header)'], ['Stream', '0 (client-initiated, bidirectional)'], ['HTTP/3 frame', 'HEADERS :method GET :path /']] }),
  m('s', 'c', 'HANDSHAKE_DONE + 200 OK', 'response on stream 0', { t: loss ? 390 : 60, info: '1-RTT HANDSHAKE_DONE, STREAM 0 HEADERS 200 + DATA', size: 1200, proto: 'QUIC',
    detail: 'Each request has its own stream. If one stream loses a packet, other streams keep going: no head-of-line blocking across requests (the key advantage over HTTP/2 on TCP).',
    fields: [['Frames', 'HANDSHAKE_DONE, STREAM'], ['Status', '200 OK']] }),
  m('c', 'c', 'Wi-Fi → mobile network', 'new IP: 100.64.8.5', { t: 5000, phase: 'Connection migration',
    detail: 'The phone leaves Wi-Fi. A TCP connection would break, because it is identified by IP and port. QUIC identifies a connection by its connection ID instead.' }),
  m('c', 's', 'PATH_CHALLENGE', 'from the new address', { t: 5001, info: '1-RTT PATH_CHALLENGE (src 100.64.8.5)', size: 1200, proto: 'QUIC', srcIp: '100.64.8.5',
    detail: 'The client sends from its new address using the same connection ID. The server must verify the path before sending much data to it (this prevents address spoofing).',
    fields: [['Source IP', '100.64.8.5 (new)'], ['Connection ID', 'unchanged'], ['Frame', 'PATH_CHALLENGE']] }),
  m('s', 'c', 'PATH_RESPONSE', 'new path validated', { t: 5030, info: '1-RTT PATH_RESPONSE', size: 1200, proto: 'QUIC', dstIp: '100.64.8.5',
    detail: 'The new path is validated. Downloads and streams continue without a new handshake, so the user sees no interruption.',
    fields: [['Frame', 'PATH_RESPONSE'], ['Result', 'path validated']] }),
]

const http = loss => [
  m('b', 's', 'Connection ready', 'TCP + TLS already done', { t: 0, phase: 'Connection', dashed: true, proto: 'TCP+TLS', info: 'Established (see the TCP and TLS lessons)', size: 0,
    detail: 'Before any HTTP byte flows, the browser needs a TCP connection and (for https) a TLS session. That costs 1 to 3 round trips and is covered in the TCP and TLS lessons. HTTP/1.1 and HTTP/2 reuse the connection for later requests.' }),
  m('b', 's', 'GET /api/questions', 'HTTP/1.1', { t: 60, phase: 'First request', info: 'GET /api/questions HTTP/1.1', size: 412, status: loss ? 'lost' : 'ok',
    detail: loss
      ? 'The request packet is lost. HTTP does not notice: TCP underneath resends it after a timeout. The user only sees extra latency.'
      : 'A text request: a method, a path, then headers. The body is empty for GET.',
    fields: [['Method', 'GET'], ['Path', '/api/questions'], ['Host', 'api.example.com'], ['Accept', 'application/json'], ['Accept-Encoding', 'gzip, br']] }),
  ...(loss ? [m('b', 's', 'GET (TCP retransmit)', 'resent by TCP, not by HTTP', { t: 260, info: 'GET /api/questions [TCP Retransmission]', size: 412,
    detail: 'Same bytes, resent by the transport after about 200 ms. HTTP is the same request either way, which is the point of layering.' })] : []),
  m('s', 'b', '200 OK · JSON', 'ETag, Cache-Control', { t: loss ? 300 : 100, info: 'HTTP/1.1 200 OK (application/json, 18 KB gzip)', size: 5200,
    detail: 'Status line, headers, then the body. ETag identifies this version; Cache-Control says it stays fresh for 60 seconds.',
    fields: [['Status', '200 OK'], ['Content-Type', 'application/json'], ['Content-Encoding', 'gzip'], ['ETag', '"v7f3"'], ['Cache-Control', 'max-age=60']] }),
  m('b', 'b', 'Render + cache 60 s', 'served from cache', { t: loss ? 320 : 120,
    detail: 'For the next 60 seconds the browser answers repeat requests from its cache: zero network traffic.' }),
  m('b', 's', 'GET (If-None-Match)', 'revalidate · same connection', { t: 62000, phase: 'Revalidate', info: 'GET /api/questions + If-None-Match: "v7f3"', size: 440,
    detail: 'The cache has expired. The browser asks "has it changed since version v7f3?" and reuses the open connection (keep-alive).',
    fields: [['Method', 'GET'], ['If-None-Match', '"v7f3"'], ['Connection', 'keep-alive']] }),
  m('s', 'b', '304 Not Modified', 'no body', { t: 62040, info: 'HTTP/1.1 304 Not Modified', size: 180,
    detail: 'Nothing changed, so the server sends headers only. 18 KB saved, and the browser refreshes its cache lifetime.',
    fields: [['Status', '304 Not Modified'], ['Body', 'empty']] }),
  m('b', 's', 'POST /api/progress', 'JSON body', { t: 63000, phase: 'Write', info: 'POST /api/progress HTTP/1.1 {"questionId":42}', size: 520,
    detail: 'A POST carries a body. It changes state on the server, so it is not cached and is not safely retried without an idempotency key.',
    fields: [['Method', 'POST'], ['Content-Type', 'application/json'], ['Body', '{"questionId":42,"read":true}']] }),
  m('s', 'b', '201 Created', 'Location header', { t: 63050, info: 'HTTP/1.1 201 Created', size: 230,
    detail: '2xx means success, 3xx redirect or cache, 4xx client error, 5xx server error.',
    fields: [['Status', '201 Created'], ['Location', '/api/progress/9981']] }),
]

const tls = loss => [
  m('c', 's', 'ClientHello', 'versions · ciphers · key share', { t: 0, phase: 'Key exchange', info: 'Client Hello (TLS 1.3, SNI api.example.com)', size: 517, proto: 'TLSv1.3', status: loss ? 'lost' : 'ok',
    detail: loss
      ? 'The segment carrying the ClientHello is lost. TLS has no retransmission of its own: TCP underneath resends it, so TLS only sees a slower handshake.'
      : 'Sent over an already-open TCP connection. It lists supported versions and ciphers, the server name (SNI), and the client’s ephemeral public key (x25519) up front, which is what saves a round trip over TLS 1.2.',
    fields: [['Version', 'TLS 1.3'], ['Cipher suites', 'AES-128-GCM, AES-256-GCM, ChaCha20'], ['SNI', 'api.example.com'], ['Key share', 'x25519 public key'], ['ALPN', 'h2, http/1.1']] }),
  ...(loss ? [m('c', 's', 'ClientHello (TCP retransmit)', 'resent by TCP', { t: 200, info: 'Client Hello [TCP Retransmission]', size: 517, proto: 'TLSv1.3',
    detail: 'Identical bytes, resent after the TCP timeout. TLS does not know any packet was lost.' })] : []),
  m('s', 'c', 'ServerHello', 'chosen cipher · key share', { t: loss ? 220 : 20, info: 'Server Hello (TLS_AES_128_GCM_SHA256)', size: 127, proto: 'TLSv1.3',
    detail: 'The server picks a cipher and sends its own public key share. Both sides can now compute the same shared secret (ECDHE) without ever sending it, and everything after this message is encrypted.',
    fields: [['Cipher suite', 'TLS_AES_128_GCM_SHA256'], ['Key share', 'x25519 server public key'], ['Encrypted from here', 'yes']] }),
  m('c', 'c', 'Derive handshake keys', 'ECDHE shared secret', { t: loss ? 220 : 20,
    detail: 'Client computes: shared secret = x25519(client private, server public). Handshake traffic keys come from it. Because the keys are ephemeral, recorded traffic cannot be decrypted later (forward secrecy).' }),
  m('s', 'c', '{Certificate, Verify, Finished}', 'encrypted handshake', { t: loss ? 220 : 20, phase: 'Authentication', info: 'Encrypted Extensions, Certificate, CertificateVerify, Finished', size: 3400, proto: 'TLSv1.3',
    detail: 'In TLS 1.3 even the certificate is encrypted. The server proves it owns the private key by signing the handshake transcript (CertificateVerify), then sends a MAC over everything (Finished).',
    fields: [['Certificate', 'api.example.com, signed by an intermediate CA'], ['CertificateVerify', 'signature over the transcript'], ['Finished', 'HMAC of the handshake']] }),
  m('c', 'c', 'Verify the certificate', 'chain · name · dates', { t: loss ? 240 : 40,
    detail: 'Client checks: chain leads to a trusted root CA, hostname matches the SNI, dates are valid, not revoked, and the signature verifies. If any check fails the connection is aborted with an alert.' }),
  m('c', 's', '{Finished}', 'handshake complete', { t: loss ? 240 : 40, info: 'Change Cipher Spec, Finished', size: 80, proto: 'TLSv1.3',
    detail: 'The client proves it derived the same keys. One round trip is enough for the whole handshake (TLS 1.2 needed two).',
    fields: [['Finished', 'HMAC of the handshake']] }),
  m('c', 's', '{GET / HTTP/1.1}', 'application data', { t: loss ? 240 : 40, phase: 'Protected data', info: 'Application Data (encrypted, 412 B)', size: 440, proto: 'TLSv1.3',
    detail: 'The HTTP request is sealed with the application keys (AES-GCM). An observer sees only that 412 encrypted bytes were sent.',
    fields: [['Record type', 'Application Data'], ['Length', '412 B'], ['Visible to observers', 'sizes and timing only']] }),
  m('s', 'c', '{HTTP/1.1 200 OK}', 'application data', { t: loss ? 260 : 60, info: 'Application Data (encrypted, 5.2 KB)', size: 5300, proto: 'TLSv1.3',
    detail: 'The response is encrypted the same way. Later, a session ticket allows resuming with 0-RTT, skipping most of this handshake.',
    fields: [['Record type', 'Application Data'], ['Length', '5.2 KB']] }),
]

export const PROTOCOLS = [
  { id: 'udp', icon: '🎙️', name: 'UDP', subtitle: 'User Datagram Protocol', hex: '#f59e0b', layer: 'Transport · Layer 4', port: 'App-defined', transport: 'IP', setup: '0 round trips', actors: ['c', 's'], script: udp,
    description: 'Fire-and-forget datagrams. No connection, no ordering, no retransmission, so it is fast and simple.',
    points: ['Sends data in the very first packet', '8-byte header: ports, length, checksum', 'Lost packets are never resent by UDP', 'Used for voice, video, games, DNS, QUIC'],
    lossNote: 'Datagram #3 is dropped and nobody retries it.' },
  { id: 'tcp', icon: '📦', name: 'TCP', subtitle: 'Transmission Control Protocol', hex: '#10b981', layer: 'Transport · Layer 4', port: 'App-defined', transport: 'IP', setup: '1 round trip', actors: ['c', 's'], script: tcp,
    description: 'A reliable, ordered byte stream. TCP numbers every byte, acknowledges them and resends what is lost.',
    points: ['Three-way handshake before data', 'Sequence numbers + ACKs give reliability', 'Lost data is retransmitted; speed backs off', 'Four-step close, one direction at a time'],
    lossNote: 'Segment 2 is dropped; the receiver signals the gap and the sender resends only that segment.' },
  { id: 'dns', icon: '🔎', name: 'DNS', subtitle: 'Domain Name System', hex: '#38bdf8', layer: 'Application · Layer 7', port: '53', transport: 'UDP (TCP fallback)', setup: '1 round trip (cached)', actors: ['c', 'r', 'root', 'tld', 'auth'], script: dns,
    description: 'The internet’s phone book: turns a name like api.example.com into an IP address by walking a hierarchy.',
    points: ['Resolver does the legwork for the client', 'Root → top-level → owner’s server', 'Answers are cached for their TTL', 'UDP first; TCP for large replies'],
    lossNote: 'The query is lost; the client times out after about a second and asks again.' },
  { id: 'tls', icon: '🔐', name: 'TLS', subtitle: 'Transport Layer Security', hex: '#a78bfa', layer: 'Security (above TCP)', port: '443', transport: 'TCP', setup: '1 round trip (TLS 1.3)', actors: ['c', 's'], script: tls,
    description: 'Authenticates the server and encrypts everything after the handshake, so eavesdroppers see only ciphertext.',
    points: ['Ephemeral key exchange gives forward secrecy', 'Certificate proves the server’s identity', 'TLS 1.3 handshake takes one round trip', 'Session tickets allow 0-RTT resume'],
    lossNote: 'TLS has no retransmission; TCP resends the lost segment and TLS only sees delay.' },
  { id: 'http', icon: '📄', name: 'HTTP', subtitle: 'Hypertext Transfer Protocol', hex: '#fb7185', layer: 'Application · Layer 7', port: '80 / 443', transport: 'TCP (+TLS)', setup: 'depends on transport', actors: ['b', 's'], script: http,
    description: 'The request and response language of the web: methods, status codes, headers and a body.',
    points: ['Request = method + path + headers (+ body)', 'Status codes say what happened (2xx 3xx 4xx 5xx)', 'ETag + 304 avoid re-downloading', 'Connections are reused (keep-alive)'],
    lossNote: 'The request packet is lost; TCP resends it, HTTP never notices.' },
  { id: 'quic', icon: '⚡', name: 'QUIC', subtitle: 'HTTP/3 over UDP', hex: '#818cf8', layer: 'Transport · Layer 4', port: '443', transport: 'UDP', setup: '1 round trip (0-RTT resume)', actors: ['c', 's'], script: quic,
    description: 'TCP-like reliability and built-in TLS 1.3, running over UDP, with independent streams and connection migration.',
    points: ['Transport + TLS handshake in one round trip', 'Independent streams: no head-of-line blocking', 'Connection IDs survive Wi-Fi ↔ mobile switches', 'Loss recovery is built in (over UDP)'],
    lossNote: 'The first packet is lost; QUIC’s probe timer fires and the client resends it.' },
]

// Build the finished message list: carries phases forward and fills defaults.
export function buildMessages(protocol, loss) {
  let phase = ''
  return protocol.script(loss).map((x, i) => {
    phase = x.phase || phase
    return { status: 'ok', proto: protocol.name, info: x.label, size: 0, t: 0, ...x, phase, i }
  })
}

export const fmtTime = t => (t < 1000 ? `${t} ms` : `${(t / 1000).toFixed(t % 1000 ? 2 : 0)} s`)
