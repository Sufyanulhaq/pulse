import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../state/AuthContext.jsx'
import { Brand } from '../components/Brand.jsx'
import { Icon } from '../components/Icon.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { Field, Spinner, usePageTitle } from '../components/ui.jsx'

function Shell({ title, children }) {
  return (
    <div className="flow">
      <div className="auth-top">
        <Brand />
        <ThemeToggle />
      </div>
      <main id="main" className="auth-main" tabIndex={-1}>
        <div className="auth-card">
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}

export function VerifyPage() {
  usePageTitle('Confirm email')
  const [params] = useSearchParams()
  const { refresh, user } = useAuth()
  const [state, setState] = useState({ status: 'working', message: '' })
  const once = useRef(false)

  useEffect(() => {
    if (once.current) return
    once.current = true
    const token = params.get('token') || ''
    api
      .post('/auth/verify', { token })
      .then(() => {
        setState({ status: 'done', message: '' })
        refresh()
      })
      .catch((err) => setState({ status: 'error', message: err.message }))
  }, [params, refresh])

  return (
    <Shell title={state.status === 'done' ? 'Email confirmed' : state.status === 'error' ? 'That link did not work' : 'Confirming your email'}>
      {state.status === 'working' && <Spinner label="Confirming" />}
      {state.status === 'done' && (
        <>
          <p className="muted">Thanks. Your address is confirmed, so receipts, password resets and team invites will reach you.</p>
          <Link className="btn btn-primary mt" to="/app">
            Open Pulse <Icon.Arrow width={16} height={16} />
          </Link>
        </>
      )}
      {state.status === 'error' && (
        <>
          <p className="muted">{state.message}</p>
          <Link className="btn btn-primary mt" to={user ? '/app/settings' : '/login?next=/app/settings'}>
            {user ? 'Send a new link from Settings' : 'Log in to send a new link'}
          </Link>
        </>
      )}
    </Shell>
  )
}

export function ForgotPage() {
  usePageTitle('Forgot password')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Shell title="Reset your password">
      {sent ? (
        <div className="callout callout-good mt" role="status">
          <Icon.Mail width={18} height={18} />
          <div>{sent} Check your inbox and spam folder. The link works for one hour.</div>
        </div>
      ) : (
        <form
          className="form-grid auth-form"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
              setError('Enter a valid email address.')
              return
            }
            setBusy(true)
            try {
              const r = await api.post('/auth/forgot', { email })
              setSent(r.message)
            } catch (err) {
              setError(err.message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <p className="muted">Enter the email you signed up with and we will send a link to choose a new password.</p>
          <Field label="Email" error={error}>
            {(p) => <input {...p} className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy && <Spinner />} Send reset link
          </button>
        </form>
      )}
      <p className="auth-foot">
        <Link to="/login">Back to log in</Link>
      </p>
    </Shell>
  )
}

export function ResetPage() {
  usePageTitle('Choose a new password')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const token = params.get('token') || ''

  return (
    <Shell title="Choose a new password">
      {done ? (
        <>
          <p className="muted">Your password is changed and every device has been logged out.</p>
          <button className="btn btn-primary mt" type="button" onClick={() => navigate('/login')}>
            Log in
          </button>
        </>
      ) : (
        <form
          className="form-grid auth-form"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            if (password.length < 10) return setErrors({ password: 'Use at least 10 characters.' })
            if (password !== confirm) return setErrors({ confirm: 'The two passwords do not match.' })
            setBusy(true)
            setErrors({})
            try {
              await api.post('/auth/reset', { token, password })
              setDone(true)
            } catch (err) {
              setErrors(err.fields?.password ? err.fields : { _form: err.message })
            } finally {
              setBusy(false)
            }
          }}
        >
          {errors._form && (
            <div className="form-error" role="alert">
              <Icon.Alert width={16} height={16} />
              <span>
                {errors._form} <Link to="/forgot">Ask for a new link</Link>
              </span>
            </div>
          )}
          <Field label="New password" hint="At least 10 characters." error={errors.password}>
            {(p) => <input {...p} className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label="Type it again" error={errors.confirm}>
            {(p) => <input {...p} className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !token}>
            {busy && <Spinner />} Save new password
          </button>
          {!token && <p className="field-error">This page needs the link from your email.</p>}
        </form>
      )}
    </Shell>
  )
}
