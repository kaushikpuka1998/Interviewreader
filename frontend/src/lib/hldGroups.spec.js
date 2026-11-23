import { describe, it, expect } from 'vitest'
import { hldGroupOf, groupHld, HLD_GROUPS, HLD_OTHER } from './hldGroups.js'

const g = t => hldGroupOf(t).name

describe('hldGroupOf', () => {
  it('puts similar designs in the same group', () => {
    expect(g('Design WhatsApp.')).toBe('Chat & Presence')
    expect(g('Design Slack')).toBe('Chat & Presence')
    expect(g('Design Uber.')).toBe('Maps, Rides & Dispatch')
    expect(g('Design Netflix.')).toBe('Video, Audio & Live')
    expect(g('Design Reddit')).toBe('Feeds & Social Graphs')
    expect(g('Design a payment gateway')).toBe('Payments & Ledgers')
    expect(g('Design Flipkart')).toBe('Shopping & Bookings')
    expect(g('Design object storage similar to S3')).toBe('Files, Storage & Sync')
    expect(g('Design an autocomplete system')).toBe('Search & Discovery')
    expect(g('Design OAuth2/OpenID Connect authentication architecture')).toBe('Identity & Access')
    expect(g('Design a feature flag service')).toBe('Platform & Reliability')
  })

  it('keeps the basics in the first group', () => {
    expect(g('Design a URL shortener (like bit.ly).')).toBe('Foundations & Warm-ups')
    expect(g('Design a distributed rate limiter')).toBe('Foundations & Warm-ups')
  })

  it('ignores the "High-Level Design (HLD) ---" prefix and the word "allocation" is not a location', () => {
    expect(g('High-Level Design (HLD) --- Real-Time Trading Application')).toBe('Payments & Ledgers')
    expect(g('SIP Stock Allocation System — HLD + LLD')).toBe('Payments & Ledgers')
  })

  it('does not treat "ordering" as an order system, and Kafka topics are messaging', () => {
    expect(g('Design Kafka message ordering')).toBe('Events, Streams & Messaging')
    expect(g('Design a Kafka partitioning strategy')).toBe('Events, Streams & Messaging')
  })

  it('falls back to "More Designs" for anything unknown', () => {
    expect(hldGroupOf('Design a quantum teleporter')).toBe(HLD_OTHER)
    expect(hldGroupOf(null)).toBe(HLD_OTHER)
  })
})

describe('groupHld', () => {
  it('keeps the fixed group order, drops empty groups and keeps every item exactly once', () => {
    const items = ['Design Uber.', 'Design WhatsApp.', 'Design a URL shortener', 'Design a quantum teleporter'].map(title => ({ title }))
    const groups = groupHld(items)
    expect(groups.map(x => x.name)).toEqual(['Foundations & Warm-ups', 'Chat & Presence', 'Maps, Rides & Dispatch', 'More Designs'])
    expect(groups.flatMap(x => x.items)).toHaveLength(4)
  })

  it('has unique group names and an icon for each', () => {
    const names = [...HLD_GROUPS, HLD_OTHER].map(x => x.name)
    expect(new Set(names).size).toBe(names.length)
    for (const x of [...HLD_GROUPS, HLD_OTHER]) expect(x.icon).toBeTruthy()
  })
})
