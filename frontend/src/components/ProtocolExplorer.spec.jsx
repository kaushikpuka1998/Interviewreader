import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProtocolExplorer from './ProtocolExplorer.jsx'
import { PROTOCOLS, buildMessages } from '../lib/protocolScripts.js'

describe('protocol scripts', () => {
  it('only use actors the protocol draws, with and without loss', () => {
    for (const p of PROTOCOLS) for (const loss of [false, true]) {
      const msgs = buildMessages(p, loss)
      expect(msgs.length).toBeGreaterThan(3)
      msgs.forEach(x => { expect(p.actors).toContain(x.from); expect(p.actors).toContain(x.to) })
      expect(msgs.some(x => x.status === 'lost')).toBe(loss)
      expect(msgs.every(x => x.phase)).toBe(true)
    }
  })
  it('adds a retransmission after loss for TCP only where it recovers', () => {
    const tcp = PROTOCOLS.find(p => p.id === 'tcp')
    expect(buildMessages(tcp, true).length).toBeGreaterThan(buildMessages(tcp, false).length)
    const udp = PROTOCOLS.find(p => p.id === 'udp')
    expect(buildMessages(udp, true).length).toBe(buildMessages(udp, false).length)
  })
})

describe('ProtocolExplorer', () => {
  it('steps through a protocol and fills the wire table', () => {
    render(<ProtocolExplorer />)
    expect(screen.getByText('No packets on the wire yet.')).toBeTruthy()
    fireEvent.click(screen.getByText('Step ▶'))
    expect(screen.getAllByText('SYN').length).toBeGreaterThan(0)
    expect(screen.queryByText('No packets on the wire yet.')).toBeNull()
    fireEvent.click(screen.getByText('UDP'))
    expect(screen.getByText('No packets on the wire yet.')).toBeTruthy()
  })
})
