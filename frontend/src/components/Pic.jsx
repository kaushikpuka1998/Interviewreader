import { useEffect, useState } from 'react'

// A profile picture that falls back to `fallback` (usually the initial letter) if there is none or it fails to load, e.g. a Google
// picture URL that expired. no-referrer: Google's image host refuses some requests that carry another site as the referrer.
export default function Pic({ src, fallback, className = 'h-full w-full rounded-full object-cover' }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [src])
  if (!src || bad) return fallback
  return <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} className={className} />
}
