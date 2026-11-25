import { useEffect, useMemo, useRef, useState } from 'react'
import { ACTORS, PROTOCOLS, buildMessages, fmtTime } from '../lib/protocolScripts.js'

const W = 900, ROW = 66, TOP = 78
const TRAVEL = 2.6          // seconds for a packet to cross at 1× speed: slow enough to follow by eye
const EASE = { calcMode: 'spline', keyTimes: '0;1', keySplines: '0.45 0 0.25 1' }

// Sequence diagram: one lifeline per actor, one arrow per message. The whole flow is visible (future arrows are faint),
// the current arrow is highlighted with a travelling packet, and any arrow can be clicked to jump there.
function Diagram({ protocol, msgs, step, speed, still, onSeek }) {
  const actors = protocol.actors.map(id => ({ id, ...ACTORS[id] }))
  const n = actors.length
  const x = id => (W * (actors.findIndex(a => a.id === id) + 0.5)) / n
  const H = TOP + msgs.length * ROW + 10
  const states = {}
  msgs.slice(0, step + 1).forEach(msg => Object.assign(states, msg.st))
  const color = protocol.hex
  return (
    <div className="overflow-x-auto">
      <svg key={`${protocol.id}-${step}-${msgs.length}`} viewBox={`0 0 ${W} ${H}`} className="min-w-[640px] w-full" role="img" aria-label={`${protocol.name} message flow`}>
        {actors.map(a => (
          <g key={a.id}>
            <line x1={x(a.id)} x2={x(a.id)} y1={24} y2={H} stroke="#2a4a40" strokeDasharray="4 5" />
            <text x={x(a.id)} y={14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#94a3b8">{a.name}</text>
            {states[a.id] && <g><rect x={x(a.id) - 48} y={28} width={96} height={20} rx={10} fill={color} fillOpacity=".18" stroke={color} strokeOpacity=".6" /><text x={x(a.id)} y={42} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={color} fontFamily="ui-monospace,monospace">{states[a.id]}</text></g>}
          </g>
        ))}
        {msgs.map((msg, i) => {
          const y = TOP + i * ROW + 24
          const state = i === step ? 'current' : i < step ? 'past' : 'future'
          const lost = msg.status === 'lost'
          const stroke = lost && state !== 'future' ? '#f43f5e' : state === 'current' ? color : state === 'past' ? '#cbd5e1' : '#46675c'
          const op = state === 'future' ? 0.55 : 1
          const x1 = x(msg.from), x2 = x(msg.to), self = msg.from === msg.to
          const endX = lost ? x1 + (x2 - x1) * 0.62 : x2
          const dir = Math.sign(x2 - x1)
          const midX = (x1 + endX) / 2
          const newPhase = i === 0 || msgs[i - 1].phase !== msg.phase
          return (
            <g key={i} opacity={op} id={state === 'current' ? 'pe-current' : undefined}>
              {newPhase && <g><line x1={0} x2={W} y1={y - 40} y2={y - 40} stroke="#173229" /><text x={8} y={y - 28} fontSize="10" fontWeight="700" letterSpacing="1.4" fill="#64748b">{msg.phase.toUpperCase()}</text></g>}
              <rect x={0} y={y - 22} width={W} height={ROW - 22} fill={state === 'current' ? color : 'transparent'} fillOpacity=".07" className="cursor-pointer hover:fill-white/5" onClick={() => onSeek(i)} />
              <text x={8} y={y + 4} fontSize="10" fill="#64748b" fontFamily="ui-monospace,monospace">{fmtTime(msg.t)}</text>
              {self ? (
                <g onClick={() => onSeek(i)} className="cursor-pointer">
                  <circle cx={x1} cy={y} r={6} fill={state === 'current' ? color : '#2a4a40'} stroke={stroke} />
                  <text x={x1 + (x1 > W * 0.6 ? -16 : 16)} y={y - 2} textAnchor={x1 > W * 0.6 ? 'end' : 'start'} fontSize="12.5" fontWeight="700" fill="#e2e8f0">{msg.label}</text>
                  <text x={x1 + (x1 > W * 0.6 ? -16 : 16)} y={y + 14} textAnchor={x1 > W * 0.6 ? 'end' : 'start'} fontSize="10.5" fill="#94a3b8">{msg.sub}</text>
                </g>
              ) : (
                <g onClick={() => onSeek(i)} className="cursor-pointer">
                  <line x1={x1} y1={y} x2={endX} y2={y} stroke={stroke} strokeWidth={state === 'current' ? 3 : 2} strokeDasharray={msg.dashed || state !== 'past' ? '6 5' : undefined} />
                  {lost ? <text x={endX + dir * 6} y={y + 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#f43f5e">✕</text>
                    : <polygon points={`${x2},${y} ${x2 - dir * 10},${y - 5} ${x2 - dir * 10},${y + 5}`} fill={stroke} />}
                  <text x={midX} y={y - 9} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={lost && state !== 'future' ? '#fda4af' : '#e2e8f0'}>{msg.label}</text>
                  <text x={midX} y={y + 17} textAnchor="middle" fontSize="10.5" fill="#94a3b8">{msg.sub}</text>
                  {state === 'current' && !still && (
                    <g key={`${protocol.id}-${step}-${msgs.length}`}>
                      <line x1={x1} y1={y} y2={y} x2={x1} stroke={lost ? '#f43f5e' : color} strokeWidth="4" strokeLinecap="round">
                        <animate attributeName="x2" values={`${x1};${lost ? endX : x2}`} dur={`${TRAVEL / speed}s`} fill="freeze" {...EASE} />
                      </line>
                      <text y={y + 11} textAnchor="middle" fontSize="32" style={{ filter: `drop-shadow(0 0 6px ${lost ? '#f43f5e' : color})` }}>
                        <animate attributeName="x" values={`${x1};${lost ? endX - dir * 20 : x2 - dir * 8}`} dur={`${TRAVEL / speed}s`} fill="freeze" {...EASE} />
                        {protocol.icon}
                      </text>
                    </g>
                  )}
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const MID = [{ id: 'rt', name: 'Edge router', ip: '10.42.0.1', icon: '📡' }, { id: 'net', name: 'Internet', ip: 'many hops', icon: '☁️' }]

// Big-picture view: who is talking to whom. A packet pill travels from the sender to the receiver (through the router and
// the internet when there are only two parties) and dies with a red ✕ when the packet is lost.
function PathStrip({ protocol, msg, step, speed, still }) {
  const base = protocol.actors.map(id => ({ id, ...ACTORS[id] }))
  const nodes = base.length === 2 ? [base[0], ...MID, base[1]] : base
  const SW = 900
  const px = i => (SW * (i + 0.5)) / nodes.length
  const ix = id => nodes.findIndex(n => n.id === id)
  const lost = msg?.status === 'lost'
  const self = msg && msg.from === msg.to
  const cx1 = msg ? px(ix(msg.from)) : 0, cx2 = msg ? px(ix(msg.to)) : 0
  const sgn = Math.sign(cx2 - cx1) || 1
  // start and stop beside the nodes, not on top of them, so the packet never covers a machine's name
  const x1 = self ? cx1 : cx1 + sgn * 42, x2 = cx2 - sgn * 42
  const endX = lost ? x1 + (x2 - x1) * 0.67 : x2
  const laneY = sgn > 0 ? 60 : 80   // → travels on the top lane, ← on the bottom one
  const dy = laneY - 70
  const dur = TRAVEL / speed
  const color = protocol.hex
  const hot = id => msg && (msg.from === id || msg.to === id)
  const key = `${protocol.id}-${step}-${msg?.status}`
  return (
    <div className="overflow-x-auto border-b border-emerald-900/50 px-3 pb-2 pt-3">
      <p className="mb-1 min-h-[1.25rem] text-sm text-slate-300" aria-live="polite">
        {!msg ? 'Press Play: watch each packet travel from sender to receiver.'
          : self ? <><b className="text-white">{ACTORS[msg.from].name}</b> works locally: {msg.label}</>
            : <><b className="text-white">{ACTORS[msg.from].name}</b> <span className="text-slate-500">({msg.srcIp || ACTORS[msg.from].ip})</span> <span style={{ color }}>→</span> <b className="text-white">{ACTORS[msg.to].name}</b> <span className="text-slate-500">({msg.dstIp || ACTORS[msg.to].ip})</span> · {msg.label}{lost && <b className="ml-1 text-rose-400">· lost on the way ✕</b>}</>}
      </p>
      <svg key={key} viewBox="0 -18 900 146" className="w-full min-w-[560px]" role="img" aria-label="Who sends to whom">
        {nodes.slice(1).map((n, i) => {
          const a = px(i) + 55, b = px(i + 1) - 55, mid = (a + b) / 2
          return (
            <g key={n.id} stroke="#2a4a40" strokeWidth="3" strokeLinecap="round" fill="#46675c">
              <line x1={a} x2={b - 6} y1={60} y2={60} /><polygon points={`${b},60 ${b - 9},55 ${b - 9},65`} stroke="none" />
              <line x1={a + 6} x2={b} y1={80} y2={80} /><polygon points={`${a},80 ${a + 9},75 ${a + 9},85`} stroke="none" />
              <text x={mid} y={52} textAnchor="middle" fontSize="9" fill="#64748b" stroke="none">request →</text>
              <text x={mid} y={96} textAnchor="middle" fontSize="9" fill="#64748b" stroke="none">← response</text>
            </g>
          )
        })}
        {msg && !self && !still && (
          <line key={`t${key}`} x1={x1} x2={endX} y1={laneY} y2={laneY} stroke={lost ? '#f43f5e' : color} strokeWidth="4" strokeDasharray="9 7" strokeLinecap="round" opacity=".85">
            <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="0.5s" repeatCount="indefinite" />
          </line>
        )}
        {nodes.map((n, i) => (
          <g key={n.id}>
            <rect x={px(i) - 55} y={38} width={110} height={64} rx={14} fill="#10261f" stroke={hot(n.id) ? color : '#2a4a40'} strokeWidth={hot(n.id) ? 2.5 : 1} />
            <text x={px(i)} y={64} textAnchor="middle" fontSize="22">{n.icon}</text>
            <text x={px(i)} y={85} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#e2e8f0">{n.name}</text>
            <text x={px(i)} y={97} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="ui-monospace,monospace">{n.ip}</text>
          </g>
        ))}
        {msg && self && !still && (
          <circle key={`p${key}`} cx={x1} cy={70} r="30" fill="none" stroke={color} strokeWidth="3">
            <animate attributeName="r" from="34" to="62" dur={`${dur}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" from="1" to="0" dur={`${dur}s`} repeatCount="indefinite" />
          </circle>
        )}
        {msg && !self && !still && (
          <g key={`k${key}`}>
            <g>
              <animateTransform attributeName="transform" type="translate" values={`${x1} ${dy};${endX} ${dy}`} dur={`${dur}s`} fill="freeze" {...EASE} />
              <rect x={-52} y={0} width={104} height={20} rx={10} fill={lost ? '#f43f5e' : color} />
              <text y={14} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#0b1224">{msg.label.length > 17 ? `${msg.label.slice(0, 16)}…` : msg.label}</text>
              <line y1={20} y2={44} stroke={lost ? '#f43f5e' : color} strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x={-16} y={51} width={32} height={38} rx={8} fill="#10261f" stroke={lost ? '#f43f5e' : color} strokeWidth="2.5" />
              <text y={77} textAnchor="middle" fontSize="21">{protocol.icon}</text>
            </g>
            {lost && <text x={endX} y={80 + dy} textAnchor="middle" fontSize="30" opacity="0"><animate attributeName="opacity" from="0" to="1" begin={`${dur}s`} dur="0.2s" fill="freeze" />💥</text>}
          </g>
        )}
      </svg>
    </div>
  )
}

const btn = 'rounded-lg border border-emerald-800/60 bg-emerald-900/30 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-emerald-800/50 disabled:opacity-40 disabled:hover:bg-emerald-900/30'

export default function ProtocolExplorer() {
  const [id, setId] = useState('tcp')
  const [loss, setLoss] = useState(false)
  const [step, setStep] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const protocol = PROTOCOLS.find(p => p.id === id)
  const msgs = useMemo(() => buildMessages(protocol, loss), [protocol, loss])
  const last = msgs.length - 1
  const cur = step >= 0 ? msgs[step] : null
  const wire = msgs.slice(0, step + 1).filter(x => x.from !== x.to)
  const wireEnd = useRef(null)
  // Once the last packet has arrived the flow is over: stop every animation and leave a calm final picture.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    if (step < last) return undefined
    const t = setTimeout(() => setSettled(true), (TRAVEL * 1000) / speed + 300)
    return () => clearTimeout(t)
  }, [step, last, speed, id, loss])

  useEffect(() => {
    if (!playing) return undefined
    if (step >= last) { setPlaying(false); return undefined }
    const t = setTimeout(() => setStep(s => s + 1), ((TRAVEL + 1.4) * 1000) / speed)
    return () => clearTimeout(t)
  }, [playing, step, speed, last])
  useEffect(() => { if (wireEnd.current) wireEnd.current.scrollTop = wireEnd.current.scrollHeight }, [step])   // scroll the table itself, never the page
  // Keep the animating arrow in the free area under the pinned header (the header would otherwise cover it).
  useEffect(() => {
    if (step < 0) return
    const el = document.getElementById('pe-current')
    const bar = document.getElementById('pe-sticky')
    if (!el || !bar) return
    const top = bar.getBoundingClientRect().bottom + 24
    const r = el.getBoundingClientRect()
    if (r.top < top || r.bottom > window.innerHeight - 60) window.scrollBy({ top: r.top - top - Math.max(0, (window.innerHeight - top - 120) / 3), behavior: 'smooth' })
  }, [step, id, loss])

  const pick = pid => { setId(pid); setStep(-1); setPlaying(false) }
  const toggleLoss = () => { setLoss(v => !v); setStep(0); setPlaying(true) }   // replay at once so the difference is visible
  const seek = i => { setStep(i); setPlaying(false) }
  const play = () => {
    if (playing) { setPlaying(false); return }
    if (step >= last) setStep(0)
    else if (step < 0) setStep(0)
    setPlaying(true)
  }
  const onKey = e => {
    if (['INPUT', 'SELECT'].includes(e.target.tagName)) return
    if (e.key === 'ArrowRight') { e.preventDefault(); seek(Math.min(last, step + 1)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); seek(Math.max(-1, step - 1)) }
  }
  const addr = (x, key, def) => x[key] || ACTORS[def].ip

  return (
    <section onKeyDown={onKey} tabIndex={-1} className="rounded-2xl border border-emerald-900/50 bg-[#07120e] p-3 text-slate-200 shadow-xl outline-none sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)_21rem]">
        <nav aria-label="Protocols" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          <p className="hidden px-2 text-[11px] font-bold uppercase tracking-[.18em] text-slate-500 lg:block">Protocols</p>
          {PROTOCOLS.map(p => (
            <button key={p.id} type="button" onClick={() => pick(p.id)} aria-pressed={p.id === id}
              className={`flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${p.id === id ? 'bg-emerald-950/70' : 'border-transparent hover:bg-emerald-950/60'}`}
              style={p.id === id ? { borderColor: p.hex } : undefined}>
              <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.hex }} />
              <span><b className="block text-sm text-white">{p.name}</b><small className="hidden text-[11px] text-slate-400 lg:block">{p.subtitle}</small></span>
            </button>
          ))}
          <p className="hidden px-2 pt-2 text-[11px] leading-relaxed text-slate-500 lg:block">Tip: click any arrow to jump to it, or use ← → on the keyboard.</p>
        </nav>

        <main className="min-w-0 rounded-xl border border-emerald-900/50 bg-[#0b1a15]">
          <div id="pe-sticky" className="sticky top-14 z-10 rounded-t-xl bg-[#0b1a15] shadow-[0_6px_12px_-8px_rgba(0,0,0,.8)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-900/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <button type="button" className={btn} onClick={() => seek(-1)} disabled={step < 0}>⏮ Reset</button>
              <button type="button" className={btn} onClick={() => seek(step - 1)} disabled={step < 0}>◀ Back</button>
              <button type="button" onClick={play} className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-950" style={{ background: protocol.hex }}>
                {playing ? '⏸ Pause' : step >= last ? '↻ Replay' : '▶ Play'}
              </button>
              <button type="button" className={btn} onClick={() => seek(step + 1)} disabled={step >= last}>Step ▶</button>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <label className="flex items-center gap-1.5">Speed
                <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="rounded-md border border-emerald-800/60 bg-emerald-950 px-1.5 py-1 text-slate-200">
                  <option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-200">
                <input type="checkbox" checked={loss} onChange={toggleLoss} className="h-4 w-4 accent-rose-500" /> Drop a packet
              </label>
            </div>
          </div>
          <div className="px-3 pb-1 pt-2">
            <input type="range" min={-1} max={last} value={step} onChange={e => seek(Number(e.target.value))} aria-label="Step" className="w-full" style={{ accentColor: protocol.hex }} />
            <p className="text-[11px] text-slate-500">{step < 0 ? `Press Play, or click an arrow. ${msgs.length} steps.` : `Step ${step + 1} of ${msgs.length}`}{loss && <span className="ml-2 font-semibold text-rose-400">· packet loss on</span>}</p>
          </div>
          <PathStrip protocol={protocol} msg={cur} step={step} speed={speed} still={settled} />
          </div>
          <Diagram protocol={protocol} msgs={msgs} step={step} speed={speed} still={settled} onSeek={seek} />
        </main>

        <aside className="rounded-xl border border-emerald-900/50 bg-[#0b1a15] p-4 lg:max-h-[46rem] lg:overflow-y-auto" aria-live="polite">
          {cur ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[.18em]" style={{ color: protocol.hex }}>Step {step + 1} of {msgs.length} · {cur.phase}</p>
              <h3 className="mt-1 text-lg font-extrabold text-white">{cur.label}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{cur.from === cur.to ? `On the ${ACTORS[cur.from].name.toLowerCase()}` : `${ACTORS[cur.from].name} → ${ACTORS[cur.to].name}`} · {fmtTime(cur.t)}{cur.size ? ` · ${cur.size} B` : ''}</p>
              {cur.status === 'lost' && <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">✕ This packet never arrives.</p>}
              {cur.plain && <p className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200">💡 In plain English: {cur.plain}</p>}
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{cur.detail}</p>
              {cur.fields && (
                <dl className="mt-4 divide-y divide-emerald-900/50 rounded-lg border border-emerald-900/50 text-xs">
                  <dt className="bg-emerald-950/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Fields in this packet</dt>
                  {cur.fields.map(([k, v]) => <div key={k} className="flex justify-between gap-3 px-3 py-1.5"><dt className="shrink-0 text-slate-500">{k}</dt><dd className="text-right font-mono text-slate-200">{v}</dd></div>)}
                </dl>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[.18em]" style={{ color: protocol.hex }}>Protocol overview</p>
              <h3 className="mt-1 text-2xl font-extrabold text-white">{protocol.name}</h3>
              <p className="text-xs text-slate-400">{protocol.subtitle}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{protocol.description}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">{protocol.points.map(p => <li key={p} className="flex gap-2"><span style={{ color: protocol.hex }}>▸</span>{p}</li>)}</ul>
              <dl className="mt-4 divide-y divide-emerald-900/50 text-xs">
                {[['Layer', protocol.layer], ['Port', protocol.port], ['Runs over', protocol.transport], ['Setup cost', protocol.setup]].map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-mono text-slate-200">{v}</dd></div>)}
              </dl>
              <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/60 p-3 text-xs leading-relaxed text-slate-400"><b className="text-rose-300">Try “Drop a packet”:</b> {protocol.lossNote}</p>
            </>
          )}
        </aside>
      </div>

      <section className="mt-3 rounded-xl border border-emerald-900/50 bg-[#0b1a15]" aria-label="Packets on the wire">
        <header className="flex items-baseline justify-between px-4 py-2.5">
          <h3 className="text-sm font-bold uppercase tracking-[.14em] text-white">Packets on the wire</h3>
          <p className="text-xs text-slate-500">{wire.length} so far</p>
        </header>
        <div ref={wireEnd} className="max-h-56 overflow-auto font-mono text-[11.5px]">
          <div className="grid min-w-[640px] grid-cols-[2.5rem_5rem_8rem_8rem_5.5rem_minmax(0,1fr)_4rem] gap-2 border-y border-emerald-900/50 px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            <span>No.</span><span>Time</span><span>Source</span><span>Destination</span><span>Protocol</span><span>Info</span><span className="text-right">Size</span>
          </div>
          {wire.length === 0 && <p className="px-4 py-4 text-slate-500">No packets on the wire yet.</p>}
          {wire.map((x, k) => (
            <button type="button" key={x.i} onClick={() => seek(x.i)}
              className={`grid w-full min-w-[640px] grid-cols-[2.5rem_5rem_8rem_8rem_5.5rem_minmax(0,1fr)_4rem] gap-2 px-4 py-1 text-left hover:bg-emerald-900/30 ${x.i === step ? 'bg-emerald-900/40' : ''} ${x.status === 'lost' ? 'text-rose-300' : 'text-slate-300'}`}>
              <span>{k + 1}</span><span>{fmtTime(x.t)}</span><span>{addr(x, 'srcIp', x.from)}</span><span>{addr(x, 'dstIp', x.to)}</span>
              <span style={{ color: x.status === 'lost' ? undefined : protocol.hex }}>{x.proto}</span>
              <span className="truncate">{x.info}{x.status === 'lost' ? '  [lost]' : ''}</span><span className="text-right">{x.size ? `${x.size} B` : '–'}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  )
}
