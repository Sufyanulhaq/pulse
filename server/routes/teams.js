import { Router } from 'express'
import { z } from 'zod'
import { newId, randomToken } from '../crypto.js'
import { badRequest, conflict, forbidden, notFound, parse, route } from '../http.js'
import { teamSchema } from '../schemas.js'
import { transaction } from '../db.js'
import { rowToSession } from '../store.js'
import { byHour, byTag, dailySeries, summarize } from '../../src/lib/stats.js'
import { DAY, startOfDay } from '../../src/lib/format.js'

// Team numbers only appear once this many people have joined,
// so nobody can work out one person's figures by subtraction.
export const MIN_MEMBERS_FOR_STATS = 3
const MAX_MEMBERS = 50

const inviteCode = () => randomToken(9).replace(/[^A-Za-z0-9]/g, 'x').slice(0, 10).toUpperCase()

export function teamRoutes({ db }) {
  const r = Router()

  const membership = (teamId, userId) =>
    db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, userId)
  const loadTeam = (req, { owner = false } = {}) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id)
    const member = team && membership(team.id, req.user.id)
    if (!team || !member) throw notFound('That team does not exist.')
    if (owner && member.role !== 'owner') throw forbidden('Only the team owner can do this.')
    return { team, member }
  }

  r.get('/', (req, res) => {
    const rows = db
      .prepare(
        `SELECT teams.*, team_members.role, (SELECT COUNT(*) FROM team_members m WHERE m.team_id = teams.id) AS members
         FROM team_members JOIN teams ON teams.id = team_members.team_id WHERE team_members.user_id = ? ORDER BY teams.created_at`,
      )
      .all(req.user.id)
    res.json({ teams: rows.map((t) => ({ id: t.id, name: t.name, role: t.role, members: t.members, createdAt: t.created_at })) })
  })

  r.post(
    '/',
    route(async (req, res) => {
      const body = parse(teamSchema, req.body)
      const owned = db.prepare('SELECT COUNT(*) AS n FROM teams WHERE owner_id = ?').get(req.user.id).n
      if (owned >= 5) throw badRequest('You can own up to 5 teams.')
      const team = { id: newId('team_'), name: body.name, invite_code: inviteCode(), owner_id: req.user.id, created_at: Date.now() }
      transaction(db, () => {
        db.prepare('INSERT INTO teams (id, name, invite_code, owner_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
          team.id,
          team.name,
          team.invite_code,
          team.owner_id,
          team.created_at,
        )
        db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(team.id, req.user.id, Date.now())
      })
      res.status(201).json({ team: { id: team.id, name: team.name, role: 'owner', members: 1, inviteCode: team.invite_code } })
    }),
  )

  r.post(
    '/join',
    route(async (req, res) => {
      const { code } = parse(z.object({ code: z.string().trim().toUpperCase().min(4).max(20) }), req.body)
      const team = db.prepare('SELECT * FROM teams WHERE invite_code = ?').get(code)
      if (!team) throw notFound('No team uses that invite code. Check it with the person who sent it.')
      if (membership(team.id, req.user.id)) throw conflict('You are already in this team.')
      const count = db.prepare('SELECT COUNT(*) AS n FROM team_members WHERE team_id = ?').get(team.id).n
      if (count >= MAX_MEMBERS) throw badRequest('This team is full.')
      db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(team.id, req.user.id, Date.now())
      res.status(201).json({ team: { id: team.id, name: team.name, role: 'member' } })
    }),
  )

  r.get(
    '/:id',
    route(async (req, res) => {
      const { team, member } = loadTeam(req)
      const members = db
        .prepare(
          `SELECT users.id, users.name, team_members.role, team_members.joined_at FROM team_members
           JOIN users ON users.id = team_members.user_id WHERE team_members.team_id = ? ORDER BY team_members.joined_at`,
        )
        .all(team.id)
      let stats = null
      if (members.length >= MIN_MEMBERS_FOR_STATS) {
        const days = 30
        const from = startOfDay(Date.now()) - (days - 1) * DAY
        const sessions = db
          .prepare(
            `SELECT focus_sessions.* FROM focus_sessions JOIN team_members ON team_members.user_id = focus_sessions.user_id
             WHERE team_members.team_id = ? AND focus_sessions.start >= ?`,
          )
          .all(team.id, from)
          .map(rowToSession)
        const summary = summarize(sessions)
        const active = new Set(
          db
            .prepare(
              `SELECT DISTINCT focus_sessions.user_id FROM focus_sessions JOIN team_members ON team_members.user_id = focus_sessions.user_id
               WHERE team_members.team_id = ? AND focus_sessions.start >= ?`,
            )
            .all(team.id, from)
            .map((row) => row.user_id),
        ).size
        stats = {
          days,
          minutes: summary.minutes,
          sessions: summary.count,
          activeMembers: active,
          minutesPerMember: members.length ? summary.minutes / members.length : 0,
          completionRate: summary.completionRate,
          interruptionsPerHour: summary.interruptionsPerHour,
          daily: dailySeries(sessions, days).map(({ key, minutes }) => ({ date: key, minutes })),
          byHour: byHour(sessions).map((m) => Math.round(m)),
          tags: byTag(sessions).slice(0, 6).map(({ tag, minutes }) => ({ tag, minutes })),
        }
      }
      res.json({
        team: {
          id: team.id,
          name: team.name,
          role: member.role,
          createdAt: team.created_at,
          inviteCode: member.role === 'owner' ? team.invite_code : null,
        },
        members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, joinedAt: m.joined_at, you: m.id === req.user.id })),
        minMembersForStats: MIN_MEMBERS_FOR_STATS,
        stats,
      })
    }),
  )

  r.patch(
    '/:id',
    route(async (req, res) => {
      const { team } = loadTeam(req, { owner: true })
      const body = parse(teamSchema, req.body)
      db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(body.name, team.id)
      res.json({ ok: true })
    }),
  )

  r.post(
    '/:id/invite',
    route(async (req, res) => {
      const { team } = loadTeam(req, { owner: true })
      const code = inviteCode()
      db.prepare('UPDATE teams SET invite_code = ? WHERE id = ?').run(code, team.id)
      res.json({ inviteCode: code })
    }),
  )

  r.post(
    '/:id/leave',
    route(async (req, res) => {
      const { team, member } = loadTeam(req)
      if (member.role === 'owner') throw badRequest('Owners cannot leave. Hand the team to someone else, or delete it.')
      db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(team.id, req.user.id)
      res.json({ ok: true })
    }),
  )

  r.post(
    '/:id/transfer',
    route(async (req, res) => {
      const { team } = loadTeam(req, { owner: true })
      const { userId } = parse(z.object({ userId: z.string().min(1) }), req.body)
      if (!membership(team.id, userId)) throw notFound('That person is not in this team.')
      if (userId === req.user.id) throw badRequest('You already own this team.')
      transaction(db, () => {
        db.prepare("UPDATE team_members SET role = 'member' WHERE team_id = ? AND user_id = ?").run(team.id, req.user.id)
        db.prepare("UPDATE team_members SET role = 'owner' WHERE team_id = ? AND user_id = ?").run(team.id, userId)
        db.prepare('UPDATE teams SET owner_id = ? WHERE id = ?').run(userId, team.id)
      })
      res.json({ ok: true })
    }),
  )

  r.delete(
    '/:id/members/:userId',
    route(async (req, res) => {
      const { team } = loadTeam(req, { owner: true })
      if (req.params.userId === req.user.id) throw badRequest('You cannot remove yourself. Delete the team instead.')
      const { changes } = db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(team.id, req.params.userId)
      if (!changes) throw notFound('That person is not in this team.')
      res.json({ ok: true })
    }),
  )

  r.delete(
    '/:id',
    route(async (req, res) => {
      const { team } = loadTeam(req, { owner: true })
      db.prepare('DELETE FROM teams WHERE id = ?').run(team.id)
      res.json({ ok: true })
    }),
  )

  return r
}
