import { describe, it, expect, beforeEach, vi } from 'vitest'
import { detectCurrency, formatMoney, rememberCurrency } from './currency.js'

function locale(language, tz) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language)
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: tz }) })
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('detectCurrency', () => {
  it('uses rupees for India, by time zone or locale', () => {
    locale('en-US', 'Asia/Kolkata'); expect(detectCurrency()).toBe('INR')
    locale('en-IN', 'UTC'); expect(detectCurrency()).toBe('INR')
  })
  it('picks pounds, euros, otherwise dollars', () => {
    locale('en-GB', 'Europe/London'); expect(detectCurrency()).toBe('GBP')
    locale('de-DE', 'Europe/Berlin'); expect(detectCurrency()).toBe('EUR')
    locale('en-US', 'America/New_York'); expect(detectCurrency()).toBe('USD')
    locale('ja-JP', 'Asia/Tokyo'); expect(detectCurrency()).toBe('USD')
  })
  it('a saved choice beats detection, and an unknown saved value is ignored', () => {
    locale('en-IN', 'Asia/Kolkata')
    rememberCurrency('GBP'); expect(detectCurrency()).toBe('GBP')
    localStorage.setItem('ir_currency', 'JPY'); expect(detectCurrency()).toBe('INR')
  })
})

describe('formatMoney', () => {
  it('formats whole units with the right symbol', () => {
    expect(formatMoney(2200, 'INR')).toBe('₹2,200')
    expect(formatMoney(25, 'USD')).toBe('$25')
    expect(formatMoney(23, 'EUR')).toBe('€23')
    expect(formatMoney(19, 'GBP')).toBe('£19')
  })
})
