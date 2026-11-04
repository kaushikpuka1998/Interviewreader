import { useEffect, useState } from 'react'
import { fetchBanner, TONES } from '../lib/promo.js'

// The offer strip an admin can switch on (see Admin > Offers): a message, an optional coupon code with a copy button, and a button.
// One request per page load (the server caches it); a visitor can close it, and it comes back if the admin changes it.
export function BannerStrip({ banner, onClose }) {
  const [copied, setCopied] = useState(false)
  const tone = TONES[banner.tone] || TONES.amber
  const copy = () => {
    try { localStorage.setItem('ir_coupon', banner.couponCode) } catch { /* private mode: the code is still on screen */ }   // checkout prefills it
    navigator.clipboard?.writeText(banner.couponCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }
  const external = /^https?:\/\//i.test(banner.ctaUrl || '')
  // A button to the pricing screen carries the banner's coupon, so the code is already in the box when the plans open.
  const href = banner.couponCode && /^\/pricing\/?$/.test(banner.ctaUrl || '') ? `/pricing?coupon=${encodeURIComponent(banner.couponCode)}` : banner.ctaUrl
  return (
    <div role="region" aria-label="Offer" className={`relative !flex-none border-b border-white/10 px-10 py-2.5 text-center text-sm ${tone.bar}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        <span className="font-medium">{banner.message}</span>
        {banner.couponCode && (
          <span className={`inline-flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-1 ${tone.chip}`}>
            <span className="font-mono text-sm font-bold tracking-wider">{banner.couponCode}</span>
            {banner.couponLabel && <span className="text-xs font-semibold opacity-90">{banner.couponLabel}</span>}
            <button type="button" onClick={copy} className="rounded bg-white/15 px-1.5 py-0.5 text-xs font-semibold hover:bg-white/25" data-track="promo_copy_coupon">{copied ? 'Copied ✓' : 'Copy'}</button>
          </span>
        )}
        {banner.ctaUrl && banner.ctaLabel && (
          <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} data-track="promo_banner_cta"
            className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold shadow-md transition ${tone.cta}`}>{banner.ctaLabel} →</a>
        )}
      </div>
      {onClose && <button type="button" onClick={onClose} aria-label="Close offer" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-lg leading-none opacity-70 hover:opacity-100">×</button>}
    </div>
  )
}

export default function PromoBanner() {
  const [banner, setBanner] = useState(null)
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return
    fetchBanner().then(b => {
      if (!b.active) return
      try { if (b.dismissible && localStorage.getItem('ir_banner_closed') === String(b.id)) return } catch { /* show it */ }
      setBanner(b)
    }).catch(() => {})
  }, [])
  if (!banner) return null
  const close = banner.dismissible ? () => { try { localStorage.setItem('ir_banner_closed', String(banner.id)) } catch { /* it just comes back next time */ } setBanner(null) } : undefined
  return <BannerStrip banner={banner} onClose={close} />
}
