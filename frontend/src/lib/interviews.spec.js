import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestInterview, fetchInterviewQuota, slotToIso, formatSlot, cancelInterview, giveFeedback, acceptInterview } from './interviews.js'

const json = (body, ok = true, status = 200) => ({ ok, status, json: () => Promise.resolve(body) })
beforeEach(() => { globalThis.fetch = vi.fn() })

describe('mock interview API client', () => {
  it('requests an interview with type, resume, slot and the interviewer opt-in', async () => {
    fetch.mockResolvedValue(json({ id: 1 }))
    await requestInterview('CODING', 0, '2026-12-01T10:00:00.000Z', true)
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toMatch(/\/interviews\/request$/)
    expect(opts.method).toBe('POST')
    expect(opts.credentials).toBe('include')
    expect(JSON.parse(opts.body)).toEqual({ type: 'CODING', resumeId: null, slot: '2026-12-01T10:00:00.000Z', wantsToInterview: true })
  })

  it('carries the quota on a 402 so the page can offer plans', async () => {
    fetch.mockResolvedValue(json({ error: "You've used all your mock interviews.", quota: { canRequest: false } }, false, 402))
    const err = await requestInterview('CODING', null, 'x').catch(e => e)
    expect(err.status).toBe(402)
    expect(err.quota).toEqual({ canRequest: false })
    expect(err.message).toContain('used all')
  })

  it('falls back to a status message when the error has no body', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error('x')) })
    await expect(fetchInterviewQuota()).rejects.toThrow('Request failed (500)')
  })

  it('asks for the quota in a currency: the given one, else the saved choice', async () => {
    fetch.mockResolvedValue(json({}))
    await fetchInterviewQuota('GBP')
    localStorage.setItem('ir_currency', 'EUR')
    await fetchInterviewQuota()
    expect(fetch.mock.calls.map(c => c[0].replace(/^.*\/interviews/, ''))).toEqual(['/quota?currency=GBP', '/quota?currency=EUR'])
  })

  it('uses the right verbs and paths for the interview actions', async () => {
    fetch.mockResolvedValue(json({}))
    await cancelInterview(7)
    await giveFeedback(7, 4, 'good', 'more tests')
    await acceptInterview('SYSTEM_DESIGN')
    expect(fetch.mock.calls.map(c => [c[0].replace(/^.*\/interviews/, ''), c[1].method])).toEqual([['/7/cancel', 'POST'], ['/7/feedback', 'POST'], ['/accept', 'POST']])
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ rating: 4, strengths: 'good', improve: 'more tests' })
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ type: 'SYSTEM_DESIGN' })
  })
})

describe('slot helpers', () => {
  it('turns a local date-time into an exact UTC moment, and nothing into an empty string', () => {
    expect(slotToIso('2026-12-01T10:00')).toBe(new Date('2026-12-01T10:00').toISOString())
    expect(slotToIso('')).toBe('')
  })
  it('formats a slot, or says "a time you agree on" when there is none', () => {
    expect(formatSlot(null)).toBe('a time you agree on')
    expect(formatSlot('2026-12-01T10:00:00Z')).toMatch(/Dec/)
  })
})
