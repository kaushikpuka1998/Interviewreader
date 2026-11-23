import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../lib/billing.js', async importOriginal => ({
  ...(await importOriginal()),
  fetchPremiumPlans: vi.fn(),
  buyPremium: vi.fn(),
}))
vi.mock('../lib/analytics.js', () => ({ trackFunnel: vi.fn(), trackClick: vi.fn() }))
vi.mock('../lib/promo.js', () => ({ validateCoupon: vi.fn() }))
vi.mock('../lib/auth.js', () => ({ getUser: () => ({ email: 'a@b.com' }) }))
import PremiumPlans from './PremiumPlans.jsx'
import { fetchPremiumPlans, buyPremium } from '../lib/billing.js'
import { validateCoupon } from '../lib/promo.js'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('ir_currency', 'INR')
  fetchPremiumPlans.mockResolvedValue([
    { key: 'monthly', price: 2200, regular: 0 },
    { key: 'yearly', price: 6500, regular: 9000 },
    { key: 'lifetime', price: 14000, regular: 0 },
  ])
})

describe('PremiumPlans', () => {
  it('shows each pass with its price and a one-time-payment note', async () => {
    render(<PremiumPlans onClose={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Get Monthly' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Get Yearly' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Get Lifetime' })).toBeTruthy()
    expect(screen.getAllByText(/One-time payment \(no auto-renewal\)/).length).toBe(3)
    expect(screen.getByText('Most Popular')).toBeTruthy()
  })

  it('buys the chosen pass and tells the page it worked', async () => {
    buyPremium.mockResolvedValue({})
    const onBought = vi.fn()
    render(<PremiumPlans onClose={() => {}} onBought={onBought} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Get Yearly' }))
    await waitFor(() => expect(onBought).toHaveBeenCalled())
    expect(buyPremium).toHaveBeenCalledWith('yearly', undefined, 'INR')
    expect(JSON.parse(localStorage.getItem('ir_user')).premium).toBe(true)
  })

  it('stays quiet when the member closes the payment window, but shows real errors', async () => {
    render(<PremiumPlans onClose={() => {}} />)
    buyPremium.mockRejectedValueOnce(new Error('Payment cancelled.'))
    await userEvent.click(await screen.findByRole('button', { name: 'Get Monthly' }))
    await waitFor(() => expect(buyPremium).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Payment cancelled.')).toBeNull()
    buyPremium.mockRejectedValueOnce(new Error('Card declined'))
    await userEvent.click(screen.getByRole('button', { name: 'Get Monthly' }))
    expect(await screen.findByText('Card declined')).toBeTruthy()
  })

  it('applies a valid coupon: shows the new price and sends the code with the order', async () => {
    validateCoupon.mockImplementation(async plan => (plan === 'monthly'
      ? { valid: true, finalPrice: 1980, discount: 220 } : { valid: false, message: 'Not for this pass' }))
    buyPremium.mockResolvedValue({})
    render(<PremiumPlans onClose={() => {}} />)
    await screen.findByRole('button', { name: 'Get Monthly' })
    await userEvent.type(screen.getByPlaceholderText('ENTER CODE'), 'save10')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText(/SAVE10 applied\./)).toBeTruthy()
    expect(screen.getByText(/Save/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Get Monthly' }))
    await waitFor(() => expect(buyPremium).toHaveBeenCalledWith('monthly', 'SAVE10', 'INR'))
    await userEvent.click(screen.getByRole('button', { name: 'Get Yearly' }))
    await waitFor(() => expect(buyPremium).toHaveBeenLastCalledWith('yearly', undefined, 'INR'))
  })

  it('says so when a coupon is not valid', async () => {
    validateCoupon.mockResolvedValue({ valid: false, message: 'That code has expired' })
    render(<PremiumPlans onClose={() => {}} />)
    await screen.findByRole('button', { name: 'Get Monthly' })
    await userEvent.type(screen.getByPlaceholderText('ENTER CODE'), 'old')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('That code has expired')).toBeTruthy()
  })

  it('switches currency: reloads prices in it, buys in it, and drops an applied coupon', async () => {
    fetchPremiumPlans.mockImplementation(async c => (c === 'USD'
      ? [{ key: 'monthly', price: 25, regular: 0, currency: 'USD' }]
      : [{ key: 'monthly', price: 2200, regular: 0, currency: 'INR' }]))
    validateCoupon.mockResolvedValue({ valid: true, finalPrice: 1980, discount: 220 })
    buyPremium.mockResolvedValue({})
    render(<PremiumPlans onClose={() => {}} />)
    await screen.findByText('₹2,200')
    await userEvent.type(screen.getByPlaceholderText('ENTER CODE'), 'save10')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await screen.findByText(/SAVE10 applied\./)
    await userEvent.selectOptions(screen.getByLabelText('Pay in'), 'USD')
    expect(await screen.findByText('$25')).toBeTruthy()
    expect(screen.queryByText(/SAVE10 applied\./)).toBeNull()
    expect(fetchPremiumPlans).toHaveBeenLastCalledWith('USD')
    expect(localStorage.getItem('ir_currency')).toBe('USD')
    await userEvent.click(screen.getByRole('button', { name: 'Get Monthly' }))
    await waitFor(() => expect(buyPremium).toHaveBeenCalledWith('monthly', undefined, 'USD'))
  })

  it('falls back to rupees when the server does not price in the saved currency', async () => {
    localStorage.setItem('ir_currency', 'EUR')
    fetchPremiumPlans.mockResolvedValue([{ key: 'monthly', price: 2200, regular: 0, currency: 'INR' }])
    render(<PremiumPlans onClose={() => {}} />)
    expect(await screen.findByText('₹2,200')).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText('Pay in').value).toBe('INR'))
  })

  it('closes with Escape and with the X button', async () => {
    const onClose = vi.fn()
    render(<PremiumPlans onClose={onClose} />)
    await screen.findByRole('button', { name: 'Get Monthly' })
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
