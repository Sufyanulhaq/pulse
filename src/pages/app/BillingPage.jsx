import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../../api.js'
import { useAuth } from '../../state/AuthContext.jsx'
import { useToast } from '../../state/ToastContext.jsx'
import { Icon } from '../../components/Icon.jsx'
import { Badge, Segmented, Spinner, usePageTitle } from '../../components/ui.jsx'

const FEATURE_LIST = {
  free: ['Unlimited sessions and insights', 'Offline assistant', 'Export, import and sync', 'Join any team'],
  pro: ['Everything in Personal', 'Assistant answers written by Claude', 'Signed webhooks with replay', 'Personal API tokens'],
  team: ['Everything in Pro', 'Create and run teams', 'Team insights with privacy thresholds', 'Seats for 3 to 50 people'],
}

const STATUS = {
  active: ['good', 'Active'],
  trialing: ['good', 'Trial'],
  past_due: ['warn', 'Payment failed, retrying'],
  unpaid: ['danger', 'Unpaid'],
  canceled: ['neutral', 'Cancelled'],
  incomplete: ['warn', 'Waiting for payment'],
}

function money(pence, currency) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: pence % 100 ? 2 : 0 }).format(pence / 100)
}

export default function BillingPage() {
  usePageTitle('Billing')
  const { user, refresh } = useAuth()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [interval, setBillingInterval] = useState('year')
  const [seats, setSeats] = useState(5)
  const [busy, setBusy] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    api.get('/billing').then(setData).catch((err) => toast(err.message, { tone: 'error' }))
  }, [toast])

  // Coming back from Stripe Checkout.
  useEffect(() => {
    const status = params.get('status')
    if (!status || handled.current) return
    handled.current = true
    if (status === 'success') {
      toast('Thanks! Your plan is being activated. It can take a few seconds to show here.', { tone: 'success', duration: 7000 })
      // Stripe confirms through a webhook, so check again shortly.
      setTimeout(() => {
        refresh()
        api.get('/billing').then(setData).catch(() => {})
      }, 3000)
    } else if (status === 'cancelled') {
      toast('Checkout cancelled. Nothing was charged.')
    }
    setParams({}, { replace: true })
  }, [params, setParams, toast, refresh])

  if (!data) return <Spinner />
  const { billing, plans, currency } = data

  const go = async (path, body) => {
    setBusy(path + (body?.plan || ''))
    try {
      const r = await api.post(path, body)
      window.location.assign(r.url)
    } catch (err) {
      toast(err.message, { tone: 'error' })
      setBusy('')
    }
  }

  const current = billing.effectivePlan
  const status = billing.status && STATUS[billing.status]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <p>Your plan, payments and invoices. Payments are handled securely by Stripe; card details never touch Pulse.</p>
        </div>
      </div>

      {!billing.enabled && (
        <div className="callout callout-good">
          <Icon.Sparkle width={18} height={18} />
          <div>
            <strong>Pulse is in public beta, so every feature is free.</strong> Paid plans switch on when billing is turned on for this server. You will hear by email at least 30 days before.
          </div>
        </div>
      )}

      {billing.enabled && (
        <section className="card billing-current">
          <div>
            <span className="small muted">Current plan</span>
            <h2>{plans[current]?.name || 'Personal'}</h2>
            <div className="row mt-sm">
              {status && <Badge tone={status[0]}>{status[1]}</Badge>}
              {billing.seats && billing.plan === 'team' ? <Badge>{billing.seats} seats</Badge> : null}
              {billing.interval ? <Badge>Billed {billing.interval === 'year' ? 'yearly' : 'monthly'}</Badge> : null}
            </div>
            {billing.periodEnd && (
              <p className="small muted mt-sm">
                {billing.cancelAtPeriodEnd ? 'Ends on ' : 'Renews on '}
                {new Date(billing.periodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {billing.status === 'past_due' && <p className="field-error mt-sm">Your last payment failed. Update your card in Manage billing to keep your plan.</p>}
          </div>
          {billing.hasCustomer && (
            <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => go('/billing/portal')}>
              {busy === '/billing/portal' ? <Spinner /> : <Icon.External width={15} height={15} />} Manage billing and invoices
            </button>
          )}
        </section>
      )}

      {billing.enabled && !user.emailVerified && (
        <div className="callout callout-warn mt">
          <Icon.Mail width={18} height={18} />
          <div>Confirm your email address before upgrading, so your receipts reach you. The link is in your inbox, or resend it from Settings.</div>
        </div>
      )}

      <div className="billing-toggle-row">
        <Segmented
          label="Billing period"
          value={interval}
          onChange={setBillingInterval}
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'year', label: 'Yearly · 2 months free' },
          ]}
        />
      </div>

      <div className="plans billing-plans">
        {['free', 'pro', 'team'].map((id) => {
          const p = plans[id]
          const unit = interval === 'year' ? p.yearly : p.monthly
          const qty = p.perSeat ? seats : 1
          const isCurrent = current === id && (billing.enabled || id === 'team')
          const paidActive = billing.enabled && current !== 'free'
          return (
            <div key={id} className={`plan ${id === 'pro' ? 'plan-featured' : ''}`}>
              <div className="row">
                <h2>{p.name}</h2>
                {isCurrent && <Badge tone="good">{billing.enabled ? 'Your plan' : 'Included in beta'}</Badge>}
              </div>
              <div className="plan-price">
                <span className="plan-amount">{unit ? money(interval === 'year' ? unit / 12 : unit, currency) : money(0, currency)}</span>
                <span className="plan-unit">{unit ? `per ${p.perSeat ? 'seat per ' : ''}month` : 'for ever'}</span>
              </div>
              {unit > 0 && (
                <p className="small muted">
                  {money(unit * qty, currency)} {interval === 'year' ? 'a year' : 'a month'}
                  {p.perSeat ? ` for ${qty} people` : ''}
                </p>
              )}
              {p.perSeat && (
                <div className="seat-calc">
                  <label htmlFor="billing-seats" className="small">
                    Seats: <strong>{seats}</strong>
                  </label>
                  <input id="billing-seats" type="range" min={p.minSeats} max={p.maxSeats} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
                </div>
              )}
              <ul className="plan-features">
                {FEATURE_LIST[id].map((f) => (
                  <li key={f}>
                    <Icon.Check width={16} height={16} /> {f}
                  </li>
                ))}
              </ul>
              {id !== 'free' && billing.enabled && (
                <button
                  className={`btn btn-block ${id === 'pro' ? 'btn-primary' : 'btn-ghost'}`}
                  type="button"
                  disabled={Boolean(busy) || isCurrent || !user.emailVerified}
                  onClick={() => (paidActive ? go('/billing/portal') : go('/billing/checkout', { plan: id, interval, seats: p.perSeat ? seats : undefined }))}
                >
                  {busy === `/billing/checkout${id}` && <Spinner />}
                  {isCurrent ? 'Current plan' : paidActive ? 'Switch in Manage billing' : `Upgrade to ${p.name}`}
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="small muted center-text mt">Prices include VAT where it applies. Cancel any time; you keep your plan until the end of the period you paid for.</p>
    </>
  )
}
