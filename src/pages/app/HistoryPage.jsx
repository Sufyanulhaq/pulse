import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useData } from '../../state/DataContext.jsx'
import { useToast } from '../../state/ToastContext.jsx'
import { dateTime, duration } from '../../lib/format.js'
import { Icon } from '../../components/Icon.jsx'
import { Badge, ConfirmDialog, EmptyState, Field, Modal, usePageTitle } from '../../components/ui.jsx'
import { ExportMenu } from './ExportMenu.jsx'

const PAGE = 25
const COLUMNS = [
  { key: 'start', label: 'Started' },
  { key: 'label', label: 'Focus' },
  { key: 'tag', label: 'Tag' },
  { key: 'minutes', label: 'Focused', num: true },
  { key: 'interruptions', label: 'Interruptions', num: true },
]

function EditSession({ session, onClose }) {
  const { updateSession, settings } = useData()
  const { toast } = useToast()
  const [label, setLabel] = useState(session?.label || '')
  const [tag, setTag] = useState(session?.tag || '')
  const [busy, setBusy] = useState(false)
  const tags = [...new Set([...settings.tags, session?.tag].filter(Boolean))]
  return (
    <Modal
      open={Boolean(session)}
      onClose={onClose}
      title="Edit session"
      size="sm"
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
              try {
                await updateSession(session.id, { label: label.trim(), tag })
                toast('Session updated.', { tone: 'success' })
                onClose()
              } catch (err) {
                toast(err.message, { tone: 'error' })
              } finally {
                setBusy(false)
              }
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="What you focused on">{(p) => <input {...p} className="input" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />}</Field>
        <Field label="Tag">
          {(p) => (
            <select {...p} className="select" value={tag} onChange={(e) => setTag(e.target.value)}>
              {tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </Modal>
  )
}

export default function HistoryPage() {
  usePageTitle('History')
  const { sessions, deleteSession, settings } = useData()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState({ key: 'start', dir: 'desc' })
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)

  const tags = useMemo(() => [...new Set([...settings.tags, ...sessions.map((s) => s.tag).filter(Boolean)])], [sessions, settings.tags])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = sessions.filter(
      (s) =>
        (tag === 'all' || s.tag === tag) &&
        (status === 'all' || (status === 'done') === s.completed) &&
        (!q || s.label.toLowerCase().includes(q) || s.tag.toLowerCase().includes(q)),
    )
    const dir = sort.dir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      const x = a[sort.key]
      const y = b[sort.key]
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir || (b.start - a.start)
    })
  }, [sessions, query, tag, status, sort])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE, current * PAGE + PAGE)
  const total = rows.reduce((sum, s) => sum + s.minutes, 0)

  const sortBy = (key) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(0)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p>Every focus block you have recorded. Search, filter, edit and export.</p>
        </div>
        <ExportMenu showImport />
      </div>

      {sessions.length === 0 ? (
        <div className="card">
          <EmptyState icon={Icon.List} title="Nothing recorded yet" action={<Link className="btn btn-primary" to="/app">Start a focus block</Link>}>
            Finish a focus block and it appears here.
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div className="filters">
            <div className="input-with-icon filters-search">
              <Icon.Search width={16} height={16} />
              <input
                className="input"
                type="search"
                placeholder="Search by label or tag"
                aria-label="Search sessions"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
              />
            </div>
            <select className="select" aria-label="Filter by tag" value={tag} onChange={(e) => { setTag(e.target.value); setPage(0) }}>
              <option value="all">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select className="select" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
              <option value="all">Finished and stopped</option>
              <option value="done">Finished only</option>
              <option value="stopped">Stopped early only</option>
            </select>
          </div>
          <p className="small muted filters-summary" aria-live="polite">
            {rows.length} session{rows.length === 1 ? '' : 's'} · {duration(total)} focused
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={c.num ? 'num' : ''} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button className="th-sort" type="button" onClick={() => sortBy(c.key)}>
                        {c.label}
                        {sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id}>
                    <td>{dateTime(s.start)}</td>
                    <td className="wrap">{s.label || <span className="muted">No label</span>}</td>
                    <td>{s.tag || <span className="muted">Untagged</span>}</td>
                    <td className="num">{duration(s.minutes)}</td>
                    <td className="num">{s.interruptions}</td>
                    <td>{s.completed ? <Badge tone="good">Finished</Badge> : <Badge tone="warn">Stopped early</Badge>}</td>
                    <td className="num">
                      <div className="row-actions">
                        <button className="icon-btn" type="button" aria-label={`Edit session from ${dateTime(s.start)}`} onClick={() => setEditing(s)}>
                          <Icon.Edit width={15} height={15} />
                        </button>
                        <button className="icon-btn" type="button" aria-label={`Delete session from ${dateTime(s.start)}`} onClick={() => setRemoving(s)}>
                          <Icon.Trash width={15} height={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                      No sessions match those filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button className="btn btn-ghost btn-sm" type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Previous
              </button>
              <span className="small muted">
                Page {current + 1} of {pages}
              </span>
              <button className="btn btn-ghost btn-sm" type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Next
              </button>
            </nav>
          )}
        </div>
      )}

      <EditSession key={editing?.id} session={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Delete this session?"
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          try {
            await deleteSession(removing.id)
            toast('Session deleted.', { tone: 'success' })
          } catch (err) {
            toast(err.message, { tone: 'error' })
          }
        }}
      >
        {removing && (
          <p>
            {duration(removing.minutes)} of {removing.tag || 'focus'} from {dateTime(removing.start)} will be removed. This cannot be undone.
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
