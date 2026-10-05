import { Badge, Reveal, usePageTitle } from '../../components/ui.jsx'

const ENTRIES = [
  {
    version: '1.1',
    date: '5 October 2026',
    title: 'Account email, backups and a live demo',
    tag: ['primary', 'Feature'],
    items: [
      'Email confirmation, forgotten password reset and an email when your password changes',
      'Optional Stripe subscription support in the server, switched off by default',
      'A live demo that runs entirely in the browser, deployed on Vercel',
      'Invite people to a team by email',
      'Scheduled database backups with an admin Back up now button',
      'Continuous integration: lint, 100 unit and API tests, a build and a 16 step browser test on every push',
    ],
  },
  {
    version: '1.0',
    date: '5 October 2026',
    title: 'Pulse becomes a full product',
    tag: ['primary', 'Major'],
    items: [
      'A working focus timer with breaks, rounds, interruptions, ambient sound, chimes and desktop notifications',
      'Insights: daily totals against a goal, hour by weekday heatmap, tags, streaks and a documented focus score',
      'History with search, filters, sorting, editing, CSV export and JSON backup and restore',
      'Accounts with sync across devices, an offline outbox and a one click move of local sessions to your account',
      'An assistant that answers from your own data with citations, using Claude or an offline answerer',
      'Teams with invite codes, owner controls and privacy thresholds',
      'Signed webhooks with retries, a delivery log and replay; personal API tokens',
      'API reference, webhook guide and an in browser signature checker',
      'Light and dark themes, a command menu, and keyboard shortcuts throughout',
      'A Node and SQLite API server, covered by 76 unit and API tests and a 13 step browser test',
    ],
  },
  {
    version: '0.1',
    date: '26 August 2026',
    title: 'Landing page concept',
    tag: ['neutral', 'First release'],
    items: ['Animated hero with a scroll linked stat panel', 'Scroll triggered reveal sections', 'Full reduced motion support'],
  },
]

export default function ChangelogPage() {
  usePageTitle('Changelog')
  return (
    <>
      <section className="page-hero container">
        <span className="eyebrow">Changelog</span>
        <h1>What is new</h1>
        <p className="hero-sub">Every release, newest first.</p>
      </section>
      <section className="container narrow changelog">
        {ENTRIES.map((e, i) => (
          <Reveal key={e.version} delay={i * 0.05} as="article" className="release">
            <div className="release-meta">
              <span className="release-version">v{e.version}</span>
              <time>{e.date}</time>
            </div>
            <div className="release-body">
              <div className="row">
                <h2>{e.title}</h2>
                <Badge tone={e.tag[0]}>{e.tag[1]}</Badge>
              </div>
              <ul>
                {e.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </section>
    </>
  )
}
