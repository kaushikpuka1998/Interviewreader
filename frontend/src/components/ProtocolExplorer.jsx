import { useEffect, useMemo, useRef, useState } from 'react'

const protocols = [
  { id: 'udp', name: 'UDP', subtitle: 'User Datagram Protocol', group: 'Core', color: 'amber', layer: 'Transport · Layer 4', port: 'Any', transport: 'IP', description: 'Independent datagrams sent without a connection. UDP trades delivery guarantees for low latency.', steps: [
    ['START WITHOUT SETUP', 'Send a datagram immediately', 'The media app has an endpoint already, so it sends a voice frame without opening a connection.'],
    ['INDEPENDENT FRAMES', 'Each datagram stands alone', 'Every audio frame travels independently, keeping later frames from waiting for earlier ones.'],
    ['DROP CAN HAPPEN', 'Delivery is not confirmed', 'A missing datagram is not acknowledged or retried; the playback stream continues.'],
    ['RETURN TRAFFIC', 'Remote audio travels back', 'The media endpoint sends its own datagrams back to the client over UDP.'],
    ['APPLICATION POLICY', 'The product handles recovery', 'The application can conceal a gap, add ordering, or introduce its own reliability layer.'],
  ] },
  { id: 'tcp', name: 'TCP', subtitle: 'Transmission Control Protocol', group: 'Core', color: 'emerald', layer: 'Transport · Layer 4', port: 'Any', transport: 'IP', description: 'Reliable, ordered delivery with a connection and acknowledgements.', steps: [['OPEN CONNECTION', 'Three-way handshake', 'SYN, SYN-ACK, and ACK establish a reliable connection before data flows.'], ['SEND DATA', 'Every byte is numbered', 'TCP assigns sequence numbers so the receiver can reconstruct the original byte stream.'], ['TWO SEGMENTS BACK', 'One of them is lost', 'The receiver receives later data, but one numbered segment never arrives.'], ['A GAP IS NOTICED', 'Duplicate ACK with SACK', 'The receiver reports the missing range with acknowledgements and selective acknowledgement data.'], ['RESEND THE GAP', 'Only the missing bytes', 'TCP retransmits the missing segment rather than restarting the whole transfer.'], ['CLOSE CONNECTION', 'Each side says goodbye', 'FIN and ACK messages close the connection cleanly on both sides.']] },
  { id: 'dns', name: 'DNS', subtitle: 'Domain Name System', group: 'Core', color: 'sky', layer: 'Application · Layer 7', port: '53', transport: 'UDP / TCP', description: 'Resolves a domain name into the IP address of a service.', steps: [['ASK RESOLVER', 'Query api.example.com'], ['LOOK UP', 'Resolver checks its cache'], ['RETURN ADDRESS', 'Answer with an IP address']] },
  { id: 'quic', name: 'QUIC', subtitle: 'HTTP/3 over UDP', group: 'Core', color: 'sky', layer: 'Transport', port: '443', transport: 'UDP', description: 'A secure multiplexed transport that combines TLS setup and HTTP/3 streams over UDP.', steps: [['CHOOSING HTTP/3', 'An earlier visit said it can', 'A previous connection tells the browser that this origin supports HTTP/3.'], ['INITIAL PACKETS', 'The Client Hello, straight away', 'QUIC sends its first TLS handshake information without first opening a TCP connection.'], ['SERVER HELLO', 'Then the certificate, encrypted', 'The server replies with its handshake information and certificate.'], ['FINISHED + GET', 'The request, one round trip in', 'The client completes setup and sends an HTTP request on its own stream.'], ['THE RESPONSE', 'On its own stream', 'The server responds without waiting for unrelated streams.'], ['NEW NETWORK', 'Known by ID, not by address', 'Connection IDs let QUIC survive changes between Wi-Fi and mobile networks.']] },
  { id: 'http', name: 'HTTP', subtitle: 'Hypertext Transfer Protocol', group: 'Application', color: 'rose', layer: 'Application · Layer 7', port: '80 / 443', transport: 'TCP / TLS', description: 'The request and response protocol used by the web.', steps: [['PREPARE REQUEST', 'Browser creates a request'], ['SEND REQUEST', 'GET /api/questions'], ['RECEIVE RESPONSE', '200 OK and response body']] },
  { id: 'tls', name: 'TLS', subtitle: 'Transport Layer Security', group: 'Security', color: 'violet', layer: 'Security', port: '443', transport: 'TCP / QUIC', description: 'Authenticates the server and encrypts application traffic.', steps: [['CLIENT HELLO', 'Choose supported security options'], ['SERVER HELLO', 'Certificate and key agreement'], ['ENCRYPT DATA', 'Protected application data']] },
]

const packets = [
  ['1', '0.000s', '10.42.0.17', '198.51.100.42', 'UDP', '49152 → 4100 Len=96', '138 B'],
  ['2', '0.020s', '10.42.0.17', '198.51.100.42', 'UDP', '49152 → 4100 Len=96', '138 B'],
  ['3', '0.040s', '10.42.0.17', '198.51.100.42', 'UDP', '49152 → 4100 Len=96 · DROPPED', '138 B'],
  ['4', '0.060s', '198.51.100.42', '10.42.0.17', 'UDP', '4100 → 49152 Len=96', '138 B'],
]

function Icon({ type }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'client') return <svg viewBox="0 0 72 54"><g {...p}><rect x="9" y="7" width="54" height="33" rx="3" /><path d="M4 46h64M27 40l-3 6h24l-3-6M17 15h38v17H17z" /></g></svg>
  if (type === 'router') return <svg viewBox="0 0 72 54"><g {...p}><path d="M10 23h52v22H10zM16 23l4-11h32l4 11M36 12V4M31 8h10M19 31h8M31 31h8M43 31h10M20 38h31" /></g></svg>
  if (type === 'server') return <svg viewBox="0 0 64 64"><g {...p}><path d="M12 11l26-7 15 9-26 8zM12 11v38l15 10V21M53 13v38l-26 8V21M18 29l21-6M18 37l21-6M18 45l17-5M43 31l5-2M43 40l5-2" /></g></svg>
  return <svg viewBox="0 0 76 54"><g {...p}><path d="M16 38c-10 0-13-14-3-19 2-11 17-15 25-7 9-9 25-2 23 10 12 1 11 16 1 16z" /><circle cx="38" cy="29" r="8" /><path d="M30 29h16M38 21c3 4 3 12 0 16M38 21c-3 4-3 12 0 16" /></g></svg>
}

function SceneNode({ type, label, meta, active, visible = true }) { return <div className={`lab-node lab-node--${type} ${active ? 'is-active' : ''} ${visible ? '' : 'is-hidden'}`}><div><Icon type={type} /></div><b>{label}</b>{meta && <small>{meta}</small>}</div> }

function NetworkScene({ protocol, step, playing }) {
  const choreography = {
    udp: [null, { from: 'Client', to: 'Router', path: 'M16 72L43 45', state: 'outbound' }, { from: 'Router', to: 'Internet', path: 'M43 45L64 60', state: 'lost' }, { from: 'Endpoint', to: 'Client', path: 'M82 28L64 60 43 45 16 72', state: 'inbound' }, null],
    tcp: [{ from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'lost' }, { from: 'Endpoint', to: 'Client', path: 'M82 28L64 60 43 45 16 72', state: 'inbound' }, { from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }],
    dns: [{ from: 'Client', to: 'Router', path: 'M16 72L43 45', state: 'outbound' }, { from: 'Router', to: 'Endpoint', path: 'M43 45L64 60 82 28', state: 'outbound' }, { from: 'Endpoint', to: 'Client', path: 'M82 28L64 60 43 45 16 72', state: 'inbound' }],
    http: [{ from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Endpoint', to: 'Client', path: 'M82 28L64 60 43 45 16 72', state: 'inbound' }],
    tls: [{ from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Endpoint', to: 'Client', path: 'M82 28L64 60 43 45 16 72', state: 'inbound' }, { from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }],
    quic: [{ from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Endpoint', to: 'Client', path: 'M82 28L64 60 43 45 16 72', state: 'inbound' }, { from: 'Client', to: 'Endpoint', path: 'M16 72L43 45 64 60 82 28', state: 'outbound' }, { from: 'Endpoint', to: 'Client', path: 'M82 28L64 60 43 45 16 72', state: 'inbound' }, null],
  }
  const transfer = choreography[protocol.id]?.[step] || null
  const state = transfer?.state || 'outbound'
  const moving = Boolean(transfer)
  const revealNetwork = step < 0 || protocol.id !== 'udp' || step >= 1
  return <div className={`lab-network protocol-${protocol.id} scene-step-${step}`}><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="lab-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L8 4 0 8z" /></marker></defs>{revealNetwork && <><path d="M16 72L43 45 64 60 82 28" />{moving && <path d={transfer.path} className={playing ? `lab-route is-${state}` : `lab-route is-paused is-${state}`} markerEnd="url(#lab-arrow)" />}{moving && playing && <image className={`lab-arrow-image is-${state}`} href="/protocol-arrow.svg" x="-5.5" y="-2.75" width="11" height="5.5" preserveAspectRatio="none"><animateMotion dur="1.45s" repeatCount="indefinite" rotate="auto" path={transfer.path} /></image>}</>}</svg>{transfer && <div className={`lab-transfer is-${state}`}><span>Sending · {transfer.from}</span><b>→</b><span>Receiving · {transfer.to}</span></div>}<SceneNode type="client" label="Client" meta="10.42.0.17" active={transfer?.from === 'Client' || transfer?.to === 'Client'} /><SceneNode type="router" label="Edge Router" meta="10.42.0.1" active={transfer?.from === 'Router' || transfer?.to === 'Router'} visible={revealNetwork} /><SceneNode type="internet" label="Public Network" active={transfer?.from === 'Internet' || transfer?.to === 'Internet'} visible={revealNetwork} /><SceneNode type="server" label={protocol.id === 'udp' ? 'Media Endpoint' : 'Service Endpoint'} meta="198.51.100.42" active={transfer?.from === 'Endpoint' || transfer?.to === 'Endpoint'} visible={revealNetwork} />{step >= 0 && <div className={`lab-packet-note is-${state}`}><b>{protocol.id === 'udp' ? `AUDIO FRAME ${Math.max(1, step)}` : protocol.name}</b><span>{state === 'lost' ? 'Datagram dropped · no automatic retry' : protocol.steps[step][1]}</span></div>}</div>
}

export default function ProtocolExplorer() {
  const [protocolId, setProtocolId] = useState('udp')
  const [filter, setFilter] = useState('All')
  const [mode, setMode] = useState('network')
  const [step, setStep] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const lessonRefs = useRef([])
  const protocol = protocols.find(item => item.id === protocolId) || protocols[0]
  const active = step >= 0 ? protocol.steps[step] : null
  const listed = useMemo(() => filter === 'All' ? protocols : protocols.filter(item => item.group === filter), [filter])
  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setTimeout(() => {
      if (step >= protocol.steps.length - 1) setPlaying(false)
      else setStep(step + 1)
    }, 2600 / speed)
    return () => window.clearTimeout(timer)
  }, [playing, speed, step, protocol.steps.length])
  useEffect(() => {
    if (step >= 0) lessonRefs.current[step]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [step, protocol.id])
  const selectProtocol = id => { setProtocolId(id); setStep(-1); setPlaying(false) }
  const play = () => {
    if (playing) { setPlaying(false); return }
    if (step < 0 || step >= protocol.steps.length - 1) setStep(0)
    setPlaying(true)
  }
  const displayedPackets = protocol.id === 'udp' ? Math.max(0, Math.min(packets.length, step)) : Math.max(0, step + 1)

  return <section className="protocol-lab">
    <header className="lab-header lab-header--filters"><nav>{['All', 'Core', 'Application', 'Security'].map(item => <button type="button" key={item} className={filter === item ? 'is-selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</nav></header>
    <div className="lab-grid"><aside className="lab-rail"><p>Protocols</p>{listed.map(item => <button type="button" key={item.id} onClick={() => selectProtocol(item.id)} className={`lab-protocol ${item.id === protocol.id ? `is-selected is-${item.color}` : ''}`}><i /><span><b>{item.name}</b><small>{item.subtitle}</small></span></button>)}<div className="lab-lessons"><p>Walkthrough</p>{protocol.steps.map((item, index) => <button type="button" ref={element => { lessonRefs.current[index] = element }} key={item[0]} className={`lab-lesson ${step === index ? 'is-current' : index < step ? 'is-done' : ''}`} onClick={() => { setStep(index); setPlaying(false) }}><i>{index < step ? '✓' : index + 1}</i><span><b>{item[0]}</b><small>{item[1]}</small></span></button>)}</div></aside>
      <main className="lab-stage"><div className="lab-tabs"><button type="button" className={mode === 'network' ? 'is-selected' : ''} onClick={() => setMode('network')}>Network</button><button type="button" className={mode === 'sequence' ? 'is-selected' : ''} onClick={() => setMode('sequence')}>Sequence</button></div>{mode === 'network' ? <NetworkScene protocol={protocol} step={step} playing={playing} /> : <div className="lab-sequence">{protocol.steps.map((item, index) => <div className={index <= step ? 'is-visible' : ''} key={item[0]}><b>Client</b><span>{item[0]}</span><b>Server</b></div>)}</div>}</main>
      <aside className="lab-detail"><span>{active ? `STEP ${step + 1} OF ${protocol.steps.length}` : 'PROTOCOL OVERVIEW'}</span><div><h3>{active ? active[0] : protocol.name}</h3><em className={`is-${protocol.color}`}>{active ? 'ACTIVE' : 'READY'}</em></div><h4>{active ? active[1] : protocol.subtitle}</h4><p>{active?.[2] || protocol.description}</p>{active && <section><b>{protocol.id === 'udp' ? `VOICE ${Math.max(1, step)}` : protocol.name}</b><span>{protocol.id === 'udp' ? 'UDP 50000 → 5004 · 92 B' : active[1]}</span></section>}<dl><div><dt>Layer</dt><dd>{protocol.layer}</dd></div><div><dt>Default port</dt><dd>{protocol.port}</dd></div><div><dt>Transport</dt><dd>{protocol.transport}</dd></div></dl></aside></div>
    <section className="lab-packets"><header><div><h3>Packet flow</h3><p>{step < 0 ? 'Press Play to begin the lesson' : step === protocol.steps.length - 1 && !playing ? 'Flow completed' : `Step ${step + 1} of ${protocol.steps.length}`}</p></div><div><label>Speed <select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><button type="button" className="is-primary" onClick={play}>{playing ? 'Pause' : step >= protocol.steps.length - 1 ? 'Replay' : 'Play'}</button><button type="button" disabled={playing || step >= protocol.steps.length - 1} onClick={() => setStep(value => Math.min(protocol.steps.length - 1, value + 1))}>Step</button><button type="button" onClick={() => { setStep(-1); setPlaying(false) }}>Reset</button></div></header><div className="lab-table"><div className="lab-table__head"><span>No.</span><span>Time</span><span>Source</span><span>Destination</span><span>Protocol</span><span>Info</span><span>Size</span></div>{packets.slice(0, displayedPackets).map((packet, index) => <div className={`lab-table__row ${packet[5].includes('LOST') ? 'is-lost' : index === displayedPackets - 1 ? 'is-active' : ''}`} key={packet[0]}>{packet.map(value => <span key={value}>{value}</span>)}</div>)}{displayedPackets === 0 && <p>No packets on the wire yet.</p>}</div></section>
  </section>
}
