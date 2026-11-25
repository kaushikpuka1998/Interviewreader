import { describe, it, expect } from 'vitest'
import { bodyPreview, compBody, compTitle, compTotal, fmtMoney, inlineParts, parseCompBody } from './compPost.js'

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

describe('reading a template post back', () => {
  const imported = '**Status:** Reported median\n**Company:** Accenture\n**Position:** Software Engineer: SSE (SDE-2)\n**Location:** India\n**Typical experience:** 4-5 years\n\n**Compensation**\n- **Total (per year, median): ₹12.6 LPA** (₹12,63,030)\n- Company median across levels: ₹8.2 LPA\n\n**Source:** [Levels.fyi](https://www.levels.fyi/x), updated November 25, 2026'
  it('splits facts, pay lines and the source', () => {
    const p = parseCompBody(imported)
    expect(p.facts.map(x => x[0])).toEqual(['Status', 'Company', 'Position', 'Location', 'Typical experience'])
    expect(p.pay).toHaveLength(2)
    expect(p.source).toContain('Levels.fyi')
    expect(p.notes).toBe('')
  })
  it('previews as one plain line and leaves other posts alone', () => {
    expect(bodyPreview(imported)).toBe('Software Engineer: SSE (SDE-2) · India · 4-5 years')
    expect(bodyPreview('Just a normal post')).toBe('Just a normal post')
    expect(parseCompBody('Just a normal post')).toBeNull()
  })
  it('turns bold and links into parts', () => {
    expect(inlineParts('**Total** and [a](https://x.y)')).toEqual([{ text: 'Total', bold: true }, { text: ' and ' }, { text: 'a', href: 'https://x.y' }])
  })
})
