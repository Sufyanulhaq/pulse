import { Router } from 'express'
import { z } from 'zod'
import { badRequest, notFound, parse, route } from '../http.js'
import { sessionPatchSchema, sessionSchema } from '../schemas.js'
import { requireWrite } from '../auth.js'
import { enqueueEvent } from '../webhooks.js'
import { allSessions, getSettings, rowToSession } from '../store.js'
import { transaction } from '../db.js'
import { sessionEvent } from '../../src/lib/webhook.js'
import { SESSION_COLUMNS, toCSV } from '../../src/lib/csv.js'
import { comparePeriods, dailySeries, byTag, byHour, byWeekday, focusScore, hourWeekMatrix, longestStreak, streak, todayMinutes } from '../../src/lib/stats.js'
import { dayKey, startOfDay } from '../../src/lib/format.js'

const SORTS = { start: 'start', minutes: 'minutes', interruptions: 'interruptions', label: 'label' }

const listQuery = z.object({
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(40).optional(),
  completed: z.enum(['true', 'false']).optional(),
  sort: z.enum(Object.keys(SORTS)).default('start'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(20000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export function sessionRoutes({ db }) {
  const r = Router()
  const insert = db.prepare(
    `INSERT OR IGNORE INTO focus_sessions (id, user_id, start, end, minutes, planned, label, tag, interruptions, completed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertOne = (userId, s) =>
    insert.run(s.id, userId, s.start, s.end, s.minutes, s.planned, s.label, s.tag, s.interruptions, s.completed ? 1 : 0, Date.now()).changes

  r.get(
    '/',
    route(async (req, res) => {
      const q = parse(listQuery, req.query)
      const where = ['user_id = ?']
      const args = [req.user.id]
      if (q.from != null) {
        where.push('start >= ?')
        args.push(q.from)
      }
      if (q.to != null) {
        where.push('start < ?')
        args.push(q.to)
      }
      if (q.tag) {
        where.push('tag = ?')
        args.push(q.tag)
      }
      if (q.completed) {
        where.push('completed = ?')
        args.push(q.completed === 'true' ? 1 : 0)
      }
      if (q.q) {
        where.push("(label LIKE ? ESCAPE '\\' OR tag LIKE ? ESCAPE '\\')")
        const like = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
        args.push(like, like)
      }
      const clause = where.join(' AND ')
      const total = db.prepare(`SELECT COUNT(*) AS n FROM focus_sessions WHERE ${clause}`).get(...args).n
      const rows = db
        .prepare(`SELECT * FROM focus_sessions WHERE ${clause} ORDER BY ${SORTS[q.sort]} ${q.order.toUpperCase()}, start DESC LIMIT ? OFFSET ?`)
        .all(...args, q.limit, q.offset)
      res.json({ sessions: rows.map(rowToSession), total, limit: q.limit, offset: q.offset })
    }),
  )

  r.post(
    '/',
    requireWrite,
    route(async (req, res) => {
      const s = parse(sessionSchema, req.body)
      const userId = req.user.id
      const created = transaction(db, () => {
        const settings = getSettings(db, userId)
        const before = todayMinutes(allSessions(db, userId, startOfDay(s.start), startOfDay(s.start) + 86_400_000), s.start)
        if (!insertOne(userId, s)) return false
        enqueueEvent(db, userId, sessionEvent(s))
        const after = before + s.minutes
        if (before < settings.goalMinutes && after >= settings.goalMinutes) {
          const day = dayKey(s.start)
          enqueueEvent(db, userId, {
            type: 'goal.reached',
            id: `evt_goal_${day}`,
            created: Math.floor(Date.now() / 1000),
            data: { date: day, goal_minutes: settings.goalMinutes, focused_minutes: Math.round(after) },
          })
        }
        return true
      })
      // Sending the same id twice is safe: the first copy wins and the answer says so.
      res.status(created ? 201 : 200).json({ session: s, duplicate: !created })
    }),
  )

  r.post(
    '/import',
    requireWrite,
    route(async (req, res) => {
      const body = parse(z.object({ sessions: z.array(z.unknown()).max(5000, 'Import at most 5000 sessions at a time.') }), req.body)
      const errors = []
      const valid = []
      body.sessions.forEach((raw, index) => {
        const result = sessionSchema.safeParse(raw)
        if (result.success) valid.push(result.data)
        else errors.push({ index, message: result.error.issues[0]?.message || 'Not valid.' })
      })
      // Imports do not fire webhooks, so restoring a backup does not flood your endpoints.
      const imported = transaction(db, () => valid.reduce((n, s) => n + insertOne(req.user.id, s), 0))
      res.json({ imported, duplicates: valid.length - imported, invalid: errors.length, errors: errors.slice(0, 20) })
    }),
  )

  r.get(
    '/export.csv',
    route(async (req, res) => {
      const sessions = allSessions(db, req.user.id).reverse()
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="pulse-sessions.csv"')
      res.send(toCSV(sessions, SESSION_COLUMNS))
    }),
  )

  r.patch(
    '/:id',
    requireWrite,
    route(async (req, res) => {
      const patch = parse(sessionPatchSchema, req.body)
      const row = db.prepare('SELECT * FROM focus_sessions WHERE user_id = ? AND id = ?').get(req.user.id, req.params.id)
      if (!row) throw notFound('That session does not exist.')
      const next = { ...row, ...patch }
      db.prepare('UPDATE focus_sessions SET label = ?, tag = ? WHERE user_id = ? AND id = ?').run(next.label, next.tag, req.user.id, row.id)
      res.json({ session: rowToSession(next) })
    }),
  )

  r.delete(
    '/:id',
    requireWrite,
    route(async (req, res) => {
      const row = db.prepare('SELECT * FROM focus_sessions WHERE user_id = ? AND id = ?').get(req.user.id, req.params.id)
      if (!row) throw notFound('That session does not exist.')
      transaction(db, () => {
        db.prepare('DELETE FROM focus_sessions WHERE user_id = ? AND id = ?').run(req.user.id, row.id)
        enqueueEvent(db, req.user.id, {
          type: 'session.deleted',
          id: `evt_del_${row.id}`,
          created: Math.floor(Date.now() / 1000),
          data: { session_id: row.id },
        })
      })
      res.json({ ok: true })
    }),
  )

  r.delete(
    '/',
    requireWrite,
    route(async (req, res) => {
      if (req.query.confirm !== 'delete-all') throw badRequest('Add ?confirm=delete-all to delete every session.')
      const { changes } = db.prepare('DELETE FROM focus_sessions WHERE user_id = ?').run(req.user.id)
      res.json({ deleted: changes })
    }),
  )

  return r
}

export function statsRoutes({ db }) {
  const r = Router()
  r.get(
    '/',
    route(async (req, res) => {
      const { days } = parse(z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90, 365].includes(d), 'Use 7, 30, 90 or 365.').default(30) }), req.query)
      const sessions = allSessions(db, req.user.id)
      const settings = getSettings(db, req.user.id)
      const now = Date.now()
      const { current, previous, currentSessions } = comparePeriods(sessions, days, now)
      res.json({
        days,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        goalMinutes: settings.goalMinutes,
        current: { ...current, score: focusScore(current, settings.goalMinutes, days) },
        previous: { ...previous, score: focusScore(previous, settings.goalMinutes, days) },
        todayMinutes: todayMinutes(sessions, now),
        streak: streak(sessions, now),
        longestStreak: longestStreak(sessions),
        daily: dailySeries(sessions, days, now).map(({ key, minutes, count }) => ({ date: key, minutes, count })),
        byHour: byHour(currentSessions).map((m) => Math.round(m * 10) / 10),
        byWeekday: byWeekday(currentSessions).map((m) => Math.round(m * 10) / 10),
        heatmap: hourWeekMatrix(currentSessions).map((row) => row.map((m) => Math.round(m * 10) / 10)),
        tags: byTag(currentSessions),
      })
    }),
  )
  return r
}
