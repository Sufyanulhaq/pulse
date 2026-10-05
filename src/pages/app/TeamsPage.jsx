import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../../api.js'
import { useToast } from '../../state/ToastContext.jsx'
import { duration, hourLabel, percent, shortDate } from '../../lib/format.js'
import { BarChart, BarList } from '../../components/Charts.jsx'
import { Icon } from '../../components/Icon.jsx'
import { useAuth } from '../../state/AuthContext.jsx'
import { UpgradeCallout } from '../../components/UpgradeCallout.jsx'
import { Badge, ConfirmDialog, CopyButton, EmptyState, Field, Spinner, Stat, usePageTitle } from '../../components/ui.jsx'

function TeamForms({ onDone }) {
  const { user } = useAuth()
  const canCreate = user?.billing?.features?.createTeams !== false
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [code, setCode] = useState(params.get('join') || '')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState('')
  const navigate = useNavigate()
  const { toast } = useToast()

  const submit = async (kind) => {
    setBusy(kind)
    setErrors({})
    try {
      const r = kind === 'create' ? await api.post('/teams', { name }) : await api.post('/teams/join', { code })
      toast(kind === 'create' ? `Created ${r.team.name}.` : `You joined ${r.team.name}.`, { tone: 'success' })
      onDone()
      navigate(`/app/teams/${r.team.id}`)
    } catch (err) {
      setErrors({ [kind]: err.fields?.name || err.fields?.code || err.message })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="grid grid-2">
      {!canCreate ? (
        <div className="card">
          <h2 className="card-title">Create a team</h2>
          <p className="card-sub mb">Creating a team needs the Team plan. Joining one is always free.</p>
          <UpgradeCallout plan="Team">Run a team with private, totals only insights.</UpgradeCallout>
        </div>
      ) : (
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          submit('create')
        }}
      >
        <h2 className="card-title">Create a team</h2>
        <p className="card-sub">You become the owner and get an invite code to share.</p>
        <div className="inline-form">
          <Field label="Team name" error={errors.create}>
            {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Platform team" maxLength={60} />}
          </Field>
          <button className="btn btn-primary" type="submit" disabled={busy === 'create'}>
            {busy === 'create' ? <Spinner /> : <Icon.Plus width={16} height={16} />} Create
          </button>
        </div>
      </form>
      )}
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          submit('join')
        }}
      >
        <h2 className="card-title">Join a team</h2>
        <p className="card-sub">Paste the invite code someone sent you.</p>
        <div className="inline-form">
          <Field label="Invite code" error={errors.join}>
            {(p) => <input {...p} className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD1234EF" maxLength={20} />}
          </Field>
          <button className="btn btn-ghost" type="submit" disabled={busy === 'join'}>
            {busy === 'join' ? <Spinner /> : null} Join
          </button>
        </div>
      </form>
    </div>
  )
}

function InviteByEmail({ teamId }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!user?.emailVerified) return <p className="small muted mt-sm">Confirm your email address to send invites by email.</p>
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault()
        const emails = value.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)
        if (!emails.length) return setError('Add at least one email.')
        setBusy(true)
        setError('')
        try {
          const r = await api.post(`/teams/${teamId}/invites`, { emails })
          const sent = r.results.filter((x) => x.sent).length
          toast(`Sent ${sent} invite${sent === 1 ? '' : 's'}${sent < r.results.length ? `; ${r.results.length - sent} failed` : ''}.`, { tone: sent ? 'success' : 'error' })
          setValue('')
        } catch (err) {
          setError(Object.values(err.fields || {})[0] || err.message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <Field label="Invite by email" hint="Separate several addresses with commas. Up to 10 at a time." error={error}>
        {(p) => <input {...p} className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="sam@example.com, alex@example.com" />}
      </Field>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? <Spinner /> : <Icon.Send width={15} height={15} />} Send
      </button>
    </form>
  )
}

export function TeamsList() {
  usePageTitle('Teams')
  const [teams, setTeams] = useState(null)
  const load = useCallback(() => api.get('/teams').then((r) => setTeams(r.teams)).catch(() => setTeams([])), [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Teams</h1>
          <p>See how your team protects focus time, without anyone watching individuals. Team figures only appear once three people have joined, and only as totals.</p>
        </div>
      </div>
      {teams === null ? (
        <Spinner />
      ) : teams.length > 0 ? (
        <div className="team-list">
          {teams.map((t) => (
            <Link key={t.id} to={`/app/teams/${t.id}`} className="card team-card">
              <span className="team-avatar" aria-hidden="true">
                {t.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{t.name}</strong>
                <span className="small muted">
                  {t.members} member{t.members === 1 ? '' : 's'} · {t.role === 'owner' ? 'Owner' : 'Member'}
                </span>
              </div>
              <Icon.Arrow />
            </Link>
          ))}
        </div>
      ) : null}
      <div className="mt">
        <TeamForms onDone={load} />
      </div>
    </>
  )
}

export function TeamDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  usePageTitle(data?.team.name || 'Team')

  const load = useCallback(() => {
    api
      .get(`/teams/${id}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div className="card">
        <EmptyState icon={Icon.Users} title="Team not found" action={<Link className="btn btn-primary" to="/app/teams">Back to teams</Link>}>
          {error}
        </EmptyState>
      </div>
    )
  }
  if (!data) return <Spinner />

  const { team, members, stats, minMembersForStats } = data
  const owner = team.role === 'owner'
  const inviteLink = team.inviteCode ? `${window.location.origin}/app/teams?join=${team.inviteCode}` : ''

  const act = async (fn, message) => {
    try {
      await fn()
      if (message) toast(message, { tone: 'success' })
      load()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  return (
    <>
      <Link to="/app/teams" className="back-link">
        <Icon.ArrowLeft width={16} height={16} /> All teams
      </Link>
      <div className="page-head">
        <div>
          <h1>{team.name}</h1>
          <p>
            {members.length} member{members.length === 1 ? '' : 's'} · you are {owner ? 'the owner' : 'a member'}
          </p>
        </div>
        {owner ? (
          <button className="btn btn-danger-ghost btn-sm" type="button" onClick={() => setConfirm('delete')}>
            <Icon.Trash width={15} height={15} /> Delete team
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirm('leave')}>
            <Icon.Logout width={15} height={15} /> Leave team
          </button>
        )}
      </div>

      {stats ? (
        <>
          <div className="grid grid-4">
            <Stat label="Team focus, 30 days" icon={Icon.Clock} value={duration(stats.minutes)} sub={`${stats.sessions} sessions`} />
            <Stat label="Per member" icon={Icon.Users} value={duration(stats.minutesPerMember)} sub={`${stats.activeMembers} of ${members.length} active`} />
            <Stat label="Finished blocks" icon={Icon.Check} value={percent(stats.completionRate)} />
            <Stat label="Interruptions" icon={Icon.Bell} value={stats.interruptionsPerHour.toFixed(1)} sub="per focused hour" />
          </div>
          <div className="grid grid-2-1 mt">
            <section className="card">
              <div className="card-head">
                <h2>Team focus per day</h2>
              </div>
              <BarChart
                data={stats.daily.map((d) => ({ label: shortDate(new Date(d.date).getTime()), value: Math.round(d.minutes) }))}
                format={(v) => duration(v)}
                labelEvery={5}
                highlightLast
                summary="Team focused minutes per day over 30 days"
              />
            </section>
            <section className="card">
              <div className="card-head">
                <h2>Where team time goes</h2>
              </div>
              <BarList items={stats.tags.map((t) => ({ label: t.tag, value: Math.round(t.minutes) }))} format={(v) => duration(v)} />
              <p className="small muted mt-sm">
                Busiest focus hour:{' '}
                {(() => {
                  const max = Math.max(...stats.byHour)
                  const h = stats.byHour.indexOf(max)
                  return max > 0 ? `${hourLabel(h)} to ${hourLabel((h + 1) % 24)}` : 'not enough data yet'
                })()}
              </p>
            </section>
          </div>
        </>
      ) : (
        <div className="callout">
          <Icon.Shield width={18} height={18} />
          <div>
            <strong>Team numbers unlock at {minMembersForStats} members.</strong> With fewer people, anyone could work out a colleague’s figures by subtracting their own. Invite {minMembersForStats - members.length} more to see team insights.
          </div>
        </div>
      )}

      <div className="grid grid-2 mt">
        <section className="card">
          <div className="card-head">
            <h2>Members</h2>
          </div>
          <ul className="member-list">
            {members.map((m) => (
              <li key={m.id}>
                <span className="avatar" aria-hidden="true">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="member-text">
                  <strong>
                    {m.name} {m.you && <span className="muted small">(you)</span>}
                  </strong>
                  <span className="small muted">Joined {shortDate(m.joinedAt)}</span>
                </div>
                {m.role === 'owner' ? <Badge tone="primary">Owner</Badge> : null}
                {owner && !m.you && (
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirm({ kind: 'transfer', member: m })}>
                      Make owner
                    </button>
                    <button className="icon-btn" type="button" aria-label={`Remove ${m.name}`} onClick={() => setConfirm({ kind: 'remove', member: m })}>
                      <Icon.X width={15} height={15} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
        {owner && (
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Invite people</h2>
                <p className="card-sub">Anyone with this code or link can join. Make a new one to stop the old one working.</p>
              </div>
            </div>
            <div className="invite-code mono">{team.inviteCode}</div>
            <InviteByEmail teamId={team.id} />
            <div className="row mt-sm">
              <CopyButton text={team.inviteCode} label="Copy code" />
              <CopyButton text={inviteLink} label="Copy link" />
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => act(() => api.post(`/teams/${team.id}/invite`), 'New invite code made. The old one no longer works.')}>
                <Icon.Refresh width={15} height={15} /> New code
              </button>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title={`Delete ${team.name}?`}
        confirmLabel="Delete team"
        danger
        onConfirm={() => act(() => api.del(`/teams/${team.id}`), 'Team deleted.').then(() => navigate('/app/teams'))}
      >
        <p>Everyone is removed from the team. Their own sessions are not touched.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        title={`Leave ${team.name}?`}
        confirmLabel="Leave"
        onConfirm={() => act(() => api.post(`/teams/${team.id}/leave`), 'You left the team.').then(() => navigate('/app/teams'))}
      >
        <p>You can join again later with an invite code.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === 'remove'}
        onClose={() => setConfirm(null)}
        title={`Remove ${confirm?.member?.name}?`}
        confirmLabel="Remove"
        danger
        onConfirm={() => act(() => api.del(`/teams/${team.id}/members/${confirm.member.id}`), 'Member removed.')}
      >
        <p>They lose access to this team. Their own sessions are not touched.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === 'transfer'}
        onClose={() => setConfirm(null)}
        title={`Make ${confirm?.member?.name} the owner?`}
        confirmLabel="Hand over"
        onConfirm={() => act(() => api.post(`/teams/${team.id}/transfer`, { userId: confirm.member.id }), 'Ownership handed over.')}
      >
        <p>You will become a regular member and can no longer manage the team.</p>
      </ConfirmDialog>
    </>
  )
}
