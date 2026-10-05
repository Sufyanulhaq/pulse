import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '../../components/Icon.jsx'
import { BarChart, Heatmap, ShareBar } from '../../components/Charts.jsx'
import { Reveal, SectionHead, usePageTitle } from '../../components/ui.jsx'
import { sampleSessions } from '../../lib/sample.js'
import { byTag, dailySeries, hourWeekMatrix } from '../../lib/stats.js'
import { WEEKDAYS, duration } from '../../lib/format.js'
import { answerOffline, buildFacts } from '../../lib/assistant.js'
import { DEFAULT_SETTINGS } from '../../lib/settings.js'
import { REPO_URL } from '../../components/SiteLayout.jsx'

const FACTS = [
  { value: '0', label: 'accounts needed to start' },
  { value: '100%', label: 'of features work offline' },
  { value: '3', label: 'signed webhook events' },
  { value: 'MIT', label: 'open source licence' },
]

const FEATURES = [
  { icon: Icon.Clock, title: 'A timer that cannot drift', body: 'Built on timestamps, not ticks. Sleep your laptop or switch tabs and the countdown is still exact.' },
  { icon: Icon.Chart, title: 'Insights you will act on', body: 'Daily totals against your goal, an hour by weekday heatmap, tag breakdowns and a focus score you can read the formula for.' },
  { icon: Icon.Message, title: 'An assistant that cites', body: 'Ask “when do I focus best?” and every figure in the answer links to where it came from. No data, no guess.' },
  { icon: Icon.Users, title: 'Teams without surveillance', body: 'Team totals appear only once three people join, and never per person. Protect focus time without watching anyone.' },
  { icon: Icon.Plug, title: 'Signed webhooks', body: 'HMAC SHA 256 signatures, retries with backoff, a delivery log and one click replay. Send sessions anywhere.' },
  { icon: Icon.Key, title: 'A personal API', body: 'Read your stats or log sessions from scripts with scoped tokens. Read only by default.' },
  { icon: Icon.Shield, title: 'Private by default', body: 'No account needed. Sessions live in your browser until you choose to sync them, and you can export or delete everything.' },
  { icon: Icon.Command, title: 'Keyboard first', body: 'Space to start, I to log an interruption, Ctrl K to go anywhere. Your hands stay on the keys.' },
]

const STORY = [
  { icon: Icon.Target, clause: 'Pick a task. Press space.' },
  { icon: Icon.Bell, clause: 'Log interruptions with one key.' },
  { icon: Icon.Chart, clause: 'See the patterns build up.' },
  { icon: Icon.Sparkle, clause: 'Ask what to change.' },
]

const TOUR = [
  { id: 'insights', label: 'Insights', icon: Icon.Chart },
  { id: 'heatmap', label: 'Heatmap', icon: Icon.Calendar },
  { id: 'assistant', label: 'Assistant', icon: Icon.Message },
  { id: 'developer', label: 'Webhooks', icon: Icon.Code },
]

function HeroVisual() {
  const reduce = useReducedMotion()
  const bars = [38, 62, 45, 80, 58, 95, 70]
  return (
    <motion.div className="hero-visual" initial={reduce ? false : { opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}>
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Focus this week</span>
          <span className="panel-score">
            86<small>/100</small>
          </span>
        </div>
        <div className="bars">
          {bars.map((h, i) => (
            <div className="bar-col" key={i}>
              <motion.span
                className={`bar ${i === 5 ? 'bar-hi' : ''}`}
                initial={reduce ? false : { height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.05, ease: 'easeOut' }}
              />
              <span className="bar-label">{WEEKDAYS[i].slice(0, 1)}</span>
            </div>
          ))}
        </div>
      </div>
      <motion.div className="floating-card floating-card-1" initial={reduce ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }}>
        <span className="floating-icon blue" aria-hidden="true">
          <Icon.Target width={16} height={16} />
        </span>
        2h 14m deep work
      </motion.div>
      <motion.div className="floating-card floating-card-2" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.85 }}>
        <span className="floating-icon orange" aria-hidden="true">
          <Icon.Bell width={16} height={16} />
        </span>
        Break in 12 min
      </motion.div>
    </motion.div>
  )
}

function ProductTour() {
  const [tab, setTab] = useState('insights')
  const data = useMemo(() => {
    const sessions = sampleSessions()
    const recent = sessions.filter((s) => s.start > Date.now() - 30 * 86_400_000)
    const facts = buildFacts(sessions, DEFAULT_SETTINGS)
    return {
      daily: dailySeries(sessions, 14),
      matrix: hourWeekMatrix(recent),
      tags: byTag(recent),
      answer: answerOffline('When do I focus best?', facts),
    }
  }, [])

  return (
    <div className="tour">
      <div className="tour-tabs" role="tablist" aria-label="Product tour">
        {TOUR.map((t) => {
          const TabIcon = t.icon
          return (
            <button key={t.id} role="tab" type="button" id={`tour-${t.id}`} aria-selected={tab === t.id} aria-controls="tour-panel" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <TabIcon width={16} height={16} /> {t.label}
            </button>
          )
        })}
      </div>
      <div className="tour-window" id="tour-panel" role="tabpanel" aria-labelledby={`tour-${tab}`}>
        <div className="tour-chrome" aria-hidden="true">
          <span />
          <span />
          <span />
          <em>pulse / app / {tab}</em>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} className="tour-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {tab === 'insights' && (
              <>
                <h3>Focused time per day, against your goal</h3>
                <BarChart
                  data={data.daily.map((d) => ({ label: new Date(d.date).getDate().toString(), title: new Date(d.date).toDateString(), value: Math.round(d.minutes) }))}
                  goal={120}
                  format={(v) => duration(v)}
                  highlightLast
                  summary="Sample focused minutes for the last 14 days"
                />
              </>
            )}
            {tab === 'heatmap' && (
              <div className="tour-split">
                <div>
                  <h3>When you focus, hour by hour</h3>
                  <Heatmap matrix={data.matrix} />
                </div>
                <div>
                  <h3>Where the time goes</h3>
                  <ShareBar items={data.tags.map((t) => ({ label: t.tag, value: Math.round(t.minutes) }))} format={(v) => duration(v)} />
                </div>
              </div>
            )}
            {tab === 'assistant' && (
              <div className="tour-chat">
                <div className="chat-q">When do I focus best?</div>
                <div className="chat-a">
                  <p>{data.answer.answer.replace(/\s*\[[a-z_]+\]/g, '')}</p>
                  <ol className="source-list">
                    {data.answer.citations.map((c) => (
                      <li key={c.id}>
                        <span>{c.label}</span>
                        <strong>{c.value}</strong>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
            {tab === 'developer' && (
              <div className="code">
                <div className="code-head">
                  <span>POST https://your-app.example/hooks/pulse</span>
                </div>
                <pre>{`X-Pulse-Event: session.completed
X-Pulse-Timestamp: 1791200400
X-Pulse-Signature: 5f2b9c…e41a

{
  "type": "session.completed",
  "id": "evt_s_mf3k2l_x81c",
  "data": {
    "focused_minutes": 25,
    "label": "Draft the API docs",
    "tag": "Deep work",
    "interruptions": 1,
    "finished": true
  }
}`}</pre>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <p className="tour-note">Real components rendering sample data. The same ones run in the app.</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  usePageTitle()
  const reduce = useReducedMotion()
  const fade = (delay) => ({ initial: reduce ? false : { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay } })

  return (
    <>
      <section className="hero container">
        <div className="glow glow-1" aria-hidden="true" />
        <div className="glow glow-2" aria-hidden="true" />
        <motion.span className="badge" {...fade(0)}>
          <span className="badge-dot" aria-hidden="true" />
          Public beta · every feature free
        </motion.span>
        <div className="hero-grid">
          <div>
            <motion.h1 {...fade(0.05)}>
              Deep focus,
              <br />
              <span className="gradient-text">measured.</span>
            </motion.h1>
            <motion.p className="hero-sub" {...fade(0.12)}>
              Pulse is a focus timer that learns how your attention moves through the day, then tells you what to change. In plain English, with the numbers to back it up.
            </motion.p>
            <motion.div className="hero-actions" {...fade(0.18)}>
              <Link className="btn btn-primary btn-lg" to="/app">
                Start focusing, free <Icon.Arrow />
              </Link>
              <Link className="btn btn-ghost btn-lg" to="/features">
                See how it works
              </Link>
            </motion.div>
            <motion.p className="hero-note" {...fade(0.24)}>
              <Icon.Check width={16} height={16} /> No sign up needed <Icon.Check width={16} height={16} /> Works offline <Icon.Check width={16} height={16} /> Export anytime
            </motion.p>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="facts" aria-label="Pulse in numbers">
        <div className="container facts-grid">
          {FACTS.map((f, i) => (
            <Reveal key={f.label} delay={i * 0.06}>
              <div className="fact-value">{f.value}</div>
              <div className="fact-label">{f.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Product tour" title="Everything you need to understand your focus" sub="Click through the parts of Pulse you will use most." />
          <Reveal>
            <ProductTour />
          </Reveal>
        </div>
      </section>

      <section className="section section-muted" id="how-it-works">
        <div className="container story">
          <SectionHead eyebrow="How it works" title="One loop, running quietly in the background" align="left" />
          <div className="story-lines">
            {STORY.map((item, i) => {
              const StoryIcon = item.icon
              return (
                <Reveal key={item.clause} delay={i * 0.1} className="story-line">
                  <span className="story-icon" aria-hidden="true">
                    <StoryIcon width={22} height={22} />
                  </span>
                  {item.clause}
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Features" title="Built for people who would rather do the work" sub="Every part of Pulse is in this one app. No add ons, no upsell inside the timer." />
          <div className="features-grid">
            {FEATURES.map((f, i) => {
              const FIcon = f.icon
              return (
                <Reveal key={f.title} delay={(i % 4) * 0.06} className="feature-card">
                  <span className="feature-icon">
                    <FIcon />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </Reveal>
              )
            })}
          </div>
          <div className="center mt-lg">
            <Link to="/features" className="btn btn-ghost">
              Every feature in detail <Icon.Arrow width={16} height={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container split">
          <Reveal>
            <span className="eyebrow">Privacy</span>
            <h2 className="split-title">Your attention data is personal. We treat it that way.</h2>
            <ul className="checklist">
              <li>
                <Icon.Check /> Use the whole app without an account; data stays in your browser
              </li>
              <li>
                <Icon.Check /> Passwords stored with salted scrypt; API tokens kept only as digests
              </li>
              <li>
                <Icon.Check /> Team figures hidden until three members, and never per person
              </li>
              <li>
                <Icon.Check /> Download everything as JSON, or delete your account in one step
              </li>
            </ul>
            <Link to="/privacy" className="btn btn-ghost mt">
              Read the privacy notice
            </Link>
          </Reveal>
          <Reveal delay={0.1} className="privacy-card">
            <div className="privacy-row">
              <Icon.Lock />
              <div>
                <strong>Session cookie</strong>
                <span>HttpOnly · SameSite=Lax · Secure</span>
              </div>
            </div>
            <div className="privacy-row">
              <Icon.Shield />
              <div>
                <strong>Every change</strong>
                <span>Checked against cross site forgery</span>
              </div>
            </div>
            <div className="privacy-row">
              <Icon.Key />
              <div>
                <strong>Webhook URLs</strong>
                <span>Private network addresses refused</span>
              </div>
            </div>
            <div className="privacy-row">
              <Icon.Database />
              <div>
                <strong>Your data</strong>
                <span>Exportable as CSV or JSON, any time</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <Reveal>
            <span className="eyebrow">For developers</span>
            <h2 className="split-title">Pipe your focus into anything</h2>
            <p className="muted">
              Send finished sessions to a spreadsheet, post a message to Slack when you hit your goal, or build your own dashboard. Webhooks are signed, retried and replayable; the REST API takes scoped tokens.
            </p>
            <div className="row mt">
              <Link to="/developers" className="btn btn-primary">
                API reference
              </Link>
              <Link to="/integrations" className="btn btn-ghost">
                Integrations
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="code">
              <div className="code-head">
                <span>Log a session from a script</span>
              </div>
              <pre>{`curl -X POST https://pulse.example/api/sessions \\
  -H "Authorization: Bearer $PULSE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "standup-2026-10-05",
    "start": 1791190800000,
    "end": 1791192300000,
    "minutes": 25, "planned": 25,
    "tag": "Writing", "completed": true
  }'`}</pre>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Reveal className="cta-banner">
            <h2>Your next focus block starts with one key</h2>
            <p>Open the app, press space, and see your first insight today. No account, no card.</p>
            <div className="hero-actions">
              <Link className="btn btn-accent btn-lg" to="/app">
                Open Pulse <Icon.Arrow />
              </Link>
              <a className="btn btn-ghost btn-lg" href={REPO_URL} target="_blank" rel="noreferrer">
                <Icon.Github /> View the source
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
