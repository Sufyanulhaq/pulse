import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Brand } from './Brand.jsx'
import { Icon } from './Icon.jsx'
import { ThemeToggle } from './ThemeToggle.jsx'
import { Badge, Spinner } from './ui.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { useData } from '../state/DataContext.jsx'
import { useToast } from '../state/ToastContext.jsx'
import { api } from '../api.js'

const APP_LINKS = [
  { to: '/app', label: 'Timer', icon: Icon.Clock, end: true },
  { to: '/app/insights', label: 'Insights', icon: Icon.Chart },
  { to: '/app/history', label: 'History', icon: Icon.List },
  { to: '/app/assistant', label: 'Assistant', icon: Icon.Message },
  { to: '/app/teams', label: 'Teams', icon: Icon.Users, account: true },
  { to: '/app/developer', label: 'Developer', icon: Icon.Plug, account: true },
  { to: '/app/billing', label: 'Billing', icon: Icon.Briefcase, account: true },
  { to: '/app/settings', label: 'Settings', icon: Icon.Settings },
]

function SyncBanner() {
  const { user, status } = useAuth()
  const [resent, setResent] = useState(false)
  const { localCount, uploadLocal, discardLocal, outboxCount, error, reload } = useData()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  if (error) {
    return (
      <div className="app-banner app-banner-warn" role="status">
        <Icon.Alert width={16} height={16} />
        <span>Could not load your data: {error}</span>
        <button className="link-btn" type="button" onClick={reload}>
          Try again
        </button>
      </div>
    )
  }
  if (!user && status === 'offline') {
    return (
      <div className="app-banner" role="status">
        <Icon.Info width={16} height={16} />
        <span>The server cannot be reached, so Pulse is running on this device only. Everything still works and is saved in this browser.</span>
      </div>
    )
  }
  if (!user) {
    return (
      <div className="app-banner" role="status">
        <Icon.Lock width={16} height={16} />
        <span>Your sessions are saved in this browser only. Create a free account to sync them, join a team and use webhooks.</span>
        <Link className="link-btn" to="/signup">
          Create account
        </Link>
      </div>
    )
  }
  if (localCount > 0) {
    return (
      <div className="app-banner" role="status">
        <Icon.Upload width={16} height={16} />
        <span>
          You have {localCount} session{localCount === 1 ? '' : 's'} saved in this browser from before you logged in.
        </span>
        <button
          className="link-btn"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await uploadLocal()
              toast(`Added ${r.imported} session${r.imported === 1 ? '' : 's'} to your account.`, { tone: 'success' })
            } catch (err) {
              toast(err.message, { tone: 'error' })
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Uploading…' : 'Add them to my account'}
        </button>
        <button className="link-btn muted" type="button" onClick={discardLocal}>
          Discard
        </button>
      </div>
    )
  }
  if (user && !user.emailVerified) {
    return (
      <div className="app-banner" role="status">
        <Icon.Mail width={16} height={16} />
        <span>
          {resent ? `A new link is on its way to ${user.email}.` : `Confirm your email: we sent a link to ${user.email}.`}
        </span>
        {!resent && (
          <button
            className="link-btn"
            type="button"
            onClick={async () => {
              try {
                await api.post('/account/verify/resend')
                setResent(true)
              } catch (err) {
                toast(err.message, { tone: 'error' })
              }
            }}
          >
            Send it again
          </button>
        )}
      </div>
    )
  }
  if (outboxCount > 0) {
    return (
      <div className="app-banner app-banner-warn" role="status">
        <Icon.Refresh width={16} height={16} />
        <span>
          {outboxCount} session{outboxCount === 1 ? ' is' : 's are'} waiting to sync. They will be sent when the connection is back.
        </span>
      </div>
    )
  }
  return null
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const { mode, loading } = useData()
  const navigate = useNavigate()
  const links = APP_LINKS.filter((l) => !l.account || user)

  return (
    <div className="app-shell">
      <aside className="app-side">
        <div className="app-side-top">
          <Brand to="/" />
        </div>
        <nav aria-label="App" className="app-nav">
          {links.map((l) => {
            const LinkIcon = l.icon
            return (
              <NavLink key={l.to} to={l.to} end={l.end}>
                <LinkIcon width={18} height={18} />
                <span>{l.label}</span>
              </NavLink>
            )
          })}
          {user?.isAdmin && (
            <NavLink to="/app/admin">
              <Icon.Dashboard width={18} height={18} />
              <span>Admin</span>
            </NavLink>
          )}
        </nav>
        <div className="app-side-foot">
          {user ? (
            <div className="app-user">
              <span className="avatar" aria-hidden="true">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="app-user-text">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <button
                className="icon-btn"
                type="button"
                aria-label="Log out"
                title="Log out"
                onClick={async () => {
                  await logout()
                  navigate('/')
                }}
              >
                <Icon.Logout width={16} height={16} />
              </button>
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              <Link className="btn btn-primary btn-sm btn-block" to="/signup">
                Create free account
              </Link>
              <Link className="btn btn-ghost btn-sm btn-block" to="/login">
                Log in
              </Link>
            </div>
          )}
        </div>
      </aside>
      <div className="app-main">
        <header className="app-top">
          <div className="app-top-brand">
            <Brand to="/" />
          </div>
          <div className="row">
            {loading ? <Spinner label="Syncing" /> : null}
            <Badge tone={mode === 'cloud' ? 'good' : 'neutral'}>{mode === 'cloud' ? 'Synced to your account' : 'Saved on this device'}</Badge>
          </div>
          <div className="spacer" />
          <button className="nav-search" type="button" onClick={() => window.dispatchEvent(new Event('pulse:command'))} aria-label="Open command menu">
            <Icon.Search width={15} height={15} />
            <span>Search</span>
            <kbd className="kbd">Ctrl K</kbd>
          </button>
          <ThemeToggle />
        </header>
        <SyncBanner />
        <main id="main" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <nav className="app-tabbar" aria-label="App sections">
        {links.filter((l) => l.to !== '/app/settings').slice(0, 4).map((l) => {
          const LinkIcon = l.icon
          return (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <LinkIcon width={20} height={20} />
              {l.label}
            </NavLink>
          )
        })}
        <NavLink to="/app/settings">
          <Icon.Settings width={20} height={20} />
          More
        </NavLink>
      </nav>
    </div>
  )
}
