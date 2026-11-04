import { shared } from './memo.js'
// Offers: the site banner (public) and the Premium discount coupons (admin sets them up; members apply them at checkout).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method, credentials: 'include', ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status })
  return data
}

export const fetchBanner = () => shared('banner', 60_000, () => call('/public/banner'))
export const validateCoupon = (plan, code) => call('/billing/coupon/validate', 'POST', { plan, code })

export const adminBanner = () => call('/admin/banner')
export const saveBanner = b => call('/admin/banner', 'PUT', b)
export const adminCoupons = () => call('/admin/coupons')
export const createCoupon = c => call('/admin/coupons', 'POST', c)
export const updateCoupon = (id, c) => call(`/admin/coupons/${id}`, 'PUT', c)
export const deleteCoupon = id => call(`/admin/coupons/${id}`, 'DELETE')

export const TONES = {
  amber: { bar: 'bg-slate-950 text-white', cta: 'bg-amber-400 text-slate-900 hover:bg-amber-300 shadow-amber-500/30', chip: 'border-amber-300/60 text-amber-200' },
  emerald: { bar: 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 text-white', cta: 'bg-white text-emerald-900 hover:bg-emerald-50 shadow-black/20', chip: 'border-white/50 text-white' },
  violet: { bar: 'bg-gradient-to-r from-violet-900 via-violet-800 to-fuchsia-800 text-white', cta: 'bg-white text-violet-900 hover:bg-violet-50 shadow-black/20', chip: 'border-white/50 text-white' },
}
