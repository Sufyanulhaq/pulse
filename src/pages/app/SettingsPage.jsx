import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../api.js'
import { useAuth } from '../../state/AuthContext.jsx'
import { useData } from '../../state/DataContext.jsx'
import { useTheme } from '../../state/ThemeContext.jsx'
import { useToast } from '../../state/ToastContext.jsx'
import { LIMITS } from '../../lib/settings.js'
import { dateTime, duration } from '../../lib/format.js'
import { chime } from '../../lib/sound.js'
import { Icon } from '../../components/Icon.jsx'
import { Badge, ConfirmDialog, Field, Modal, Segmented, Toggle, usePageTitle } from '../../components/ui.jsx'
import { ExportMenu } from './ExportMenu.jsx'

function NumberSetting({ label, hint, value, field, onSave, unit = 'min' }) {
  const [draft, setDraft] = useState(String(value))
  const [min, max] = LIMITS[field]
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const n = Math.round(Number(draft))
    if (!Number.isFinite(n) || n < min || n > max) {
      setDraft(String(value))
      return
    }
    if (n !== value) onSave({ [field]: n })
  }
  return (
    <Field label={label} hint={`${hint} ${min} to ${max}.`}>
      {(p) => (
        <div className="unit-input">
          <input
            {...p}
            className="input"
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
          <span>{unit}</span>
        </div>
      )}
    </Field>
  )
}

function TagEditor() {
  const { settings, updateSettings } = useData()
  const { toast } = useToast()
  const [draft, setDraft] = useState('')
  const save = (tags) => updateSettings({ tags }).catch((err) => toast(err.message, { tone: 'error' }))
  return (
    <div>
      <ul className="tag-list">
        {settings.tags.map((t) => (
          <li key={t} className="tag-item">
            {t}
            <button type="button" aria-label={`Remove tag ${t}`} disabled={settings.tags.length <= 1} onClick={() => save(settings.tags.filter((x) => x !== t))}>
              <Icon.X width={12} height={12} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline-form mt-sm"
        onSubmit={(e) => {
          e.preventDefault()
          const tag = draft.trim()
          if (!tag) return
          if (settings.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
            toast('That tag already exists.')
            return
          }
          if (settings.tags.length >= 20) {
            toast('You can have up to 20 tags.')
            return
          }
          save([...settings.tags, tag])
          setDraft('')
        }}
      >
        <Field label="Add a tag">{(p) => <input {...p} className="input" value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} placeholder="For example: Client work" />}</Field>
        <button className="btn btn-ghost" type="submit">
          <Icon.Plus width={15} height={15} /> Add
        </button>
      </form>
    </div>
  )
}

function Account() {
  const { user, setUser, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [logins, setLogins] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const loadLogins = () => api.get('/account/logins').then((r) => setLogins(r.logins)).catch(() => {})
  useEffect(() => {
    loadLogins()
  }, [])

  return (
    <>
      <section className="card settings-section">
        <h2>Account</h2>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              const r = await api.patch('/account', { name })
              setUser(r.user)
              toast('Name saved.', { tone: 'success' })
            } catch (err) {
              toast(err.message, { tone: 'error' })
            }
          }}
        >
          <Field label="Name">{(p) => <input {...p} className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Email" hint={user.emailVerified ? 'Confirmed' : 'Not confirmed yet. Check your inbox for the link.'}>
            {(p) => <input {...p} className="input" value={user.email} disabled />}
          </Field>
          <button className="btn btn-ghost" type="submit" disabled={name.trim() === user.name || !name.trim()}>
            Save
          </button>
        </form>

        <h3 className="settings-sub">Change password</h3>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault()
            setPwErrors({})
            try {
              await api.post('/account/password', pw)
              setPw({ current: '', next: '' })
              toast('Password changed. Other devices have been logged out.', { tone: 'success' })
              loadLogins()
            } catch (err) {
              setPwErrors(Object.keys(err.fields).length ? err.fields : { current: err.message })
            }
          }}
        >
          <Field label="Current password" error={pwErrors.current}>
            {(p) => <input {...p} className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}
          </Field>
          <Field label="New password" hint="At least 10 characters." error={pwErrors.next}>
            {(p) => <input {...p} className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />}
          </Field>
          <button className="btn btn-ghost" type="submit" disabled={!pw.current || !pw.next}>
            Change
          </button>
        </form>

        <h3 className="settings-sub">Where you are logged in</h3>
        <ul className="login-list">
          {logins.map((l) => (
            <li key={l.id}>
              <Icon.Monitor width={16} height={16} />
              <div>
                <strong className="small">{l.user_agent ? l.user_agent.replace(/\(.*?\)/g, '').slice(0, 60) : 'Unknown device'}</strong>
                <span className="small muted">Since {dateTime(l.created_at)}</span>
              </div>
              {l.current ? (
                <Badge tone="good">This device</Badge>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={async () => {
                    await api.del(`/account/logins/${l.id}`)
                    loadLogins()
                  }}
                >
                  Log out
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card settings-section danger-zone">
        <h2>Your data</h2>
        <p className="muted small">Download everything Pulse holds about you, or delete your account and all of it.</p>
        <div className="row mt-sm">
          <a className="btn btn-ghost btn-sm" href="/api/account/export" download>
            <Icon.Download width={15} height={15} /> Download all my data
          </a>
          <button className="btn btn-danger-ghost btn-sm" type="button" onClick={() => setDeleting(true)}>
            <Icon.Trash width={15} height={15} /> Delete account
          </button>
        </div>
      </section>

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete your account?"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setDeleting(false)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={!deletePw}
              onClick={async () => {
                try {
                  await api.del('/account', { password: deletePw })
                  await logout()
                  toast('Your account and all its data have been deleted.')
                  navigate('/')
                } catch (err) {
                  setDeleteError(err.message)
                }
              }}
            >
              Delete everything
            </button>
          </>
        }
      >
        <p>Your sessions, settings, webhooks, API tokens and any teams you own are deleted for good.</p>
        <div className="mt-sm">
          <Field label="Type your password to confirm" error={deleteError}>
            {(p) => <input {...p} className="input" type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} autoComplete="current-password" />}
          </Field>
        </div>
      </Modal>
    </>
  )
}

export default function SettingsPage() {
  usePageTitle('Settings')
  const { user } = useAuth()
  const { settings, updateSettings, sessions, loadSample, removeSample, hasSample, clearSessions, mode } = useData()
  const { choice, setTheme } = useTheme()
  const { toast } = useToast()
  const [clearing, setClearing] = useState(false)
  const [notifyState, setNotifyState] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))

  const save = (patch) =>
    updateSettings(patch)
      .then(() => toast('Saved.', { tone: 'success', duration: 1500 }))
      .catch((err) => toast(err.message, { tone: 'error' }))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>{mode === 'cloud' ? 'Saved to your account and used on every device.' : 'Saved in this browser.'}</p>
        </div>
      </div>

      <nav className="quick-links" aria-label="More sections">
        {user && (
          <>
            <Link to="/app/teams" className="btn btn-ghost btn-sm">
              <Icon.Users width={15} height={15} /> Teams
            </Link>
            <Link to="/app/developer" className="btn btn-ghost btn-sm">
              <Icon.Plug width={15} height={15} /> Developer
            </Link>
          </>
        )}
        {user?.isAdmin && (
          <Link to="/app/admin" className="btn btn-ghost btn-sm">
            <Icon.Dashboard width={15} height={15} /> Admin
          </Link>
        )}
        {user && (
          <Link to="/app/billing" className="btn btn-ghost btn-sm">
            <Icon.Briefcase width={15} height={15} /> Billing
          </Link>
        )}
        <Link to="/" className="btn btn-ghost btn-sm">
          <Icon.ArrowLeft width={15} height={15} /> Back to site
        </Link>
      </nav>

      <div className="settings-grid">
        <section className="card settings-section">
          <h2>Timer</h2>
          <div className="form-grid form-grid-2">
            <NumberSetting label="Focus block" hint="How long each block lasts." field="focusMinutes" value={settings.focusMinutes} onSave={save} />
            <NumberSetting label="Daily goal" hint={`Currently ${duration(settings.goalMinutes)}.`} field="goalMinutes" value={settings.goalMinutes} onSave={save} />
            <NumberSetting label="Short break" hint="Between blocks." field="shortBreakMinutes" value={settings.shortBreakMinutes} onSave={save} />
            <NumberSetting label="Long break" hint="After a full round." field="longBreakMinutes" value={settings.longBreakMinutes} onSave={save} />
            <NumberSetting label="Blocks per round" hint="Focus blocks before a long break." field="longBreakEvery" value={settings.longBreakEvery} onSave={save} unit="blocks" />
          </div>
          <div className="divider" />
          <Toggle label="Start breaks automatically" description="Go straight into a break when a focus block ends." checked={settings.autoStartBreaks} onChange={(v) => save({ autoStartBreaks: v })} />
          <Toggle label="Start focus automatically" description="Go straight into the next block when a break ends." checked={settings.autoStartFocus} onChange={(v) => save({ autoStartFocus: v })} />
        </section>

        <section className="card settings-section">
          <h2>Tags</h2>
          <p className="muted small">Tag each block so Insights can show where your time goes.</p>
          <div className="mt-sm">
            <TagEditor />
          </div>
        </section>

        <section className="card settings-section">
          <h2>Sound, alerts and look</h2>
          <Toggle
            label="Chime"
            description="A soft chime when a block or break ends."
            checked={settings.sound}
            onChange={(v) => {
              save({ sound: v })
              if (v) chime()
            }}
          />
          <Toggle
            label="Desktop notifications"
            description={
              notifyState === 'denied'
                ? 'Blocked by your browser. Allow notifications for this site in the browser settings.'
                : notifyState === 'unsupported'
                  ? 'This browser does not support notifications.'
                  : 'A notification when a block or break ends, even in another tab.'
            }
            checked={settings.notifications && notifyState === 'granted'}
            disabled={notifyState === 'denied' || notifyState === 'unsupported'}
            onChange={async (v) => {
              if (v && Notification.permission !== 'granted') {
                const result = await Notification.requestPermission()
                setNotifyState(result)
                if (result !== 'granted') return
              }
              save({ notifications: v })
            }}
          />
          <div className="toggle-row">
            <div>
              <span className="toggle-label">Theme</span>
              <p className="toggle-desc">Saved on this device.</p>
            </div>
            <Segmented
              label="Theme"
              size="sm"
              value={choice}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>
        </section>

        <section className="card settings-section">
          <h2>Sessions</h2>
          <p className="muted small">
            {sessions.length} session{sessions.length === 1 ? '' : 's'} recorded{hasSample ? ', including sample data' : ''}.
          </p>
          <div className="stack mt-sm" style={{ gap: 10 }}>
            <ExportMenu showImport />
            <div className="row">
              {hasSample ? (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={async () => {
                    await removeSample()
                    toast('Sample data removed.', { tone: 'success' })
                  }}
                >
                  Remove sample data
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={async () => {
                    const r = await loadSample()
                    toast(`Loaded ${r.imported} sample sessions.`, { tone: 'success' })
                  }}
                >
                  <Icon.Sparkle width={15} height={15} /> Load sample data
                </button>
              )}
              <button className="btn btn-danger-ghost btn-sm" type="button" disabled={!sessions.length} onClick={() => setClearing(true)}>
                <Icon.Trash width={15} height={15} /> Delete all sessions
              </button>
            </div>
          </div>
        </section>

        {user ? (
          <Account />
        ) : (
          <section className="card settings-section">
            <h2>Account</h2>
            <p className="muted small">You are using Pulse without an account. Sessions stay in this browser. With a free account they sync across devices, and you can join teams, use webhooks and the API, and ask the assistant with Claude.</p>
            <div className="row mt-sm">
              <Link className="btn btn-primary btn-sm" to="/signup">
                Create free account
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/login">
                Log in
              </Link>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={clearing}
        onClose={() => setClearing(false)}
        title="Delete every session?"
        danger
        confirmLabel={`Delete ${sessions.length} sessions`}
        onConfirm={async () => {
          await clearSessions()
          toast('All sessions deleted.')
        }}
      >
        <p>This removes your whole history{mode === 'cloud' ? ' from your account' : ' from this browser'}. Download a backup first if you might want it back.</p>
      </ConfirmDialog>
    </>
  )
}
