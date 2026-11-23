// Which currency to show Premium prices in. The server owns the actual prices (fixed per currency, never converted live);
// this only picks a sensible default from the visitor's locale and remembers their choice.
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP']

const EURO = new Set(['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'HR'])

export function detectCurrency() {
  try {
    const saved = localStorage.getItem('ir_currency')
    if (CURRENCIES.includes(saved)) return saved
  } catch { /* storage blocked: fall through to detection */ }
  let tz = ''
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { /* ignore */ }
  const region = ((typeof navigator !== 'undefined' && navigator.language) || '').split('-')[1]?.toUpperCase()
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta' || region === 'IN' || !region) return 'INR'
  if (region === 'GB') return 'GBP'
  if (EURO.has(region)) return 'EUR'
  return 'USD'
}

export function rememberCurrency(c) { try { localStorage.setItem('ir_currency', c) } catch { /* ignore */ } }

// ₹2,200 / $25 / €23 / £19 (whole units: every price on the site is a whole number).
export function formatMoney(n, currency = 'INR') {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(n))
}
