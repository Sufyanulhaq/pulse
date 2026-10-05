import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Brand } from './Brand.jsx'
import { Icon } from './Icon.jsx'
import { ThemeToggle } from './ThemeToggle.jsx'
import { TimerPill } from './TimerPill.jsx'
import { useAuth } from '../state/AuthContext.jsx'

export const SITE_LINKS = [
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Developers', to: '/developers' },
  { label: 'Integrations', to: '/integrations' },
  { label: 'About', to: '/about' },
]

export { REPO_URL } from '../env.js'
import { REPO_URL } from '../env.js'

function openPalette() {
  window.dispatchEvent(new Event('pulse:command'))
}

export function SiteNav() {
  const { user } = useAuth()
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMenu(false), [pathname])
  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menu])

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Brand />
        <nav aria-label="Main">
          <ul className="nav-links">
            {SITE_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to}>{link.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-actions">
          <TimerPill />
          <button className="nav-search" type="button" onClick={openPalette} aria-label="Open command menu">
            <Icon.Search width={15} height={15} />
            <span>Search</span>
            <kbd className="kbd">Ctrl K</kbd>
          </button>
          <ThemeToggle />
          {user ? (
            <Link className="btn btn-primary btn-sm nav-cta" to="/app">
              Open app
            </Link>
          ) : (
            <>
              <Link className="nav-login" to="/login">
                Log in
              </Link>
              <Link className="btn btn-primary btn-sm nav-cta" to="/app">
                Start free
              </Link>
            </>
          )}
          <button className="icon-btn nav-menu-btn" type="button" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            {menu ? <Icon.X /> : <Icon.Menu />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.nav
            className="mobile-menu"
            aria-label="Mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <ul>
              {SITE_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to}>{link.label}</NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/changelog">Changelog</NavLink>
              </li>
              <li>
                <NavLink to="/contact">Contact</NavLink>
              </li>
            </ul>
            <div className="mobile-menu-actions">
              {user ? (
                <Link className="btn btn-primary btn-block" to="/app">
                  Open app
                </Link>
              ) : (
                <>
                  <Link className="btn btn-primary btn-block" to="/app">
                    Start free
                  </Link>
                  <Link className="btn btn-ghost btn-block" to="/login">
                    Log in
                  </Link>
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

const FOOTER = [
  {
    title: 'Product',
    links: [
      { label: 'Open the app', to: '/app' },
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Changelog', to: '/changelog' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'API reference', to: '/developers' },
      { label: 'Webhooks', to: '/developers?tab=webhooks' },
      { label: 'Integrations', to: '/integrations' },
      { label: 'Source on GitHub', href: REPO_URL },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About the maker', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>A focus timer and analytics app that keeps your data yours. Built and maintained by Sufyan Ul Haq in Liverpool, UK.</p>
          <a className="btn btn-ghost btn-sm" href={REPO_URL} target="_blank" rel="noreferrer">
            <Icon.Github width={16} height={16} /> Star on GitHub
          </a>
        </div>
        {FOOTER.map((col) => (
          <div key={col.title} className="footer-col">
            <h2>{col.title}</h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ) : (
                    <Link to={l.to}>{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Pulse. MIT licensed.</span>
        <span>
          Press <kbd className="kbd">Ctrl K</kbd> anywhere to jump around.
        </span>
      </div>
    </footer>
  )
}

export function SiteLayout() {
  return (
    <>
      <SiteNav />
      <main id="main" className="site-main" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}
