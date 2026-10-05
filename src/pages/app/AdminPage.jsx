import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { dateTime, duration, shortDate } from '../../lib/format.js'
import { BarChart } from '../../components/Charts.jsx'
import { Icon } from '../../components/Icon.jsx'
import { Badge, EmptyState, Spinner, Stat, usePageTitle } from '../../components/ui.jsx'
import { useToast } from '../../state/ToastContext.jsx'

export default function AdminPage() {
  usePageTitle('Admin')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [backingUp, setBackingUp] = useState(false)
  const { toast } = useToast()
  const load = () => api.get('/admin/overview').then(setData).catch((err) => setError(err.message))
  useEffect(() => {
    load()
  }, [])

  if (error) return <div className="card"><EmptyState icon={Icon.Lock} title="Admins only">{error}</EmptyState></div>
  if (!data) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p>How the whole service is doing.</p>
        </div>
        <div className="row">
          <Badge tone={data.assistantMode === 'claude' ? 'primary' : 'neutral'}>Assistant: {data.assistantMode}</Badge>
          <Badge tone={data.emailProvider === 'log' ? 'warn' : 'good'}>Email: {data.emailProvider === 'log' ? 'printed, not sent' : data.emailProvider}</Badge>
        </div>
      </div>
      <div className="grid grid-4">
        <Stat label="Users" icon={Icon.Users} value={data.users} sub={`${data.activeUsers7d} active in 7 days`} />
        <Stat label="Sessions" icon={Icon.Layers} value={data.sessions.toLocaleString()} sub={`${duration(data.focusedMinutes)} focused`} />
        <Stat label="Teams" icon={Icon.Users} value={data.teams} />
        <Stat label="Assistant questions" icon={Icon.Message} value={data.assistantQuestions} />
      </div>
      <div className="grid grid-2-1 mt">
        <section className="card">
          <div className="card-head">
            <h2>Sign ups, last 30 days</h2>
          </div>
          <BarChart data={data.signups.map((d) => ({ label: shortDate(new Date(d.date).getTime()), value: d.count }))} labelEvery={5} highlightLast summary="New accounts per day" />
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Integrations</h2>
          </div>
          <dl className="records">
            <div>
              <dt>Webhooks</dt>
              <dd>{data.webhooks}</dd>
            </div>
            <div>
              <dt>API tokens</dt>
              <dd>{data.apiTokens}</dd>
            </div>
            <div>
              <dt>Deliveries sent</dt>
              <dd>{data.deliveries.succeeded || 0}</dd>
            </div>
            <div>
              <dt>Deliveries failed</dt>
              <dd>{data.deliveries.failed || 0}</dd>
            </div>
          </dl>
        </section>
      </div>
      <div className="grid grid-2 mt">
        <section className="card">
          <div className="card-head">
            <h2>Paying accounts</h2>
          </div>
          <dl className="records">
            <div>
              <dt>Pro</dt>
              <dd>{data.plans.pro || 0}</dd>
            </div>
            <div>
              <dt>Team</dt>
              <dd>{data.plans.team || 0}</dd>
            </div>
          </dl>
          <p className="small muted mt-sm">{data.emailFailures7d} email{data.emailFailures7d === 1 ? '' : 's'} failed to send in the last 7 days.</p>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Database backups</h2>
            {data.backups.enabled && (
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={backingUp}
                onClick={async () => {
                  setBackingUp(true)
                  try {
                    const r = await api.post('/admin/backups')
                    toast(`Backup written: ${r.backup.name}`, { tone: 'success' })
                    load()
                  } catch (err) {
                    toast(err.message, { tone: 'error' })
                  } finally {
                    setBackingUp(false)
                  }
                }}
              >
                {backingUp ? <Spinner /> : <Icon.Database width={15} height={15} />} Back up now
              </button>
            )}
          </div>
          {data.backups.enabled ? (
            data.backups.latest ? (
              <p className="small">
                Latest: <span className="mono">{data.backups.latest.name}</span>, {(data.backups.latest.bytes / 1024).toFixed(0)} KB, {dateTime(data.backups.latest.createdAt)}
              </p>
            ) : (
              <p className="small muted">No backups yet. The first runs on schedule, or press Back up now.</p>
            )
          ) : (
            <p className="small muted">Backups are off. Set BACKUP_DIR on the server to turn on scheduled copies.</p>
          )}
        </section>
      </div>
      <section className="card mt">
        <div className="card-head">
          <h2>Recent failed deliveries</h2>
        </div>
        {data.recentFailures.length === 0 ? (
          <p className="muted small">None. Every webhook delivery has gone through or is still retrying.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Error</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFailures.map((f) => (
                  <tr key={f.id}>
                    <td>{f.event_type}</td>
                    <td>{f.last_status || 'none'}</td>
                    <td className="wrap small">{f.last_error}</td>
                    <td className="small">{dateTime(f.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
