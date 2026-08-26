import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import './App.css'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'GitHub', href: 'https://github.com' },
]

const STATS = [
  { value: '40%', label: 'less context switching' },
  { value: '12k+', label: 'focus sessions tracked' },
  { value: '4.9/5', label: 'average rating' },
  { value: '2 min', label: 'setup time' },
]

function Icon() {
  return null
}

Icon.Target = function IconTarget(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="presentation" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  )
}

Icon.Bell = function IconBell(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="presentation" aria-hidden="true" {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

Icon.Users = function IconUsers(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="presentation" aria-hidden="true" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

Icon.Shield = function IconShield(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="presentation" aria-hidden="true" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

Icon.Check = function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" role="presentation" aria-hidden="true" {...props}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}

Icon.Arrow = function IconArrow(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role="presentation" aria-hidden="true" {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

Icon.Github = function IconGithub(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" role="presentation" aria-hidden="true" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2.16c-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.3-.52-1.48.11-3.08 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.6.23 2.78.11 3.08.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.07.78 2.16v3.2c0 .3.21.66.79.55A10.52 10.52 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
    </svg>
  )
}

const FEATURES = [
  {
    title: 'Real-time focus tracking',
    description:
      'See deep work, context switches, and breaks as they happen, not in a report three days later.',
    icon: Icon.Target,
  },
  {
    title: 'Smart break reminders',
    description:
      'Nudges are timed to your actual rhythm, so you get pulled out of the zone only when it helps.',
    icon: Icon.Bell,
  },
  {
    title: 'Team insights',
    description:
      'Aggregate, anonymized trends for teams who want to protect focus time without watching individuals.',
    icon: Icon.Users,
  },
  {
    title: 'Local-first & private',
    description:
      'Raw activity data stays on your device by default. You choose what, if anything, gets synced.',
    icon: Icon.Shield,
  },
]

const STORY_ITEMS = [
  { icon: Icon.Target, clause: 'Focus, tracked.' },
  { icon: Icon.Bell, clause: 'Breaks, timed.' },
  { icon: Icon.Users, clause: 'Teams, protected.' },
  { icon: Icon.Shield, clause: 'Privacy, respected.' },
]

function ScrollStory() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="section" id="how-it-works">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>One loop, running quietly in the background</h2>
        </div>
        <div className="story-lines">
          {STORY_ITEMS.map((item, index) => {
            const StoryIcon = item.icon
            return (
              <motion.div
                className="story-line"
                key={item.clause}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20, filter: 'blur(6px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: index * 0.12, ease: 'easeOut' }}
              >
                <span className="story-icon" aria-hidden="true">
                  <StoryIcon width={22} height={22} />
                </span>
                {item.clause}
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Nav() {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">
            <Icon.Target width={16} height={16} />
          </span>
          Pulse
        </a>
        <ul className="nav-links">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
        <a className="btn btn-primary btn-sm nav-cta" href="#get-started">
          Get started
        </a>
      </div>
    </header>
  )
}

function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const inputId = useId()
  const errorId = useId()

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your email to join the waitlist.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('That email address doesn’t look right.')
      return
    }
    setError('')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <motion.div
        className="waitlist-success"
        role="status"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Icon.Check />
        You&rsquo;re on the list &mdash; we&rsquo;ll email you at {email}.
      </motion.div>
    )
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate id="get-started">
      <div className="waitlist-field">
        <label className="sr-only" htmlFor={inputId}>
          Email address
        </label>
        <input
          id={inputId}
          className="waitlist-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <span id={errorId} className="field-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <button className="btn btn-accent" type="submit">
        Join waitlist
        <Icon.Arrow />
      </button>
    </form>
  )
}

function Hero() {
  const shouldReduceMotion = useReducedMotion()
  const barHeights = [38, 62, 45, 80, 58, 95, 70]

  return (
    <section className="hero container" id="top">
      <div className="glow glow-1" aria-hidden="true" />
      <div className="glow glow-2" aria-hidden="true" />

      <motion.span
        className="badge"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="badge-dot" aria-hidden="true" />
        Now in public beta
      </motion.span>

      <div className="hero-grid">
        <div>
          <motion.h1
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            Deep focus,
            <br />
            measured.
          </motion.h1>
          <motion.p
            className="hero-sub"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
          >
            Pulse tracks how your attention actually moves through the day and
            turns it into nudges you&rsquo;ll act on, not another dashboard
            you&rsquo;ll ignore.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
          >
            <a className="btn btn-primary" href="#get-started-field">
              Get started free
              <Icon.Arrow />
            </a>
            <a className="btn btn-ghost" href="https://github.com" target="_blank" rel="noreferrer">
              <Icon.Github />
              View on GitHub
            </a>
          </motion.div>

          <motion.div
            className="waitlist"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
          >
            <span className="waitlist-label" id="get-started-field">
              Join the waitlist &mdash; no spam, just a launch date.
            </span>
            <WaitlistForm />
          </motion.div>
        </div>

        <motion.div
          className="hero-visual"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        >
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Focus score today</span>
              <span className="panel-score">86</span>
            </div>
            <div className="bars">
              {barHeights.map((height, index) => (
                <motion.span
                  key={index}
                  className="bar"
                  initial={shouldReduceMotion ? false : { height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.05, ease: 'easeOut' }}
                />
              ))}
            </div>
          </div>

          <motion.div
            className="floating-card floating-card-1"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <span className="floating-icon blue" aria-hidden="true">
              <Icon.Target width={16} height={16} />
            </span>
            2h 14m deep work
          </motion.div>

          <motion.div
            className="floating-card floating-card-2"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.85 }}
          >
            <span className="floating-icon orange" aria-hidden="true">
              <Icon.Bell width={16} height={16} />
            </span>
            Break in 12 min
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function Stats() {
  return (
    <section className="stats">
      <div className="container stats-grid">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Features() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="section" id="features">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Features</span>
          <h2>Everything to protect your attention</h2>
          <p className="section-sub">
            Built for people who&rsquo;d rather ship the work than manage the
            tool that&rsquo;s supposed to help them ship it.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((feature, index) => {
            const FeatureIcon = feature.icon
            return (
              <motion.div
                className="feature-card"
                key={feature.title}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
              >
                <span className="feature-icon">
                  <FeatureIcon />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function CTABanner() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="cta-banner">
          <h2>Start protecting your focus today</h2>
          <p>
            Install the desktop app, connect your calendar, and see your
            first focus report in under two minutes.
          </p>
          <div className="hero-actions">
            <a className="btn btn-accent" href="#get-started-field">
              Get started free
              <Icon.Arrow />
            </a>
            <a className="btn btn-ghost" href="https://github.com" target="_blank" rel="noreferrer">
              <Icon.Github />
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">
            <Icon.Target width={16} height={16} />
          </span>
          Pulse
        </a>
        <ul className="footer-links">
          <li>
            <a href="#features">Features</a>
          </li>
          <li>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </li>
          <li>
            <a href="mailto:hello@pulse.app">Contact</a>
          </li>
        </ul>
        <span className="footer-copy">&copy; {new Date().getFullYear()} Pulse. All rights reserved.</span>
      </div>
    </footer>
  )
}

function App() {
  return (
    <div className="page">
      <Nav />
      <Hero />
      <ScrollStory />
      <Stats />
      <Features />
      <CTABanner />
      <Footer />
    </div>
  )
}

export default App
