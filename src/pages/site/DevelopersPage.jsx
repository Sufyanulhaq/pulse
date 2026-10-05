import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icon } from '../../components/Icon.jsx'
import { Badge, CopyButton, Field, usePageTitle } from '../../components/ui.jsx'
import { signPayload, verifyPayload } from '../../lib/webhook.js'
import { DemoNote } from '../../components/DemoNote.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'checker', label: 'Signature checker' },
]

const ENDPOINTS = [
  { group: 'Sessions', method: 'GET', path: '/api/sessions', auth: 'read', desc: 'List sessions. Query: from, to (ms), q, tag, completed, sort (start, minutes, interruptions, label), order, limit (up to 20000), offset.' },
  { group: 'Sessions', method: 'POST', path: '/api/sessions', auth: 'write', desc: 'Save one session. Sending the same id twice is safe: the answer is 200 with duplicate true.' },
  { group: 'Sessions', method: 'POST', path: '/api/sessions/import', auth: 'write', desc: 'Save up to 5000 sessions at once. Duplicates are skipped and invalid rows are reported by index. Imports do not fire webhooks.' },
  { group: 'Sessions', method: 'PATCH', path: '/api/sessions/:id', auth: 'write', desc: 'Change the label or tag of a session.' },
  { group: 'Sessions', method: 'DELETE', path: '/api/sessions/:id', auth: 'write', desc: 'Delete a session. Fires session.deleted.' },
  { group: 'Sessions', method: 'GET', path: '/api/sessions/export.csv', auth: 'read', desc: 'Every session as CSV, with spreadsheet formulas neutralised.' },
  { group: 'Stats', method: 'GET', path: '/api/stats?days=30', auth: 'read', desc: 'Totals, focus score, the period before, daily series, hour and weekday breakdowns, heatmap, tags and streaks. days is 7, 30, 90 or 365.' },
  { group: 'Settings', method: 'GET', path: '/api/settings', auth: 'read', desc: 'Timer lengths, daily goal, tags and alert settings.' },
  { group: 'Settings', method: 'PUT', path: '/api/settings', auth: 'write', desc: 'Change any settings. Only the fields you send are changed.' },
  { group: 'Account', method: 'POST', path: '/api/auth/signup', auth: 'none', desc: 'Create an account: name, email, password (10 or more characters). Sets the login cookie.' },
  { group: 'Account', method: 'POST', path: '/api/auth/login', auth: 'none', desc: 'Log in. Five failures lock the email for 15 minutes.' },
  { group: 'Account', method: 'GET', path: '/api/account/export', auth: 'browser', desc: 'Everything stored about you, as JSON.' },
  { group: 'Webhooks', method: 'POST', path: '/api/webhooks', auth: 'browser', desc: 'Add an endpoint: url, description, events. The signing secret is returned once.' },
  { group: 'Webhooks', method: 'POST', path: '/api/webhooks/:id/test', auth: 'browser', desc: 'Send a ping event now and return the delivery result.' },
  { group: 'Webhooks', method: 'GET', path: '/api/webhooks/:id/deliveries', auth: 'browser', desc: 'Recent deliveries with status, attempts and the last response.' },
  { group: 'Webhooks', method: 'POST', path: '/api/deliveries/:id/replay', auth: 'browser', desc: 'Send a failed delivery again with a fresh set of attempts.' },
  { group: 'Teams', method: 'GET', path: '/api/teams/:id', auth: 'browser', desc: 'Members, and team totals once three people have joined.' },
  { group: 'Assistant', method: 'POST', path: '/api/assistant', auth: 'browser', desc: 'Ask a question about your sessions. Returns the answer, whether it could be answered, and the facts it cited.' },
  { group: 'Health', method: 'GET', path: '/api/health', auth: 'none', desc: 'Service status and which assistant mode is running.' },
]

const AUTH_LABEL = {
  read: ['primary', 'Token: read'],
  write: ['accent', 'Token: write'],
  browser: ['neutral', 'Browser login'],
  none: ['good', 'Public'],
}

const SAMPLE_BODY = JSON.stringify(
  {
    type: 'session.completed',
    id: 'evt_s_demo',
    created: 1791200400,
    data: {
      session_id: 's_demo',
      started_at: '2026-10-05T09:00:00.000Z',
      ended_at: '2026-10-05T09:25:00.000Z',
      focused_minutes: 25,
      planned_minutes: 25,
      label: 'Draft the API docs',
      tag: 'Deep work',
      interruptions: 1,
      finished: true,
    },
  },
  null,
  2,
)

const CODE = {
  node: `import { createHmac, timingSafeEqual } from 'node:crypto'
import express from 'express'

const app = express()

// Keep the raw bytes: the signature covers exactly what was sent.
app.post('/hooks/pulse', express.raw({ type: 'application/json' }), (req, res) => {
  const timestamp = req.get('X-Pulse-Timestamp')
  const signature = req.get('X-Pulse-Signature') || ''
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!timestamp || age > 300) return res.status(401).send('stale')

  const expected = createHmac('sha256', process.env.PULSE_WEBHOOK_SECRET)
    .update(\`\${timestamp}.\${req.body}\`)
    .digest('hex')
  const ok = expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  if (!ok) return res.status(401).send('bad signature')

  const event = JSON.parse(req.body)
  // Deliveries can repeat after a timeout: use the Idempotency-Key header to skip repeats.
  console.log(event.type, event.data)
  res.sendStatus(204)
})`,
  python: `import hmac, hashlib, os, time
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
SECRET = os.environ["PULSE_WEBHOOK_SECRET"].encode()

@app.post("/hooks/pulse")
async def pulse_hook(request: Request):
    body = await request.body()
    timestamp = request.headers.get("X-Pulse-Timestamp", "")
    signature = request.headers.get("X-Pulse-Signature", "")
    if not timestamp.isdigit() or abs(time.time() - int(timestamp)) > 300:
        raise HTTPException(401, "stale")
    expected = hmac.new(SECRET, f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(401, "bad signature")
    event = await request.json()
    print(event["type"], event["data"])
    return {"ok": True}`,
  n8n: `// n8n: Webhook node with "Raw Body" switched on, then a Code node:
const crypto = require('crypto')
const item = $input.first()
const raw = Buffer.from(item.binary.data.data, 'base64').toString('utf8')
const ts = item.json.headers['x-pulse-timestamp']
const sig = item.json.headers['x-pulse-signature']

const expected = crypto
  .createHmac('sha256', $env.PULSE_WEBHOOK_SECRET)
  .update(\`\${ts}.\${raw}\`)
  .digest('hex')

if (expected !== sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
  throw new Error('Pulse signature check failed')
}
return [{ json: JSON.parse(raw) }]`,
}

function CodeBlock({ title, code }) {
  return (
    <div className="code">
      <div className="code-head">
        <span>{title}</span>
        <CopyButton text={code} />
      </div>
      <pre>{code}</pre>
    </div>
  )
}

function Overview() {
  return (
    <div className="docs">
      <h2>Base URL and authentication</h2>
      <p>
        Every endpoint lives under <code className="inline-code">/api</code> on the same host as the app. There are two ways to authenticate:
      </p>
      <ul>
        <li>
          <strong>Personal API tokens</strong> for scripts. Create one in <Link to="/app/developer">the Developer section</Link> and send it as <code className="inline-code">Authorization: Bearer pulse_…</code>. A read token can read sessions, stats and settings; a write token can also change them.
        </li>
        <li>
          <strong>The browser login cookie</strong> for the web app. Changes made with the cookie must also send <code className="inline-code">X-Requested-With: pulse</code>, which a page on another site cannot add. Account, webhook, token and team management only accept the cookie.
        </li>
      </ul>
      <CodeBlock title="Your last 7 days" code={`curl https://YOUR_PULSE_HOST/api/stats?days=7 \\\n  -H "Authorization: Bearer $PULSE_TOKEN"`} />

      <h2>Errors</h2>
      <p>Errors use ordinary status codes and the same JSON shape. Validation errors name each field.</p>
      <CodeBlock
        title="400 Bad Request"
        code={JSON.stringify({ error: { code: 'bad_request', message: 'Some fields are not valid.', details: { end: 'End must not be before start.' } } }, null, 2)}
      />
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {[
              ['400', 'The request is not valid. details names the fields.'],
              ['401', 'Not logged in, or the token is wrong or revoked.'],
              ['403', 'Logged in, but not allowed: a read token writing, or a missing X-Requested-With header.'],
              ['404', 'Not found, or not yours. Pulse never confirms that someone else’s record exists.'],
              ['409', 'Conflict, such as an email that already has an account.'],
              ['429', 'Too many requests. Wait for the number of seconds in Retry-After.'],
            ].map(([code, text]) => (
              <tr key={code}>
                <td className="mono">{code}</td>
                <td className="wrap">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Limits</h2>
      <p>600 requests a minute per address, 20 sign up or log in attempts a minute, and 20 assistant questions a minute per account. Request bodies can be up to 2 MB. Responses include RateLimit-Limit and RateLimit-Remaining headers.</p>

      <h2>The session object</h2>
      <CodeBlock
        title="Session"
        code={`{
  "id": "s_mf3k2l_x81c",      // your id: letters, numbers and _ . : -, up to 64
  "start": 1791190800000,     // ms since 1970, not in the future
  "end": 1791192300000,       // at most a day after start
  "minutes": 25,              // focused minutes, pauses excluded
  "planned": 25,              // the block length that was set
  "label": "Draft the API docs",
  "tag": "Deep work",
  "interruptions": 1,
  "completed": true           // false when stopped early
}`}
      />
    </div>
  )
}

function Endpoints() {
  const [filter, setFilter] = useState('')
  const rows = ENDPOINTS.filter((e) => !filter || `${e.method} ${e.path} ${e.desc} ${e.group}`.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="docs">
      <div className="input-with-icon docs-filter">
        <Icon.Search width={16} height={16} />
        <input className="input" type="search" placeholder="Filter endpoints" aria-label="Filter endpoints" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="endpoints">
        {rows.map((e, i) => {
          const head = i === 0 || rows[i - 1].group !== e.group
          const [tone, label] = AUTH_LABEL[e.auth]
          return (
            <div key={e.method + e.path}>
              {head && <h3 className="endpoint-group">{e.group}</h3>}
              <div className="endpoint">
                <span className={`method method-${e.method.toLowerCase()}`}>{e.method}</span>
                <code className="endpoint-path">{e.path}</code>
                <Badge tone={tone}>{label}</Badge>
                <p>{e.desc}</p>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <p className="muted">No endpoints match.</p>}
      </div>
    </div>
  )
}

function Webhooks() {
  const [lang, setLang] = useState('node')
  return (
    <div className="docs">
      <h2>Events</h2>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            <tr>
              <td className="mono">session.completed</td>
              <td className="wrap">A focus block was saved, finished or stopped early.</td>
            </tr>
            <tr>
              <td className="mono">session.deleted</td>
              <td className="wrap">A session was deleted.</td>
            </tr>
            <tr>
              <td className="mono">goal.reached</td>
              <td className="wrap">Today’s focused time crossed your daily goal. Sent at most once a day.</td>
            </tr>
            <tr>
              <td className="mono">ping</td>
              <td className="wrap">Sent when you press Send test.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>What each request carries</h2>
      <ul>
        <li>
          <code className="inline-code">X-Pulse-Event</code>: the event type.
        </li>
        <li>
          <code className="inline-code">X-Pulse-Timestamp</code>: Unix seconds when it was signed. Reject anything older than five minutes.
        </li>
        <li>
          <code className="inline-code">X-Pulse-Signature</code>: hex HMAC SHA 256 of <code className="inline-code">timestamp + "." + raw body</code>, keyed with your endpoint’s secret.
        </li>
        <li>
          <code className="inline-code">Idempotency-Key</code>: the same for every retry of one delivery, so you can skip repeats.
        </li>
      </ul>
      <CodeBlock title="Body" code={SAMPLE_BODY} />

      <h2>Retries</h2>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            <tr>
              <td>2xx</td>
              <td className="wrap">Delivered.</td>
            </tr>
            <tr>
              <td>Network error, timeout, 408, 429, 5xx</td>
              <td className="wrap">Tried again after 10, 20, 40 and 80 seconds, five tries in all. A Retry-After header is respected, up to an hour.</td>
            </tr>
            <tr>
              <td>Any other 4xx</td>
              <td className="wrap">Stopped at once and marked failed with your response. Retrying a refusal only repeats it. Fix the cause, then press Replay.</td>
            </tr>
            <tr>
              <td>3xx</td>
              <td className="wrap">Stopped. Redirects are never followed.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted">Endpoints must use https and resolve to a public address. Addresses on private networks are refused when you save the URL and again before every delivery.</p>

      <h2>Verifying a request</h2>
      <div className="tabs" role="tablist">
        {[
          ['node', 'Node.js'],
          ['python', 'Python'],
          ['n8n', 'n8n'],
        ].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={lang === id} onClick={() => setLang(id)}>
            {label}
          </button>
        ))}
      </div>
      <CodeBlock title={lang === 'node' ? 'server.js' : lang === 'python' ? 'main.py' : 'Code node'} code={CODE[lang]} />
    </div>
  )
}

function Checker() {
  const [secret, setSecret] = useState('whsec_test_secret')
  const [body, setBody] = useState(SAMPLE_BODY)
  const [timestamp, setTimestamp] = useState('')
  const [signature, setSignature] = useState('')
  const [result, setResult] = useState(null)
  const now = useMemo(() => Math.floor(Date.now() / 1000), [])

  return (
    <div className="docs">
      <p>
        Paste a request your server received and its endpoint secret to see whether the signature is valid. Everything runs in this page with the Web Crypto API; nothing is sent anywhere.
      </p>
      <div className="form-grid">
        <Field label="Signing secret">{(p) => <input {...p} className="input mono" value={secret} onChange={(e) => setSecret(e.target.value)} />}</Field>
        <Field label="Raw request body" hint="Exactly as received. Re-formatting the JSON changes the bytes and breaks the signature.">
          {(p) => <textarea {...p} className="textarea mono" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <div className="form-grid form-grid-2">
          <Field label="X-Pulse-Timestamp">{(p) => <input {...p} className="input mono" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} placeholder={String(now)} />}</Field>
          <Field label="X-Pulse-Signature">{(p) => <input {...p} className="input mono" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="64 hex characters" />}</Field>
        </div>
        <div className="row">
          <button className="btn btn-primary" type="button" onClick={async () => setResult(await verifyPayload({ secret, rawBody: body, timestamp, signature }))}>
            <Icon.Shield width={16} height={16} /> Verify
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={async () => {
              const signed = await signPayload(secret, body)
              setTimestamp(String(signed.timestamp))
              setSignature(signed.signature)
              setResult(null)
            }}
          >
            Sign it for me
          </button>
        </div>
        {result && (
          <div className={`callout ${result.ok ? 'callout-good' : 'callout-warn'}`} role="status">
            {result.ok ? <Icon.Check width={18} height={18} /> : <Icon.Alert width={18} height={18} />}
            <div>
              <strong>{result.ok ? 'Valid.' : 'Not valid.'}</strong> {result.reason}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DevelopersPage() {
  usePageTitle('Developers')
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview'
  return (
    <>
      <section className="page-hero container">
        <span className="eyebrow">Developers</span>
        <h1>API and webhooks</h1>
        <p className="hero-sub">Read your focus data, log sessions from anywhere, and get a signed request when something happens.</p>
        <DemoNote>The API and webhooks run on the full version’s server, which this live demo does not include. The signature checker below works right here in your browser.</DemoNote>
      </section>
      <section className="container docs-shell">
        <div className="tabs" role="tablist" aria-label="Documentation sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setParams(t.id === 'overview' ? {} : { tab: t.id }, { replace: true })}>
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'overview' && <Overview />}
          {tab === 'endpoints' && <Endpoints />}
          {tab === 'webhooks' && <Webhooks />}
          {tab === 'checker' && <Checker />}
        </div>
      </section>
    </>
  )
}
