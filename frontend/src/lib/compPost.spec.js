import { describe, it, expect } from 'vitest'
import { compBody, compTitle, compTotal, fmtMoney } from './compPost.js'

const f = { cur: 'INR', status: 'Offer', company: 'Amazon', role: 'SDE-2', level: 'L5', location: 'Bangalore, India', education: 'B.Tech CS', yoe: '4', base: '28', stock: '15', bonus: '4', joining: '5', notes: 'Negotiated +3L' }

describe('compensation post template', () => {
  it('totals base, stock and bonus but not the one-time joining bonus', () => { expect(compTotal(f)).toBe(47) })
  it('formats money per currency', () => {
    expect(fmtMoney('INR', 47)).toBe('₹47 LPA')
    expect(fmtMoney('USD', 210.5)).toBe('$210.5K')
  })
  it('builds the "Company | Level | Location | Total" title', () => { expect(compTitle(f)).toBe('Amazon | L5 | Bangalore, India | ₹47 LPA') })
  it('builds the facts block and pay breakdown, skipping empty lines', () => {
    const b = compBody({ ...f, education: '', joining: '' })
    expect(b).toContain('**Status:** Offer')
    expect(b).toContain('**Position:** SDE-2 (L5)')
    expect(b).not.toContain('Education')
    expect(b).not.toContain('Joining bonus')
    expect(b).toContain('- **Total (per year): ₹47 LPA**')
    expect(b).toContain('**Benefits and notes:** Negotiated +3L')
  })
})
