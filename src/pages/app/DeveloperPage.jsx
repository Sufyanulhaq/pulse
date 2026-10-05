import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api.js'
import { useToast } from '../../state/ToastContext.jsx'
import { dateTime } from '../../lib/format.js'
import { Icon } from '../../components/Icon.jsx'
import { Badge, ConfirmDialog, CopyButton, EmptyState, Field, Modal, Spinner, Toggle, usePageTitle } from '../../components/ui.jsx'

const EVENTS = [
  { id: 'session.completed', label: 'session.completed', hint: 'A focus block was saved' },
  { id: 'session.deleted', label: 'session.deleted', hint: 'A session was deleted' },
  { id: 'goal.reached', label: 'goal.reached', hint: 'The daily goal was crossed, once a day' },
]

const STATUS_TONE = { succeeded: 'good', failed: 'danger', pending: 'warn', delivering: 'primary' }

function SecretOnce({ title, value, onClose, children }) {
  return (
    <Modal open={Boolean(value)} onClose={onClose} title={title} footer={<button className="btn btn-primary" type="button" onClick={onClose}>I have saved it</button>}>
      <div className="callout callout-warn">
        <Icon.Alert width={18} height={18} />
        <div>This is the only time it is shown. Store it somewhere safe, like a password manager or your server’s environment variables.</div>
      </div>
      <div className="secret-box mono">{value}</div>
      <CopyButton text={value || ''} />
      {children}
    </Modal>
  )
}

function NewWebhook({ open, onClose, onCreated }) {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [events, setEvents] = useState(['session.completed'])
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a webhook"
      footer={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setErrors({})
              try {
                const r = await api.post('/webhooks', { url, description, events })
                onCreated(r)
                setUrl('')
                setDescription('')
              } catch (err) {
                setErrors({ ...err.fields, _form: Object.keys(err.fields).length ? '' : err.message })
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Spinner />} Add webhook
          </button>
        </>
      }
    >
      <div className="form-grid">
        {errors._form && (
          <div className="form-error">
            <Icon.Alert width={16} height={16} /> {errors._form}
          </div>
        )}
        <Field label="Endpoint URL" hint="Must be https and reachable from the internet. Private network addresses are refused." error={errors.url}>
          {(p) => <input {...p} className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/pulse-webhook" />}
        </Field>
        <Field label="Description" hint="Optional. Helps you tell endpoints apart." error={errors.description}>
          {(p) => <input {...p} className="input" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} placeholder="Google Sheet via n8n" />}
        </Field>
        <fieldset className="fieldset">
          <legend className="field-label">Events</legend>
          {EVENTS.map((ev) => (
            <label key={ev.id} className="checkbox">
              <input
                type="checkbox"
                checked={events.includes(ev.id)}
                onChange={(e) => setEvents((list) => (e.target.checked ? [...list, ev.id] : list.filter((x) => x !== ev.id)))}
              />
              <span>
                <code className="inline-code">{ev.label}</code> <span className="muted">{ev.hint}</span>
              </span>
            </label>
          ))}
          {errors.events && <span className="field-error">{errors.events}</span>}
        </fieldset>
      </div>
    </Modal>
  )
}

function Deliveries({ endpointId, refreshKey }) {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const { toast } = useToast()
  const load = useCallback(() => api.get(`/webhooks/${endpointId}/deliveries?limit=20`).then((r) => setRows(r.deliveries)), [endpointId])
  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load, refreshKey])

  if (!rows) return <Spinner />
  if (!rows.length) return <p className="small muted">No deliveries yet. Send a test event, or finish a focus block.</p>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Status</th>
            <th className="num">Tries</th>
            <th>Last response</th>
            <th>When</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>
                <code className="inline-code">{d.eventType}</code>
              </td>
              <td>
                <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
              </td>
              <td className="num">{d.attempts}</td>
              <td className="wrap small">
                {d.lastStatus ? `HTTP ${d.lastStatus}` : ''}
                {d.lastError ? <span className="muted"> {d.lastError}</span> : d.lastStatus ? '' : <span className="muted">Not sent yet</span>}
                {d.status === 'pending' && d.nextAttemptAt && d.attempts > 0 ? <span className="muted"> Next try {dateTime(d.nextAttemptAt)}</span> : null}
              </td>
              <td className="small">{dateTime(d.createdAt)}</td>
              <td className="num">
                <div className="row-actions">
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(d)}>
                    Payload
                  </button>
                  {d.status === 'failed' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={async () => {
                        try {
                          const r = await api.post(`/deliveries/${d.id}/replay`)
                          toast(r.delivery.status === 'succeeded' ? 'Replayed and delivered.' : `Replayed: ${r.delivery.status}.`, { tone: r.delivery.status === 'succeeded' ? 'success' : 'info' })
                          load()
                        } catch (err) {
                          toast(err.message, { tone: 'error' })
                        }
                      }}
                    >
                      <Icon.Refresh width={14} height={14} /> Replay
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Delivery payload" size="lg">
        {open && (
          <div className="code">
            <div className="code-head">
              <span>{open.eventType}</span>
              <CopyButton text={JSON.stringify(open.payload, null, 2)} />
            </div>
            <pre>{JSON.stringify(open.payload, null, 2)}</pre>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Webhooks() {
  const [hooks, setHooks] = useState(null)
  const [adding, setAdding] = useState(false)
  const [secret, setSecret] = useState('')
  const [removing, setRemoving] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const { toast } = useToast()
  const load = useCallback(() => api.get('/webhooks').then((r) => setHooks(r.webhooks)), [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <section aria-labelledby="hooks-title">
      <div className="section-row">
        <div>
          <h2 id="hooks-title">Webhooks</h2>
          <p className="muted small">Pulse sends a signed POST to your URL when something happens. Failed deliveries retry with a growing delay, and you can replay them here.</p>
        </div>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => setAdding(true)}>
          <Icon.Plus width={15} height={15} /> Add webhook
        </button>
      </div>
      {hooks === null ? (
        <Spinner />
      ) : hooks.length === 0 ? (
        <div className="card">
          <EmptyState icon={Icon.Plug} title="No webhooks yet" action={<Link className="btn btn-ghost" to="/developers?tab=webhooks">Read the webhook guide</Link>}>
            Connect Pulse to Slack, a spreadsheet, n8n or your own service.
          </EmptyState>
        </div>
      ) : (
        <div className="stack">
          {hooks.map((h) => (
            <article key={h.id} className="card">
              <div className="hook-head">
                <div className="hook-url">
                  <strong className="mono">{h.url}</strong>
                  <span className="small muted">
                    {h.description || 'No description'} · secret {h.secretPreview} · {h.events.join(', ')}
                  </span>
                </div>
                <Toggle
                  label={h.active ? 'Active' : 'Paused'}
                  checked={h.active}
                  onChange={async (active) => {
                    await api.patch(`/webhooks/${h.id}`, { active })
                    load()
                  }}
                />
              </div>
              <div className="row hook-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={async () => {
                    try {
                      const r = await api.post(`/webhooks/${h.id}/test`)
                      const d = r.delivery
                      toast(d.status === 'succeeded' ? `Test delivered (HTTP ${d.lastStatus}).` : `Test ${d.status}: ${d.lastError || ''}`, { tone: d.status === 'succeeded' ? 'success' : 'error' })
                      setRefresh((n) => n + 1)
                    } catch (err) {
                      toast(err.message, { tone: 'error' })
                    }
                  }}
                >
                  <Icon.Send width={14} height={14} /> Send test
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={async () => {
                    const r = await api.post(`/webhooks/${h.id}/rotate`)
                    setSecret(r.secret)
                    load()
                  }}
                >
                  <Icon.Key width={14} height={14} /> Rotate secret
                </button>
                <button className="btn btn-danger-ghost btn-sm" type="button" onClick={() => setRemoving(h)}>
                  <Icon.Trash width={14} height={14} /> Delete
                </button>
                <span className="spacer" />
                <span className="small muted">
                  {h.stats.succeeded || 0} delivered · {h.stats.failed || 0} failed · {h.stats.pending || 0} waiting
                </span>
              </div>
              <Deliveries endpointId={h.id} refreshKey={refresh} />
            </article>
          ))}
        </div>
      )}
      <NewWebhook
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(r) => {
          setAdding(false)
          setSecret(r.secret)
          load()
        }}
      />
      <SecretOnce title="Your signing secret" value={secret} onClose={() => setSecret('')}>
        <p className="small muted mt-sm">
          Use it to check the <code className="inline-code">X-Pulse-Signature</code> header. The <Link to="/developers?tab=webhooks">webhook guide</Link> has code for Node, Python and n8n, and a checker you can paste a request into.
        </p>
      </SecretOnce>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Delete this webhook?"
        danger
        confirmLabel="Delete"
        onConfirm={async () => {
          await api.del(`/webhooks/${removing.id}`)
          load()
        }}
      >
        <p>Pulse stops sending to {removing?.url}, and its delivery history is removed.</p>
      </ConfirmDialog>
    </section>
  )
}

function Tokens() {
  const [tokens, setTokens] = useState(null)
  const [name, setName] = useState('')
  const [scope, setScope] = useState('read')
  const [error, setError] = useState('')
  const [fresh, setFresh] = useState('')
  const [revoking, setRevoking] = useState(null)
  const load = useCallback(() => api.get('/tokens').then((r) => setTokens(r.tokens)), [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <section aria-labelledby="tokens-title" className="mt-lg">
      <div className="section-row">
        <div>
          <h2 id="tokens-title">API tokens</h2>
          <p className="muted small">For scripts and tools. Send as <code className="inline-code">Authorization: Bearer pulse_…</code>. A read token can only read; a write token can also add sessions.</p>
        </div>
      </div>
      <form
        className="card inline-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          try {
            const r = await api.post('/tokens', { name, scope })
            setFresh(r.token)
            setName('')
            load()
          } catch (err) {
            setError(err.fields?.name || err.message)
          }
        }}
      >
        <Field label="Token name" error={error}>
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Home dashboard" maxLength={60} />}
        </Field>
        <Field label="Access">
          {(p) => (
            <select {...p} className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="read">Read only</option>
              <option value="write">Read and write</option>
            </select>
          )}
        </Field>
        <button className="btn btn-primary" type="submit">
          <Icon.Key width={15} height={15} /> Create token
        </button>
      </form>
      {tokens && tokens.length > 0 && (
        <div className="table-wrap mt-sm">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Token</th>
                <th>Access</th>
                <th>Created</th>
                <th>Last used</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="mono small">{t.prefix}…</td>
                  <td>{t.scope === 'write' ? <Badge tone="accent">Read and write</Badge> : <Badge>Read only</Badge>}</td>
                  <td className="small">{dateTime(t.created_at)}</td>
                  <td className="small">{t.last_used_at ? dateTime(t.last_used_at) : <span className="muted">Never</span>}</td>
                  <td className="num">
                    <button className="btn btn-danger-ghost btn-sm" type="button" onClick={() => setRevoking(t)}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SecretOnce title="Your new API token" value={fresh} onClose={() => setFresh('')}>
        <div className="code mt-sm">
          <div className="code-head">
            <span>Try it</span>
          </div>
          <pre>{`curl ${window.location.origin}/api/stats?days=7 \\\n  -H "Authorization: Bearer ${fresh}"`}</pre>
        </div>
      </SecretOnce>
      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        title={`Revoke ${revoking?.name}?`}
        danger
        confirmLabel="Revoke"
        onConfirm={async () => {
          await api.del(`/tokens/${revoking.id}`)
          load()
        }}
      >
        <p>Anything using this token stops working straight away.</p>
      </ConfirmDialog>
    </section>
  )
}

export default function DeveloperPage() {
  usePageTitle('Developer')
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Developer</h1>
          <p>
            Connect Pulse to the rest of your tools. The <Link to="/developers">API reference</Link> covers every endpoint.
          </p>
        </div>
      </div>
      <Webhooks />
      <Tokens />
    </>
  )
}
