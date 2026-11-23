import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./analytics.js', () => ({ trackFunnel: vi.fn() }))
import { buyPremium, subscribePractice, subscribeInterviewPlan, fetchPremiumPlans, cancelSubscription } from './billing.js'
import { trackFunnel } from './analytics.js'

const json = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) })
let rzpOptions, rzpHandlers

beforeEach(() => {
  vi.clearAllMocks()
  rzpHandlers = {}
  rzpOptions = undefined
  // The Razorpay checkout script: pretend it loads at once and that Razorpay is available.
  vi.spyOn(document.body, 'appendChild').mockImplementation(el => { queueMicrotask(() => el.onload?.()); return el })
  window.Razorpay = function (opts) {
    rzpOptions = opts
    this.on = (evt, cb) => { rzpHandlers[evt] = cb }
    this.open = () => {}
  }
})

describe('Premium checkout', () => {
  it('creates the order, opens Razorpay with it, and verifies the payment on the server', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(json({ keyId: 'rzp_test', orderId: 'order_1', amount: 220000, email: 'a@b.com', name: 'A' }))
      .mockResolvedValueOnce(json({ premium: true }))
    const done = buyPremium('monthly', 'SAVE10')
    await vi.waitFor(() => expect(rzpOptions).toBeTruthy())
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/billing\/premium\/order$/)
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({ plan: 'monthly', coupon: 'SAVE10' })
    expect(rzpOptions).toMatchObject({ key: 'rzp_test', order_id: 'order_1', amount: 220000, currency: 'INR' })
    expect(rzpOptions.description).toContain('Monthly')
    const resp = { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig' }
    rzpOptions.handler(resp)
    await expect(done).resolves.toEqual({ premium: true })
    expect(globalThis.fetch.mock.calls[1][0]).toMatch(/\/billing\/premium\/verify$/)
    expect(JSON.parse(globalThis.fetch.mock.calls[1][1].body)).toEqual(resp)
    expect(trackFunnel).toHaveBeenCalledWith('checkout_started')
    expect(trackFunnel).toHaveBeenCalledWith('paid')
  })

  it('opens Razorpay in the currency the server created the order in', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(json({ keyId: 'k', orderId: 'o', amount: 2500, currency: 'USD' }))
    buyPremium('monthly', undefined, 'USD')
    await vi.waitFor(() => expect(rzpOptions).toBeTruthy())
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({ plan: 'monthly', currency: 'USD' })
    expect(rzpOptions).toMatchObject({ amount: 2500, currency: 'USD' })
    expect(rzpOptions.description).toContain('$25')
  })

  it('asks for plans in a currency', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json([]))
    await fetchPremiumPlans('EUR')
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/billing\/plans\?currency=EUR$/)
    await fetchPremiumPlans()
    expect(globalThis.fetch.mock.calls[1][0]).toMatch(/\/billing\/plans$/)
  })

  it('omits the coupon when none is given', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(json({ keyId: 'k', orderId: 'o', amount: 100 }))
    buyPremium('yearly')
    await vi.waitFor(() => expect(rzpOptions).toBeTruthy())
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({ plan: 'yearly' })
  })

  it('rejects with "Payment cancelled." when the window is closed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(json({ keyId: 'k', orderId: 'o', amount: 100 }))
    const done = buyPremium('monthly')
    await vi.waitFor(() => expect(rzpOptions).toBeTruthy())
    rzpOptions.modal.ondismiss()
    await expect(done).rejects.toThrow('Payment cancelled.')
    expect(trackFunnel).not.toHaveBeenCalledWith('paid')
  })

  it('rejects with the reason when the payment fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(json({ keyId: 'k', orderId: 'o', amount: 100 }))
    const done = buyPremium('monthly')
    await vi.waitFor(() => expect(rzpOptions).toBeTruthy())
    rzpHandlers['payment.failed']({ error: { description: 'Card declined' } })
    await expect(done).rejects.toThrow('Card declined')
  })

  it('surfaces a server error when the order cannot be created', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(json({ error: 'Unknown plan' }, false))
    await expect(buyPremium('nope')).rejects.toThrow('Unknown plan')
  })

  it('uses a friendly message when the server gives no reason', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: () => Promise.reject(new Error('no body')) })
    await expect(fetchPremiumPlans()).rejects.toThrow('Something went wrong. Please try again.')
  })
})

describe('Subscriptions and other billing calls', () => {
  it('system design plans verify through their own endpoint', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(json({ keyId: 'k', subscriptionId: 'sub_1', attempts: 12, priceLabel: '₹499/month' }))
      .mockResolvedValueOnce(json({ ok: true }))
    const done = subscribePractice('p12')
    await vi.waitFor(() => expect(rzpOptions).toBeTruthy())
    expect(rzpOptions.subscription_id).toBe('sub_1')
    expect(rzpOptions.description).toContain('12 scored attempts')
    rzpOptions.handler({ razorpay_payment_id: 'p', razorpay_subscription_id: 'sub_1', razorpay_signature: 's' })
    await done
    expect(globalThis.fetch.mock.calls[1][0]).toMatch(/\/billing\/practice\/verify$/)
  })

  it('mock interview plans verify through their own endpoint', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(json({ keyId: 'k', subscriptionId: 'sub_2', interviews: 5, priceLabel: '₹499/month' }))
      .mockResolvedValueOnce(json({ ok: true }))
    const done = subscribeInterviewPlan('i5')
    await vi.waitFor(() => expect(rzpOptions).toBeTruthy())
    expect(rzpOptions.description).toContain('5 mock interviews')
    rzpOptions.handler({})
    await done
    expect(globalThis.fetch.mock.calls[1][0]).toMatch(/\/billing\/interviews\/verify$/)
  })

  it('cancelling posts to /billing/cancel', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(json({}))
    await cancelSubscription()
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/billing\/cancel$/)
    expect(globalThis.fetch.mock.calls[0][1].method).toBe('POST')
  })
})
