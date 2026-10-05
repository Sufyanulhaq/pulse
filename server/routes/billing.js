import { Router } from 'express'
import { z } from 'zod'
import { HttpError, badRequest, conflict, parse, route } from '../http.js'
import { PLANS, billingEnabled, billingSummary } from '../plans.js'

function notConfigured() {
  return new HttpError(400, 'billing_off', 'Billing is not set up on this server, so every feature is already free.')
}

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'team']),
  interval: z.enum(['month', 'year']).default('month'),
  seats: z.number().int().min(1).max(50).optional(),
})

/** Checkout, the customer portal and the plan summary. */
export function billingRoutes({ db, config, stripe }) {
  const r = Router()

  r.get('/', (req, res) => {
    res.json({ billing: billingSummary(req.user, config), plans: PLANS, currency: config.stripe.currency })
  })

  r.post(
    '/checkout',
    route(async (req, res) => {
      if (!billingEnabled(config) || !stripe) throw notConfigured()
      if (!req.user.email_verified_at) throw new HttpError(403, 'unverified', 'Confirm your email address before upgrading, so receipts reach you.')
      const body = parse(checkoutSchema, req.body)
      const plan = PLANS[body.plan]
      const seats = plan.perSeat ? body.seats ?? plan.minSeats : 1
      if (plan.perSeat && (seats < plan.minSeats || seats > plan.maxSeats)) {
        throw badRequest(`The Team plan is for ${plan.minSeats} to ${plan.maxSeats} people.`, { seats: 'Out of range.' })
      }
      if (req.user.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(req.user.plan_status)) {
        throw conflict('You already have a subscription. Change it from Manage billing.')
      }

      let customer = req.user.stripe_customer_id
      if (!customer) {
        const created = await stripe.customers.create({ email: req.user.email, name: req.user.name, metadata: { userId: req.user.id } })
        customer = created.id
        db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer, req.user.id)
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        client_reference_id: req.user.id,
        line_items: [
          {
            quantity: seats,
            price_data: {
              currency: config.stripe.currency,
              unit_amount: body.interval === 'year' ? plan.yearly : plan.monthly,
              recurring: { interval: body.interval },
              product_data: { name: `Pulse ${plan.name}`, metadata: { plan: plan.id } },
            },
          },
        ],
        subscription_data: { metadata: { userId: req.user.id, plan: plan.id } },
        allow_promotion_codes: true,
        success_url: `${config.appUrl}/app/billing?status=success`,
        cancel_url: `${config.appUrl}/app/billing?status=cancelled`,
      })
      res.json({ url: session.url })
    }),
  )

  r.post(
    '/portal',
    route(async (req, res) => {
      if (!billingEnabled(config) || !stripe) throw notConfigured()
      if (!req.user.stripe_customer_id) throw badRequest('There is no billing account yet. Choose a plan first.')
      const session = await stripe.billingPortal.sessions.create({ customer: req.user.stripe_customer_id, return_url: `${config.appUrl}/app/billing` })
      res.json({ url: session.url })
    }),
  )

  return r
}

/** Bring a user's plan in line with a Stripe subscription object. */
export function applySubscription(db, sub, logger) {
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  let user = sub.metadata?.userId ? db.prepare('SELECT * FROM users WHERE id = ?').get(sub.metadata.userId) : null
  if (!user && customer) user = db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customer)
  if (!user) {
    logger.error({ subscription: sub.id }, 'subscription for an unknown user')
    return false
  }
  // An older subscription event must not overwrite a newer subscription.
  if (user.stripe_subscription_id && user.stripe_subscription_id !== sub.id && sub.status === 'canceled') return false

  const item = sub.items?.data?.[0]
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null
  const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired'
  const plan = ended ? 'free' : PLANS[sub.metadata?.plan] ? sub.metadata.plan : 'pro'
  db.prepare(
    `UPDATE users SET plan = ?, plan_status = ?, plan_interval = ?, plan_seats = ?, plan_period_end = ?,
     plan_cancel_at_period_end = ?, stripe_customer_id = COALESCE(stripe_customer_id, ?), stripe_subscription_id = ?
     WHERE id = ?`,
  ).run(
    plan,
    sub.status,
    item?.price?.recurring?.interval ?? null,
    item?.quantity ?? null,
    periodEnd ? periodEnd * 1000 : null,
    sub.cancel_at_period_end ? 1 : 0,
    customer ?? null,
    ended ? null : sub.id,
    user.id,
  )
  return true
}

/** Stripe calls this. The body must stay raw so the signature can be checked. */
export function stripeWebhook({ db, config, stripe, logger }) {
  return route(async (req, res) => {
    if (!stripe || !config.stripe.webhookSecret) throw notConfigured()
    let event
    try {
      event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature') || '', config.stripe.webhookSecret)
    } catch (err) {
      throw badRequest(`Signature check failed: ${err.message}`)
    }
    // Stripe can send the same event more than once.
    const fresh = db.prepare('INSERT OR IGNORE INTO stripe_events (id, type, received_at) VALUES (?, ?, ?)').run(event.id, event.type, Date.now()).changes
    if (!fresh) return res.json({ received: true, duplicate: true })

    try {
      const object = event.data.object
      if (event.type === 'checkout.session.completed' && object.mode === 'subscription' && object.subscription) {
        const subId = typeof object.subscription === 'string' ? object.subscription : object.subscription.id
        applySubscription(db, await stripe.subscriptions.retrieve(subId), logger)
      } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
        applySubscription(db, object, logger)
      }
    } catch (err) {
      // Let Stripe retry: forget the event so the retry is processed.
      db.prepare('DELETE FROM stripe_events WHERE id = ?').run(event.id)
      throw err
    }
    res.json({ received: true })
  })
}
