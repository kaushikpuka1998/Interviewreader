import { useEffect, useState } from 'react'
import { adminBanner, saveBanner, adminCoupons, createCoupon, updateCoupon, deleteCoupon, TONES } from '../lib/promo.js'
import { BannerStrip } from './PromoBanner.jsx'

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const label = 'mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300'
const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950'
const PLANS = ['monthly', 'yearly', 'lifetime']

// The input wants "YYYY-MM-DDTHH:mm" in the admin's own time zone; the server stores an exact instant.
const toLocal = iso => { if (!iso) return ''; const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
const fromLocal = v => (v ? new Date(v).toISOString() : '')
const when = iso => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')

function BannerEditor({ coupons }) {
  const [b, setB] = useState(null)
  const [msg, setMsg] = useState(null)   // { ok, text }
  const [busy, setBusy] = useState(false)
  useEffect(() => { adminBanner().then(setB).catch(e => setMsg({ ok: false, text: e.message })) }, [])
  if (!b) return <p className="text-sm text-slate-500">{msg ? msg.text : 'Loading…'}</p>
  const set = k => e => setB(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const coupon = coupons.find(c => c.code === b.couponCode)
  const save = async e => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try { setB(await saveBanner({ ...b, startsAt: b.startsAt, endsAt: b.endsAt })); setMsg({ ok: true, text: b.enabled ? 'Saved. The banner is live for its audience.' : 'Saved. The banner is off.' }) }
    catch (x) { setMsg({ ok: false, text: x.message }) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={save} className={`${card} space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Site banner</h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={b.enabled} onChange={set('enabled')} className="h-4 w-4 accent-emerald-600" /> Show the banner
        </label>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">The strip at the very top of every page. Switch it on to announce an offer; add a coupon code so visitors can copy it.</p>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <BannerStrip banner={{ ...b, message: b.message || 'Your message appears here.', couponCode: b.couponCode, couponLabel: coupon?.label, ctaUrl: b.ctaUrl || (b.ctaLabel ? '#' : ''), dismissible: b.dismissible }} />
      </div>

      <div><label className={label} htmlFor="bn-msg">Message <span className="font-normal text-slate-500">({b.message.length}/200)</span></label>
        <input id="bn-msg" className={input} value={b.message} onChange={set('message')} maxLength={200} placeholder="🎉 Diwali sale: Premium for less, this week only." /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={label} htmlFor="bn-coupon">Coupon to show</label>
          <select id="bn-coupon" className={input} value={b.couponCode} onChange={set('couponCode')}>
            <option value="">None</option>
            {coupons.map(c => <option key={c.id} value={c.code}>{c.code} · {c.label}{c.live ? '' : ' (not live)'}</option>)}
          </select></div>
        <div><label className={label} htmlFor="bn-cta">Button label</label>
          <input id="bn-cta" className={input} value={b.ctaLabel} onChange={set('ctaLabel')} maxLength={40} placeholder="Get Premium" /></div>
        <div><label className={label} htmlFor="bn-url">Button link</label>
          <input id="bn-url" className={input} value={b.ctaUrl} onChange={set('ctaUrl')} maxLength={300} placeholder="/pricing" />
          <p className="mt-1 text-[11px] text-slate-500">/pricing opens the Premium plans screen (the coupon is filled in for them).</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className={label} htmlFor="bn-aud">Who sees it</label>
          <select id="bn-aud" className={input} value={b.audience} onChange={set('audience')}>
            <option value="all">Everyone</option><option value="signed-out">Signed-out visitors</option><option value="free">Signed-in members without Premium</option>
          </select></div>
        <div><label className={label}>Colour</label>
          <div className="flex gap-1.5">{Object.keys(TONES).map(t => (
            <button key={t} type="button" onClick={() => setB(s => ({ ...s, tone: t }))} aria-pressed={b.tone === t}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize ${b.tone === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{t}</button>))}</div></div>
        <div><label className={label} htmlFor="bn-from">Starts (optional)</label>
          <input id="bn-from" type="datetime-local" className={input} value={toLocal(b.startsAt)} onChange={e => setB(s => ({ ...s, startsAt: fromLocal(e.target.value) }))} /></div>
        <div><label className={label} htmlFor="bn-to">Ends (optional)</label>
          <input id="bn-to" type="datetime-local" className={input} value={toLocal(b.endsAt)} onChange={e => setB(s => ({ ...s, endsAt: fromLocal(e.target.value) }))} /></div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={b.dismissible} onChange={set('dismissible')} className="h-4 w-4 accent-emerald-600" /> Visitors can close it (it returns when you change the banner)</label>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Saving…' : 'Save banner'}</button>
    </form>
  )
}

const BLANK = { code: '', kind: 'percent', value: 20, appliesTo: [], active: true, startsAt: '', endsAt: '', maxRedemptions: '', note: '' }

function CouponForm({ initial, onDone, onCancel }) {
  const editing = !!initial?.id
  const [c, setC] = useState(initial || BLANK)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = k => e => setC(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const togglePlan = p => setC(s => ({ ...s, appliesTo: s.appliesTo.includes(p) ? s.appliesTo.filter(x => x !== p) : [...s.appliesTo, p] }))
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    const body = { ...c, value: Number(c.value), maxRedemptions: c.maxRedemptions === '' || c.maxRedemptions == null ? null : Number(c.maxRedemptions) }
    try { await (editing ? updateCoupon(c.id, body) : createCoupon(body)); onDone() } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className={label} htmlFor="cp-code">Code</label>
          <input id="cp-code" className={`${input} font-mono uppercase`} value={c.code} onChange={e => setC(s => ({ ...s, code: e.target.value.toUpperCase() }))} disabled={editing} maxLength={24} placeholder="DIWALI20" required /></div>
        <div><label className={label} htmlFor="cp-kind">Type</label>
          <select id="cp-kind" className={input} value={c.kind} onChange={set('kind')}><option value="percent">Percent off</option><option value="flat">Flat ₹ off</option></select></div>
        <div><label className={label} htmlFor="cp-val">{c.kind === 'percent' ? 'Percent (1-90)' : 'Rupees off'}</label>
          <input id="cp-val" type="number" min="1" className={input} value={c.value} onChange={set('value')} required /></div>
        <div><label className={label} htmlFor="cp-max">Total uses (empty = unlimited)</label>
          <input id="cp-max" type="number" min="1" className={input} value={c.maxRedemptions ?? ''} onChange={set('maxRedemptions')} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Works on:</span>
        {PLANS.map(p => <label key={p} className="flex cursor-pointer items-center gap-1.5 text-sm capitalize text-slate-700 dark:text-slate-300"><input type="checkbox" checked={c.appliesTo.includes(p)} onChange={() => togglePlan(p)} className="accent-emerald-600" />{p}</label>)}
        <span className="text-xs text-slate-500">(none ticked = all passes)</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={label} htmlFor="cp-from">Starts (optional)</label><input id="cp-from" type="datetime-local" className={input} value={toLocal(c.startsAt)} onChange={e => setC(s => ({ ...s, startsAt: fromLocal(e.target.value) }))} /></div>
        <div><label className={label} htmlFor="cp-to">Ends (optional)</label><input id="cp-to" type="datetime-local" className={input} value={toLocal(c.endsAt)} onChange={e => setC(s => ({ ...s, endsAt: fromLocal(e.target.value) }))} /></div>
        <div><label className={label} htmlFor="cp-note">Note (only you see it)</label><input id="cp-note" className={input} value={c.note} onChange={set('note')} maxLength={200} placeholder="Diwali campaign" /></div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={c.active} onChange={set('active')} className="h-4 w-4 accent-emerald-600" /> Active</label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Save coupon' : 'Create coupon'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
      </div>
    </form>
  )
}

// Admin > Offers: the site banner, and the discount coupons members can apply when buying a Premium pass.
export default function PromoAdmin() {
  const [coupons, setCoupons] = useState(null)
  const [form, setForm] = useState(null)   // null | 'new' | coupon being edited
  const [error, setError] = useState('')
  const load = () => adminCoupons().then(setCoupons).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  const del = async c => { if (!window.confirm(`Delete ${c.code}? Members who used it keep their Premium.`)) return; try { await deleteCoupon(c.id); load() } catch (e) { setError(e.message) } }
  const toggle = async c => { try { await updateCoupon(c.id, { ...c, appliesTo: c.appliesTo, active: !c.active }); load() } catch (e) { setError(e.message) } }
  const btn = 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold dark:border-slate-600'
  return (
    <div className="space-y-4">
      <BannerEditor coupons={coupons || []} />
      <section className={`${card} space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Coupons</h3>
          {!form && <button type="button" onClick={() => setForm('new')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">+ New coupon</button>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Members type a code in the Premium checkout. The discount is worked out on the server, a code counts as used only after the payment goes through, and each member can use a code once.</p>
        {form && <CouponForm key={form === 'new' ? 'new' : form.id} initial={form === 'new' ? null : form} onCancel={() => setForm(null)} onDone={() => { setForm(null); load() }} />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!coupons ? <p className="text-sm text-slate-500">Loading…</p> : coupons.length === 0 ? <p className="text-sm text-slate-500">No coupons yet.</p> : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {coupons.map(c => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono font-bold tracking-wider text-slate-900 dark:bg-slate-800 dark:text-slate-100">{c.code}</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">{c.label}</span>
                <span className="text-xs text-slate-500">{c.appliesTo.length ? c.appliesTo.join(', ') : 'all passes'} · used {c.redemptions}{c.maxRedemptions ? ` of ${c.maxRedemptions}` : ''}{c.startsAt ? ` · from ${when(c.startsAt)}` : ''}{c.endsAt ? ` · until ${when(c.endsAt)}` : ''}{c.note ? ` · ${c.note}` : ''}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.live ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{c.live ? 'Live' : c.active ? 'Not live now' : 'Off'}</span>
                <span className="ml-auto flex gap-1.5">
                  <button type="button" onClick={() => setForm(c)} className={btn}>Edit</button>
                  <button type="button" onClick={() => toggle(c)} className={btn}>{c.active ? 'Turn off' : 'Turn on'}</button>
                  <button type="button" onClick={() => del(c)} className={`${btn} text-rose-600 dark:text-rose-400`}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
