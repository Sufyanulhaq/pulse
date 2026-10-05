/**
 * Plans and what each one unlocks. Prices are in the smallest currency unit.
 * When Stripe is not configured the service runs in beta mode: every feature
 * is open to every account, which is how the hosted beta works.
 */
export const PLANS = {
  free: { id: 'free', name: 'Personal', monthly: 0, yearly: 0 },
  pro: { id: 'pro', name: 'Pro', monthly: 600, yearly: 6000 },
  team: { id: 'team', name: 'Team', monthly: 1000, yearly: 10000, perSeat: true, minSeats: 3, maxSeats: 50 },
}

const FEATURES = {
  free: { webhooks: false, apiTokens: false, claudeAssistant: false, createTeams: false },
  pro: { webhooks: true, apiTokens: true, claudeAssistant: true, createTeams: false },
  team: { webhooks: true, apiTokens: true, claudeAssistant: true, createTeams: true },
}

// Stripe statuses that still count as paid. past_due keeps access while Stripe retries the card.
const PAID = new Set(['active', 'trialing', 'past_due'])

export function billingEnabled(config) {
  return Boolean(config.stripe?.secretKey)
}

export function effectivePlan(user, config) {
  if (!billingEnabled(config)) return 'team'
  if (user.plan && user.plan !== 'free' && PAID.has(user.plan_status)) return user.plan
  return 'free'
}

export function entitlements(user, config) {
  return { ...FEATURES[effectivePlan(user, config)] }
}

export const FEATURE_MESSAGES = {
  webhooks: 'Webhooks are part of the Pro plan.',
  apiTokens: 'API tokens are part of the Pro plan.',
  createTeams: 'Creating a team needs the Team plan. Anyone can join a team for free.',
}

export function billingSummary(user, config) {
  return {
    enabled: billingEnabled(config),
    plan: user.plan || 'free',
    effectivePlan: effectivePlan(user, config),
    status: user.plan_status || null,
    interval: user.plan_interval || null,
    seats: user.plan_seats || null,
    periodEnd: user.plan_period_end || null,
    cancelAtPeriodEnd: Boolean(user.plan_cancel_at_period_end),
    hasCustomer: Boolean(user.stripe_customer_id),
    features: entitlements(user, config),
  }
}
