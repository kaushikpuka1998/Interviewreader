import { describe, it, expect } from 'vitest'
import { loadUntil } from './questionSeek.js'

// 10 questions, 3 per page
const all = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}` }))
const fetchPage = async p => ({ content: all.slice(p * 3, p * 3 + 3), number: p, totalPages: 4 })

describe('loadUntil', () => {
  it('returns the first page when the question is on it', async () => {
    const d = await loadUntil(fetchPage, 0, 'q2')
    expect(d.content.map(q => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(d.number).toBe(0)
  })
  it('loads the pages up to the question, in order from the top of the list', async () => {
    const d = await loadUntil(fetchPage, 0, 'q8')
    expect(d.content.map(q => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'])
    expect(d.number).toBe(2)   // the next scroll continues from page 3
  })
  it('stops at the end of the list or at the page limit when the question is not there', async () => {
    expect((await loadUntil(fetchPage, 0, 'nope')).content).toHaveLength(10)
    expect((await loadUntil(fetchPage, 0, 'nope', 1)).content).toHaveLength(6)
  })
  it('loads one page when there is no question to find', async () => {
    expect((await loadUntil(fetchPage, 0, null)).content).toHaveLength(3)
  })
})
