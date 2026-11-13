import { trackFunnel } from './analytics.js'

// Premium (paid roadmaps) is a one-time pass paid as a Razorpay order; system design practice is a monthly subscription.
// The backend creates the order/subscription and verifies every payment; this file only loads Checkout and relays the result.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

function headers() {
  return { 'Content-Type': 'application/json' }
}

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: headers(), credentials: 'include', body: body && JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data
}

// Full roadmap for premium members, a teaser (no concepts / cheat sheets / practice links) for everyone else.
export const fetchRoadmaps = () => call('/roadmaps')
export const fetchPremiumPlans = () => call('/billing/plans')
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

// Opens Razorpay Checkout for an order or subscription the backend just created, and resolves once the backend has verified it;
// rejects if the member closes the window or payment fails.
function checkout(sub, { name, description, verifyPath }) {
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: sub.keyId,
      ...(sub.orderId ? { order_id: sub.orderId, amount: sub.amount, currency: 'INR' } : { subscription_id: sub.subscriptionId }),
      name,
      description,
      prefill: { email: sub.email, name: sub.name },
      theme: { color: '#047857' },
      handler: resp => call(verifyPath, 'POST', resp).then(resolve, reject),
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
    })
    rzp.on('payment.failed', r => reject(new Error(r.error?.description || 'Payment failed.')))
    rzp.open()
  })
}

export const PREMIUM_PLAN_NAMES = { sprint: '30-Day Pass', monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' }

// Premium (roadmaps) pass: 'monthly' | 'yearly' | 'lifetime', one-time payment, no auto-renewal.
export async function buyPremium(plan, coupon) {
  trackFunnel('checkout_started')
  const [order] = await Promise.all([call('/billing/premium/order', 'POST', { plan, coupon: coupon || undefined }), loadCheckout()])
  const done = await checkout(order, { name: 'Interview Reader Premium', description: `${PREMIUM_PLAN_NAMES[plan]} pass · ₹${(order.amount / 100).toLocaleString('en-IN')}`, verifyPath: '/billing/premium/verify' })
  trackFunnel('paid')
  return done
}

// System design practice plan: 'p12' | 'p18' | 'p24' (attempts per month). Separate from Premium.
export async function subscribePractice(plan) {
  const [sub] = await Promise.all([call('/billing/practice/subscribe', 'POST', { plan }), loadCheckout()])
  return checkout(sub, { name: 'System Design Practice', description: `${sub.attempts} scored attempts a month · ${sub.priceLabel}`, verifyPath: '/billing/practice/verify' })
}

export const cancelPracticePlan = () => call('/billing/practice/cancel', 'POST')

// Peer mock interview plan: 'i5' | 'i10' (interviews per month). Separate from Premium, which includes a few a month.
export async function subscribeInterviewPlan(plan) {
  const [sub] = await Promise.all([call('/billing/interviews/subscribe', 'POST', { plan }), loadCheckout()])
  return checkout(sub, { name: 'Mock Interviews', description: `${sub.interviews} mock interviews a month · ${sub.priceLabel}`, verifyPath: '/billing/interviews/verify' })
}

export const cancelInterviewPlan = () => call('/billing/interviews/cancel', 'POST')
