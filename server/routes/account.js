import { Router } from 'express'
import { z } from 'zod'
import { checkPassword, protectPassword } from '../crypto.js'
import { parse, route, unauthorized } from '../http.js'
import { password } from '../schemas.js'
import { clearSessionCookie, publicUser } from '../auth.js'
import { allSessions, getSettings } from '../store.js'

export function accountRoutes({ db, config }) {
  const r = Router()

  r.patch(
    '/',
    route(async (req, res) => {
      const body = parse(z.object({ name: z.string().trim().min(1).max(80) }), req.body)
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.name, req.user.id)
      res.json({ user: publicUser({ ...req.user, name: body.name }, config) })
    }),
  )

  r.post(
    '/password',
    route(async (req, res) => {
      const body = parse(z.object({ current: z.string().min(1).max(200), next: password }), req.body)
      if (!(await checkPassword(body.current, req.user.password))) throw unauthorized('Your current password is not right.')
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(await protectPassword(body.next), req.user.id)
      // Log out every other device.
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.auth.loginId)
      res.json({ ok: true })
    }),
  )

  r.get('/logins', (req, res) => {
    const rows = db
      .prepare('SELECT id, created_at, expires_at, user_agent FROM auth_sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC')
      .all(req.user.id, Date.now())
    res.json({ logins: rows.map((row) => ({ ...row, current: row.id === req.auth.loginId })) })
  })

  r.delete('/logins/:id', (req, res) => {
    db.prepare('DELETE FROM auth_sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    res.json({ ok: true })
  })

  r.get('/export', (req, res) => {
    const data = {
      exportedAt: new Date().toISOString(),
      user: publicUser(req.user, config),
      settings: getSettings(db, req.user.id),
      sessions: allSessions(db, req.user.id),
      webhooks: db.prepare('SELECT id, url, description, events, active, created_at FROM webhook_endpoints WHERE user_id = ?').all(req.user.id),
      teams: db
        .prepare('SELECT teams.id, teams.name, team_members.role FROM team_members JOIN teams ON teams.id = team_members.team_id WHERE team_members.user_id = ?')
        .all(req.user.id),
    }
    res.setHeader('Content-Disposition', 'attachment; filename="pulse-export.json"')
    res.json(data)
  })

  r.delete(
    '/',
    route(async (req, res) => {
      const body = parse(z.object({ password: z.string().min(1).max(200) }), req.body)
      if (!(await checkPassword(body.password, req.user.password))) throw unauthorized('That password is not right.')
      // Teams this user owns go with them; cascades remove everything else.
      db.prepare('DELETE FROM teams WHERE owner_id = ?').run(req.user.id)
      db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id)
      clearSessionCookie(res, config)
      res.json({ ok: true })
    }),
  )

  return r
}
