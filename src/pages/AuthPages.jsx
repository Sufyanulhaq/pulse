import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../state/AuthContext.jsx'
import { DEMO, REPO_URL } from '../env.js'
import { Brand } from '../components/Brand.jsx'
import { Icon } from '../components/Icon.jsx'
import { Field, Spinner, usePageTitle } from '../components/ui.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'

function AuthShell({ title, sub, children, footer }) {
  return (
    <div className="auth">
      <div className="auth-top">
        <Brand />
        <ThemeToggle />
      </div>
      <main id="main" className="auth-main" tabIndex={-1}>
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="muted">{sub}</p>
          {children}
        </div>
        <p className="auth-foot">{footer}</p>
      </main>
      <aside className="auth-side" aria-hidden="true">
        <div className="auth-side-inner">
          <span className="eyebrow">Why an account</span>
          <ul>
            <li>
              <Icon.Refresh /> Sync sessions across every device
            </li>
            <li>
              <Icon.Users /> Join a team with privacy built in
            </li>
            <li>
              <Icon.Plug /> Signed webhooks and a personal API
            </li>
            <li>
              <Icon.Message /> Ask the assistant about your focus
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

function DemoNotice() {
  return (
    <div className="stack mt">
      <div className="callout">
        <Icon.Info width={18} height={18} />
        <div>This is the free demo, which runs without a server, so there are no accounts here. The timer, insights, history and assistant all work without one, saved in your browser.</div>
      </div>
      <Link className="btn btn-primary btn-block" to="/app">
        Open the app
      </Link>
      <a className="btn btn-ghost btn-block" href={REPO_URL} target="_blank" rel="noreferrer">
        <Icon.Github width={16} height={16} /> Run the full version yourself
      </a>
    </div>
  )
}

function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-input">
      <input {...props} className="input" type={show ? 'text' : 'password'} />
      <button type="button" className="link-btn small" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

export function LoginPage() {
  usePageTitle('Log in')
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const next = new URLSearchParams(location.search).get('next') || '/app'
  if (user) return <Navigate to={next.startsWith('/') ? next : '/app'} replace />
  if (DEMO) {
    return (
      <AuthShell title="Accounts are in the full version" sub="Logging in syncs sessions, and unlocks teams, webhooks, the API and billing." footer={<Link to="/">Back to the site</Link>}>
        <DemoNotice />
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Welcome back" sub="Log in to sync your focus sessions." footer={<>New to Pulse? <Link to="/signup">Create a free account</Link></>}>
      <form
        className="form-grid auth-form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErrors({})
          try {
            await login(email, password)
            navigate(next.startsWith('/') ? next : '/app', { replace: true })
          } catch (err) {
            setErrors(Object.keys(err.fields).length ? err.fields : { _form: err.message })
          } finally {
            setBusy(false)
          }
        }}
      >
        {errors._form && (
          <div className="form-error" role="alert">
            <Icon.Alert width={16} height={16} /> {errors._form}
          </div>
        )}
        <Field label="Email" error={errors.email}>
          {(p) => <input {...p} className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="Password" error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        <Link to="/forgot" className="small forgot-link">
          Forgot your password?
        </Link>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy && <Spinner />} Log in
        </button>
        <p className="small muted">
          Prefer not to sign up? <Link to="/app">Use Pulse without an account</Link>. Sessions stay in this browser.
        </p>
      </form>
    </AuthShell>
  )
}

function strength(pw) {
  let score = 0
  if (pw.length >= 10) score++
  if (pw.length >= 14) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(4, score)
}

export function SignupPage() {
  usePageTitle('Create account')
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/app" replace />
  if (DEMO) {
    return (
      <AuthShell title="Accounts are in the full version" sub="With an account, sessions sync across devices, and teams, webhooks, the API and billing switch on." footer={<Link to="/">Back to the site</Link>}>
        <DemoNotice />
      </AuthShell>
    )
  }
  const s = strength(form.password)

  return (
    <AuthShell title="Create your account" sub="Free, and no card needed." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
      <form
        className="form-grid auth-form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          const local = {}
          if (!form.name.trim()) local.name = 'Enter your name.'
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) local.email = 'Enter a valid email address.'
          if (form.password.length < 10) local.password = 'Use at least 10 characters.'
          if (Object.keys(local).length) {
            setErrors(local)
            return
          }
          setBusy(true)
          setErrors({})
          try {
            await signup(form.name, form.email, form.password)
            navigate('/app', { replace: true })
          } catch (err) {
            setErrors(Object.keys(err.fields).length ? err.fields : { _form: err.message })
          } finally {
            setBusy(false)
          }
        }}
      >
        {errors._form && (
          <div className="form-error" role="alert">
            <Icon.Alert width={16} height={16} /> {errors._form}
          </div>
        )}
        <Field label="Name" error={errors.name}>
          {(p) => <input {...p} className="input" autoComplete="name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label="Email" error={errors.email}>
          {(p) => <input {...p} className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        </Field>
        <Field label="Password" hint="At least 10 characters. A short phrase works well." error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        </Field>
        {form.password && (
          <div className="strength" aria-live="polite">
            <div className="strength-bars" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={i < s ? `on s${s}` : ''} />
              ))}
            </div>
            <span className="small muted">{['Too short', 'Weak', 'Fair', 'Good', 'Strong'][s]}</span>
          </div>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy && <Spinner />} Create account
        </button>
        <p className="small muted">
          By creating an account you agree to the <Link to="/terms">terms</Link> and <Link to="/privacy">privacy notice</Link>.
        </p>
      </form>
    </AuthShell>
  )
}
