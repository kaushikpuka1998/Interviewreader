// Premium (paid roadmaps) via a Razorpay monthly subscription. The backend creates the subscription
// and verifies every payment; this file only loads Checkout and relays the result.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

function headers() {
  const token = localStorage.getItem('ir_token')
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: headers(), credentials: 'include', body: body && JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data
}

// Full roadmap for premium members, a teaser (no concepts / cheat sheets / practice links) for everyone else.
export const fetchRoadmaps = () => call('/roadmaps')
export const fetchBillingStatus = () => call('/billing/status')
export const cancelSubscription = () => call('/billing/cancel', 'POST')

let checkoutScript
function loadCheckout() {
  checkoutScript ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = resolve
    s.onerror = () => { checkoutScript = null; reject(new Error('Could not load the payment window. Check your connection.')) }
    document.body.appendChild(s)
  })
  return checkoutScript
}

// Opens Razorpay Checkout for the monthly plan. Resolves with the new billing status once the
// backend has verified the payment; rejects if the member closes the window or payment fails.
export async function subscribe() {
  const [sub] = await Promise.all([call('/billing/subscribe', 'POST'), loadCheckout()])
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: sub.keyId,
      subscription_id: sub.subscriptionId,
      name: 'Interview Reader Premium',
      description: `Personalized company roadmaps · ${sub.priceLabel}`,
      prefill: { email: sub.email, name: sub.name },
      theme: { color: '#db2777' },
      handler: resp => call('/billing/verify', 'POST', resp).then(resolve, reject),
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
    })
    rzp.on('payment.failed', r => reject(new Error(r.error?.description || 'Payment failed.')))
    rzp.open()
  })
}
