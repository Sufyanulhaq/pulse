import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon.jsx'
import { Badge, Modal, Segmented, usePageTitle } from '../../components/ui.jsx'

const STATUS = {
  built: { tone: 'good', label: 'Built in' },
  recipe: { tone: 'primary', label: 'Recipe' },
  planned: { tone: 'neutral', label: 'Planned' },
}

const ITEMS = [
  { id: 'webhooks', name: 'Webhooks', icon: Icon.Plug, status: 'built', category: 'Developer', body: 'Signed POST requests for session.completed, session.deleted and goal.reached, with retries and replay.', steps: ['Open the Developer section in the app and add your URL.', 'Save the signing secret shown once.', 'Verify X-Pulse-Signature on your server using the code in the API reference.'] },
  { id: 'api', name: 'REST API', icon: Icon.Code, status: 'built', category: 'Developer', body: 'Read stats and sessions, or log sessions from scripts, with read or write tokens.', steps: ['Create a token in the Developer section.', 'Send it as Authorization: Bearer.', 'Start with GET /api/stats?days=7.'] },
  { id: 'csv', name: 'CSV export', icon: Icon.Download, status: 'built', category: 'Data', body: 'Every session as a spreadsheet ready CSV. Formulas are neutralised so nothing runs on open.', steps: ['Open History or Insights.', 'Press CSV.'] },
  { id: 'json', name: 'JSON backup', icon: Icon.Database, status: 'built', category: 'Data', body: 'Download a full backup and restore it later, on any device, signed in or not.', steps: ['Open Settings and press JSON to download.', 'Press Import JSON to restore. Duplicates are skipped.'] },
  { id: 'notifications', name: 'Desktop notifications', icon: Icon.Bell, status: 'built', category: 'Alerts', body: 'A system notification when a block or break ends, even when Pulse is in a background tab.', steps: ['Open Settings.', 'Turn on Desktop notifications and allow them when the browser asks.'] },
  { id: 'n8n', name: 'n8n', icon: Icon.Layers, status: 'recipe', category: 'Automation', body: 'Receive Pulse webhooks in n8n, check the signature in a Code node, and route sessions anywhere n8n reaches.', steps: ['Add a Webhook node with Raw Body on.', 'Paste the n8n snippet from the API reference into a Code node.', 'Add your Pulse webhook pointing at the n8n production URL.'] },
  { id: 'sheets', name: 'Google Sheets', icon: Icon.List, status: 'recipe', category: 'Data', body: 'Append a row for every finished block, via n8n or Make.', steps: ['Build the n8n recipe above.', 'Add a Google Sheets node set to Append Row.', 'Map focused_minutes, tag, label and started_at to columns.'] },
  { id: 'slack', name: 'Slack', icon: Icon.Message, status: 'recipe', category: 'Alerts', body: 'Post to a channel when you reach your daily goal.', steps: ['Subscribe a webhook to goal.reached only.', 'In n8n, send the event to a Slack node.', 'Write the message from data.focused_minutes and data.goal_minutes.'] },
  { id: 'zapier', name: 'Zapier and Make', icon: Icon.Zap, status: 'recipe', category: 'Automation', body: 'Use a catch hook to receive events. Signature checks need a code step.', steps: ['Create a Catch Raw Hook.', 'Add a code step that checks the HMAC as in the API reference.', 'Continue the flow from the parsed body.'] },
  { id: 'calendar', name: 'Google Calendar', icon: Icon.Calendar, status: 'planned', category: 'Planning', body: 'Block focus time on your calendar and start the timer when the event begins.', steps: [] },
  { id: 'linear', name: 'Linear and Jira', icon: Icon.Briefcase, status: 'planned', category: 'Planning', body: 'Pick an issue as the focus label, and see time per issue in Insights.', steps: [] },
]

export default function IntegrationsPage() {
  usePageTitle('Integrations')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const rows = useMemo(
    () => ITEMS.filter((i) => (status === 'all' || i.status === status) && (!query || `${i.name} ${i.body} ${i.category}`.toLowerCase().includes(query.toLowerCase()))),
    [status, query],
  )

  return (
    <>
      <section className="page-hero container">
        <span className="eyebrow">Integrations</span>
        <h1>Connect Pulse to your tools</h1>
        <p className="hero-sub">What is built in, what you can build in minutes with a webhook, and what is coming next. Labelled honestly.</p>
      </section>
      <section className="container">
        <div className="filters">
          <div className="input-with-icon filters-search">
            <Icon.Search width={16} height={16} />
            <input className="input" type="search" placeholder="Search integrations" aria-label="Search integrations" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'built', label: 'Built in' },
              { value: 'recipe', label: 'Recipes' },
              { value: 'planned', label: 'Planned' },
            ]}
          />
        </div>
        <div className="integration-grid">
          {rows.map((i) => {
            const IIcon = i.icon
            return (
              <button key={i.id} type="button" className="integration" onClick={() => setOpen(i)} disabled={!i.steps.length}>
                <div className="integration-head">
                  <span className="feature-icon">
                    <IIcon />
                  </span>
                  <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
                </div>
                <h3>{i.name}</h3>
                <p>{i.body}</p>
                <span className="integration-cat">{i.category}</span>
              </button>
            )
          })}
          {rows.length === 0 && <p className="muted">Nothing matches that search.</p>}
        </div>
        <div className="callout mt-lg">
          <Icon.Info width={18} height={18} />
          <div>
            Need something that is not here? Every event Pulse sends is documented in the <Link to="/developers?tab=webhooks">webhook guide</Link>, or <Link to="/contact">ask for it</Link>.
          </div>
        </div>
      </section>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name || ''}>
        {open && (
          <>
            <p>{open.body}</p>
            <ol className="steps">
              {open.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="row mt">
              {open.status === 'built' ? (
                <Link className="btn btn-primary" to={open.category === 'Developer' ? '/app/developer' : '/app/settings'}>
                  Open in the app
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/developers?tab=webhooks">
                  Webhook guide
                </Link>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
