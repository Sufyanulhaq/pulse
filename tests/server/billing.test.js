import Stripe from 'stripe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, makeSession, receiver, signup, startServer, wait } from './helpers.js'

const WEBHOOK_SECRET = 'whsec_test_billing'
const real = new Stripe('sk_test_not_used')

/** A stand in for the Stripe client. Signature checks use the real library. */
function fakeStripe() {
  const calls = { customers: [], checkout: [], portal: [] }
  const subscriptions = new Map()
  return {
    calls,
    subscriptions,
    webhooks: real.webhooks,
    customers: { create: async (p) => (calls.customers.push(p), { id: `cus_${calls.customers.length}` }) },
    checkout: { sessions: { create: async (p) => (calls.checkout.push(p), { id: 'cs_1', url: 'https://checkout.stripe.test/c/cs_1' }) } },
    billingPortal: { sessions: { create: async (p) => (calls.portal.push(p), { url: 'https://billing.stripe.test/p/1' }) } },
    subscriptions: { retrieve: async (id) => subscriptions.get(id) },
    _subs: subscriptions,
  }
}

function subscription({ id = 'sub_1', userId, customer, plan = 'pro', status = 'active', interval = 'month', quantity = 1, cancel = false }) {
  return {
    id,
    object: 'subscription',
    customer,
    status,
    cancel_at_period_end: cancel,
    metadata: { userId, plan },
    items: { data: [{ quantity, current_period_end: 1893456000, price: { recurring: { interval } } }] },
  }
}

let srv
let stripe
beforeAll(async () => {
  stripe = fakeStripe()
  srv = await startServer({ stripe: { secretKey: 'sk_test_x', webhookSecret: WEBHOOK_SECRET, currency: 'gbp' } }, { stripe })
})
afterAll(() => srv.close())

let eventCount = 0
async function sendEvent(type, object, { secret = WEBHOOK_SECRET, id } = {}) {
  eventCount += 1
  const payload = JSON.stringify({ id: id || `evt_${eventCount}`, type, data: { object } })
  const header = real.webhooks.generateTestHeaderString({ payload, secret })
  const res = await fetch(`${srv.url}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header }, body: payload })
  return { status: res.status, data: await res.json() }
}

async function verifiedUser(name) {
  const c = await signup(srv.url, name)
  const mail = [...srv.mailer.outbox].reverse().find((m) => m.to === `${name.toLowerCase()}@example.com` && m.template === 'verify')
  await c.post('/api/auth/verify', { token: new URL(mail.data.url).searchParams.get('token') })
  const me = (await c.get('/api/auth/me')).data.user
  return { c, me }
}

describe('plans when billing is on', () => {
  it('starts free, with paid features locked', async () => {
    const { c, me } = await verifiedUser('Freddie')
    expect(me.billing).toMatchObject({ enabled: true, effectivePlan: 'free' })
    expect((await c.post('/api/webhooks', { url: 'https://example.com/x' })).status).toBe(402)
    expect((await c.post('/api/tokens', { name: 'x' })).status).toBe(402)
    expect((await c.post('/api/teams', { name: 'Nope' })).status).toBe(402)
    // Everything personal still works on the free plan.
    expect((await c.post('/api/sessions', makeSession())).status).toBe(201)
  })

  it('lists plans and prices', async () => {
    const { c } = await verifiedUser('Lister')
    const res = await c.get('/api/billing')
    expect(res.data.plans.pro.monthly).toBe(600)
    expect(res.data.currency).toBe('gbp')
  })
})

describe('checkout and the portal', () => {
  it('needs a confirmed email', async () => {
    const c = await signup(srv.url, 'Unverified')
    expect((await c.post('/api/billing/checkout', { plan: 'pro' })).status).toBe(403)
  })

  it('creates one customer and a subscription checkout', async () => {
    const { c, me } = await verifiedUser('Buyer')
    const res = await c.post('/api/billing/checkout', { plan: 'team', interval: 'year', seats: 8 })
    expect(res.data.url).toMatch(/checkout\.stripe\.test/)
    const sent = stripe.calls.checkout.at(-1)
    expect(sent).toMatchObject({ mode: 'subscription', client_reference_id: me.id, subscription_data: { metadata: { userId: me.id, plan: 'team' } } })
    expect(sent.line_items[0]).toMatchObject({ quantity: 8, price_data: { unit_amount: 10000, currency: 'gbp', recurring: { interval: 'year' } } })
    expect(sent.success_url).toBe('https://pulse.test/app/billing?status=success')
    await c.post('/api/billing/checkout', { plan: 'pro' })
    expect(stripe.calls.customers.filter((x) => x.metadata.userId === me.id)).toHaveLength(1)
  })

  it('validates plan and seats', async () => {
    const { c } = await verifiedUser('Seats')
    expect((await c.post('/api/billing/checkout', { plan: 'gold' })).status).toBe(400)
    expect((await c.post('/api/billing/checkout', { plan: 'team', seats: 2 })).status).toBe(400)
  })

  it('opens the portal only for customers', async () => {
    const { c } = await verifiedUser('Portal')
    expect((await c.post('/api/billing/portal')).status).toBe(400)
    await c.post('/api/billing/checkout', { plan: 'pro' })
    const res = await c.post('/api/billing/portal')
    expect(res.data.url).toMatch(/billing\.stripe\.test/)
  })
})

describe('the Stripe webhook', () => {
  it('rejects a bad signature', async () => {
    const res = await sendEvent('customer.subscription.updated', {}, { secret: 'whsec_wrong' })
    expect(res.status).toBe(400)
  })

  it('upgrades after checkout, unlocks features, and ignores repeats', async () => {
    const { c, me } = await verifiedUser('Payer')
    await c.post('/api/billing/checkout', { plan: 'pro' })
    const customer = srv.db.prepare('SELECT stripe_customer_id AS id FROM users WHERE id = ?').get(me.id).id
    stripe._subs.set('sub_payer', subscription({ id: 'sub_payer', userId: me.id, customer }))
    const first = await sendEvent('checkout.session.completed', { mode: 'subscription', subscription: 'sub_payer' }, { id: 'evt_payer' })
    expect(first.data).toEqual({ received: true })
    const again = await sendEvent('checkout.session.completed', { mode: 'subscription', subscription: 'sub_payer' }, { id: 'evt_payer' })
    expect(again.data.duplicate).toBe(true)

    const billing = (await c.get('/api/billing')).data.billing
    expect(billing).toMatchObject({ plan: 'pro', effectivePlan: 'pro', status: 'active', interval: 'month', periodEnd: 1893456000000 })
    expect((await c.post('/api/tokens', { name: 'Script' })).status).toBe(201)
    expect((await c.post('/api/teams', { name: 'x' })).status).toBe(402)
    expect((await c.post('/api/billing/checkout', { plan: 'pro' })).status).toBe(409)
  })

  it('downgrades on cancellation: tokens stop, webhooks stop sending', async () => {
    const hook = await receiver([200])
    const { c, me } = await verifiedUser('Leaver')
    await c.post('/api/billing/checkout', { plan: 'pro' })
    const customer = srv.db.prepare('SELECT stripe_customer_id AS id FROM users WHERE id = ?').get(me.id).id
    await sendEvent('customer.subscription.created', subscription({ id: 'sub_l', userId: me.id, customer }))
    const token = (await c.post('/api/tokens', { name: 'T', scope: 'write' })).data.token
    await c.post('/api/webhooks', { url: hook.url })

    await sendEvent('customer.subscription.updated', subscription({ id: 'sub_l', userId: me.id, customer, cancel: true }))
    expect((await c.get('/api/billing')).data.billing.cancelAtPeriodEnd).toBe(true)

    await sendEvent('customer.subscription.deleted', subscription({ id: 'sub_l', userId: me.id, customer, status: 'canceled' }))
    expect((await c.get('/api/billing')).data.billing.effectivePlan).toBe('free')
    const viaToken = await client(srv.url).get('/api/sessions', { Authorization: `Bearer ${token}`, 'X-Requested-With': '' })
    expect(viaToken.status).toBe(402)
    await c.post('/api/sessions', makeSession())
    await srv.worker.tick()
    await wait(50)
    expect(hook.calls).toHaveLength(0)
    await hook.close()
  })

  it('keeps access while a payment is being retried, and finds users by customer id', async () => {
    const { c, me } = await verifiedUser('Late')
    await c.post('/api/billing/checkout', { plan: 'team', seats: 5 })
    const customer = srv.db.prepare('SELECT stripe_customer_id AS id FROM users WHERE id = ?').get(me.id).id
    const sub = subscription({ id: 'sub_late', userId: undefined, customer, plan: 'team', status: 'past_due', quantity: 5 })
    sub.metadata = { plan: 'team' }
    await sendEvent('customer.subscription.updated', sub)
    const billing = (await c.get('/api/billing')).data.billing
    expect(billing).toMatchObject({ effectivePlan: 'team', seats: 5, status: 'past_due' })
    expect((await c.post('/api/teams', { name: 'Paid team' })).status).toBe(201)
    await sendEvent('customer.subscription.updated', { ...sub, status: 'unpaid' })
    expect((await c.get('/api/billing')).data.billing.effectivePlan).toBe('free')
  })
})

describe('beta mode', () => {
  it('leaves every feature open and refuses checkout when Stripe is not set up', async () => {
    const beta = await startServer()
    const c = await signup(beta.url, 'Beta')
    expect((await c.get('/api/auth/me')).data.user.billing).toMatchObject({ enabled: false, effectivePlan: 'team' })
    expect((await c.post('/api/tokens', { name: 'x' })).status).toBe(201)
    expect((await c.post('/api/billing/checkout', { plan: 'pro' })).data.error.code).toBe('billing_off')
    await beta.close()
  })
})
