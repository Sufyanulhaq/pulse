import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon.jsx'
import { Reveal, SectionHead, Segmented, usePageTitle } from '../../components/ui.jsx'

const PLANS = [
  {
    id: 'free',
    name: 'Personal',
    monthly: 0,
    blurb: 'Everything one person needs, for good.',
    cta: 'Start free',
    features: ['Unlimited focus sessions', 'Insights for 7, 30 and 90 days', 'Offline assistant', 'CSV and JSON export', 'Sync across devices with an account'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 6,
    blurb: 'For people who live in their timer.',
    cta: 'Upgrade to Pro',
    featured: true,
    features: ['Everything in Personal', 'Assistant answers written by Claude', 'Webhooks with delivery log and replay', 'Personal API tokens', 'Priority email support'],
  },
  {
    id: 'team',
    name: 'Team',
    monthly: 10,
    perSeat: true,
    blurb: 'Protect focus time across a team.',
    cta: 'Start a team',
    features: ['Everything in Pro, for each member', 'Team insights with privacy thresholds', 'Invite codes and owner controls', 'Up to 50 members per team', 'Admin overview'],
  },
]

const COMPARE = [
  ['Focus timer, breaks and rounds', true, true, true],
  ['Insights, heatmap and focus score', true, true, true],
  ['Export and import', true, true, true],
  ['Sync across devices', true, true, true],
  ['Assistant (offline)', true, true, true],
  ['Assistant written by Claude', false, true, true],
  ['Signed webhooks', false, true, true],
  ['API tokens', false, true, true],
  ['Team insights', false, false, true],
  ['Team owner controls', false, false, true],
]

const FAQ = [
  ['How do payments work?', 'Payments go through Stripe, so card details never touch Pulse. Upgrade, change seats, download invoices or cancel any time from Billing in the app. Cancelling keeps your plan until the end of the period you paid for.'],
  ['What happens if I downgrade?', 'Your sessions and history stay. Webhooks pause and API tokens stop working until you upgrade again; nothing is deleted.'],
  ['Do I need an account?', 'No. The timer, insights, history, assistant and export all work in your browser without one. An account adds sync, teams, webhooks and the API.'],
  ['Where is my data stored?', 'Without an account, only in your browser’s local storage. With an account, in the Pulse database on the server. You can download all of it or delete it at any time from Settings.'],
  ['Can my manager see my numbers?', 'No. Teams only ever show totals and averages, and only once at least three people have joined, so no one can work out an individual’s figures.'],
  ['Is it open source?', 'Yes. The whole app, front end and server, is MIT licensed on GitHub. You can run your own copy.'],
]

export default function PricingPage() {
  usePageTitle('Pricing')
  const [billing, setBilling] = useState('annual')
  const [seats, setSeats] = useState(8)
  const [open, setOpen] = useState(0)
  const [beta, setBeta] = useState(false)
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => setBeta(!h.billing))
      .catch(() => {})
  }, [])
  const price = (p) => (billing === 'annual' ? Math.round(p.monthly * 10) / 12 : p.monthly)

  return (
    <>
      <section className="page-hero container center">
        <span className="eyebrow">Pricing</span>
        <h1>{beta ? 'Simple pricing. Free during the beta.' : 'Simple, honest pricing'}</h1>
        <p className="hero-sub center-text">
          {beta ? 'Every feature is free while the beta runs. These are the plans that start when it ends, with at least 30 days of notice.' : 'Start without an account. Upgrade only if you want what the bigger plans add.'}
        </p>
        <div className="billing-toggle">
          <Segmented
            label="Billing period"
            value={billing}
            onChange={setBilling}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'annual', label: 'Annual · 2 months free' },
            ]}
          />
        </div>
      </section>

      <section className="container plans">
        {PLANS.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.06} className={`plan ${p.featured ? 'plan-featured' : ''}`}>
            {p.featured && <span className="plan-flag">Most popular</span>}
            <h2>{p.name}</h2>
            <p className="muted small">{p.blurb}</p>
            <div className="plan-price">
              <span className="plan-amount">£{price(p).toFixed(price(p) % 1 ? 2 : 0)}</span>
              <span className="plan-unit">{p.monthly ? `per ${p.perSeat ? 'seat per ' : ''}month` : 'for ever'}</span>
            </div>
            {p.monthly > 0 && <p className="small muted">{billing === 'annual' ? `£${p.monthly * 10} billed yearly${p.perSeat ? ' per seat' : ''}` : 'Billed monthly'}</p>}
            {p.perSeat && (
              <div className="seat-calc">
                <label htmlFor="seats" className="small">
                  Team size: <strong>{seats}</strong>
                </label>
                <input id="seats" type="range" min="3" max="50" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
                <p className="small">
                  <strong>£{(price(p) * seats).toFixed(2)}</strong> <span className="muted">a month for {seats} people</span>
                </p>
              </div>
            )}
            <Link to={p.monthly ? (beta ? '/app' : '/app/billing') : '/app'} className={`btn btn-block ${p.featured ? 'btn-primary' : 'btn-ghost'}`}>
              {beta && p.monthly ? 'Free during the beta' : p.cta}
            </Link>
            <ul className="plan-features">
              {p.features.map((f) => (
                <li key={f}>
                  <Icon.Check width={16} height={16} /> {f}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </section>

      <section className="section">
        <div className="container">
          <SectionHead title="Compare plans" />
          <div className="table-wrap">
            <table className="table compare">
              <thead>
                <tr>
                  <th>Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="center-text">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, ...cells]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {cells.map((on, i) => (
                      <td key={i} className="center-text">
                        {on ? (
                          <>
                            <Icon.Check width={18} height={18} className="yes" />
                            <span className="sr-only">Included</span>
                          </>
                        ) : (
                          <>
                            <span className="no" aria-hidden="true">·</span>
                            <span className="sr-only">Not included</span>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container narrow">
          <SectionHead title="Questions" />
          <div className="faq">
            {FAQ.map(([q, a], i) => (
              <div key={q} className={`faq-item ${open === i ? 'open' : ''}`}>
                <h3>
                  <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                    {q}
                    <Icon.Plus width={18} height={18} />
                  </button>
                </h3>
                {open === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
