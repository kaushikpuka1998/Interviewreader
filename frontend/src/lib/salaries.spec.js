import { describe, it, expect } from 'vitest'
import { pick, rangeText, similar, spanOf } from './salaries.js'

const lv = (level, norm, inr) => ({ level, norm, yoe: '', lpa: String(inr / 100000), inr })
const co = (name, segment, levels) => ({ slug: name.toLowerCase(), name, segment, levels })
const A = co('Alpha', 'MNC / Big Tech', [lv('L3', 'SDE-1 / Entry', 2000000), lv('L4', 'SDE-2', 4000000), lv('L5', 'SDE-3 / Senior', 8000000)])
const B = co('Beta', 'Indian startup', [lv('All levels', '', 1500000)])
const C = co('Gamma', 'MNC / Big Tech', [lv('E1', 'SDE-2', 3000000)])

describe('salaries', () => {
  it('spans the lowest to the highest level', () => {
    expect(spanOf(A)).toMatchObject({ min: '20', max: '80', count: 3 })
    expect(spanOf(A, 'SDE-2')).toMatchObject({ min: '40', max: '40', count: 1 })
    expect(spanOf(B, 'SDE-2')).toBeNull()
    expect(rangeText('20', '80')).toBe('₹20 – ₹80 LPA')
    expect(rangeText('15', '15')).toBe('₹15 LPA')
    expect(rangeText('38.0', '348.4')).toBe('₹38 – ₹348.4 LPA')   // the data's trailing .0 is dropped
  })
  it('searches, filters by segment and level, and sorts', () => {
    const all = [A, B, C]
    expect(pick(all, {}).map(r => r.company.name)).toEqual(['Alpha', 'Gamma', 'Beta'])             // highest pay first
    expect(pick(all, { sort: 'name' }).map(r => r.company.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(pick(all, { q: 'ga' }).map(r => r.company.name)).toEqual(['Gamma'])
    expect(pick(all, { segment: 'Indian startup' }).map(r => r.company.name)).toEqual(['Beta'])
    expect(pick(all, { norm: 'SDE-2' }).map(r => r.company.name)).toEqual(['Alpha', 'Gamma'])      // only companies that have that level
    expect(pick(all, { norm: 'SDE-2', sort: 'low' }).map(r => r.company.name)).toEqual(['Gamma', 'Alpha'])
  })
  it('finds similar companies in the same segment', () => {
    expect(similar([A, B, C], A).map(c => c.name)).toEqual(['Gamma'])
  })
})
