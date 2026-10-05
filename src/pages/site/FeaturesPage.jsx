import { Link } from 'react-router'
import { Icon } from '../../components/Icon.jsx'
import { Kbd, Reveal, SectionHead, usePageTitle } from '../../components/ui.jsx'
import { DemoNote } from '../../components/DemoNote.jsx'

const GROUPS = [
  {
    id: 'timer',
    icon: Icon.Clock,
    eyebrow: 'Timer',
    title: 'A timer built for real days',
    body: 'Focus blocks, short breaks and a long break after each round. Every length is yours to set.',
    points: [
      'Counts from timestamps, so sleep, background tabs and slow devices never make it drift',
      'Keeps running while you browse the rest of the site, with a live countdown in the header and tab title',
      'Survives a reload: refresh mid block and it carries on',
      'Log interruptions with one key and see which work gets interrupted most',
      'Stop early and anything over a minute is kept as an unfinished block',
      'Optional chime and desktop notifications, and three kinds of generated background noise',
    ],
  },
  {
    id: 'insights',
    icon: Icon.Chart,
    eyebrow: 'Insights',
    title: 'Numbers you can trust, and read',
    body: 'Insights compares each period with the one before, and says n/a rather than invent a percentage.',
    points: [
      'Focused time per day against your goal, over 7, 30 or 90 days',
      'Hour by weekday heatmap that splits sessions across the hours they cover',
      'Time by tag, with interruption rate and finish rate for each',
      'A focus score out of 100 with the formula printed underneath',
      'Current and longest streaks that survive daylight saving changes',
      'Every chart has a hover and keyboard tooltip and a text summary for screen readers',
    ],
  },
  {
    id: 'assistant',
    icon: Icon.Message,
    eyebrow: 'Assistant',
    title: 'Ask your data a question',
    body: 'The assistant reads a list of facts computed from your sessions, and is only allowed to say what is in them.',
    points: [
      'Each figure in an answer is numbered and links to the fact it came from',
      'With an Anthropic key on the server, Claude writes the answer; without one, a rule based answerer does',
      'Citations that do not match a real fact are removed, and an answer that cites nothing is not trusted',
      'Your question is passed to the model as data, so it cannot rewrite the rules',
      'If the API fails, the offline answerer replies and the answer is labelled as a fallback',
    ],
  },
  {
    id: 'teams',
    icon: Icon.Users,
    eyebrow: 'Teams',
    title: 'Protect team focus without watching anyone',
    body: 'Teams see totals and trends. Nobody sees another person’s numbers, and nobody can work them out.',
    points: [
      'Team figures appear only once three people have joined',
      'Only totals, per member averages, busiest hours and tag mix are shown',
      'Invite with a code or link; make a new code to stop the old one working',
      'Owners can remove members, hand over ownership or delete the team',
    ],
  },
  {
    id: 'developer',
    icon: Icon.Plug,
    eyebrow: 'Developers',
    title: 'Webhooks and an API that behave',
    body: 'The integration layer is built the way production integrations should be.',
    points: [
      'Webhooks signed with HMAC SHA 256 over the timestamp and body',
      'Retries 5xx, 408 and 429 with doubling delays and respects Retry After; stops at once on other 4xx',
      'Redirects are not followed and private network addresses are refused',
      'Every delivery is logged with its response; failed ones can be replayed',
      'Personal API tokens, read only or read and write, stored only as digests',
    ],
  },
  {
    id: 'privacy',
    icon: Icon.Shield,
    eyebrow: 'Privacy and security',
    title: 'Safe defaults all the way down',
    body: 'The whole app works without an account. When you do sign up, your data is handled carefully.',
    points: [
      'Passwords stored with salted scrypt; five wrong attempts lock an email for 15 minutes',
      'Login cookies are HttpOnly, SameSite and Secure; every change needs a header other sites cannot send',
      'Changing your password logs out every other device; you can see and end each login',
      'A strict Content Security Policy and the usual protective headers on every response',
      'Download all your data as JSON, or delete your account and everything in it',
    ],
  },
]

const SHORTCUTS = [
  [['Space'], 'Start or pause the timer'],
  [['I'], 'Log an interruption'],
  [['S'], 'Stop the current block'],
  [['N'], 'Skip the break'],
  [['Ctrl', 'K'], 'Open the command menu anywhere'],
]

export default function FeaturesPage() {
  usePageTitle('Features')
  return (
    <>
      <section className="page-hero container">
        <span className="eyebrow">Features</span>
        <h1>Everything in Pulse</h1>
        <p className="hero-sub">One app for timing focus, understanding it and sharing it safely. Here is what each part does, and how.</p>
        <DemoNote>This live demo runs entirely in your browser: the timer, insights, history and assistant all work. Accounts, teams, webhooks and the API are built into the full version with its Node and SQLite server.</DemoNote>
        <nav className="jump-links" aria-label="On this page">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" onClick={() => document.getElementById(g.id)?.scrollIntoView({ behavior: 'smooth' })}>
              {g.eyebrow}
            </button>
          ))}
        </nav>
      </section>

      {GROUPS.map((g, i) => {
        const GIcon = g.icon
        return (
          <section key={g.id} id={g.id} className={`section feature-section ${i % 2 ? 'section-muted' : ''}`}>
            <div className="container feature-detail">
              <Reveal>
                <span className="feature-icon feature-icon-lg">
                  <GIcon width={24} height={24} />
                </span>
                <span className="eyebrow">{g.eyebrow}</span>
                <h2>{g.title}</h2>
                <p className="muted">{g.body}</p>
              </Reveal>
              <Reveal delay={0.08}>
                <ul className="checklist">
                  {g.points.map((p) => (
                    <li key={p}>
                      <Icon.Check /> {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>
        )
      })}

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Keyboard" title="Shortcuts" sub="Pulse is built to be used without the mouse." />
          <div className="shortcut-table">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="shortcut-row">
                <span>{label}</span>
                <span className="row">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="center mt-lg">
            <Link to="/app" className="btn btn-primary btn-lg">
              Try it now <Icon.Arrow />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
