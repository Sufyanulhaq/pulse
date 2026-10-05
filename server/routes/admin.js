import { Router } from 'express'
import { route } from '../http.js'
import { DAY, dayKey, startOfDay } from '../../src/lib/format.js'

export function adminRoutes({ db, assistant, backups, mailer }) {
  const r = Router()
  r.get('/overview', (req, res) => {
    const count = (sql, ...args) => db.prepare(sql).get(...args).n
    const since = startOfDay(Date.now()) - 29 * DAY
    const signups = new Map()
    for (let i = 0; i < 30; i++) signups.set(dayKey(since + i * DAY + DAY / 2), 0)
    for (const row of db.prepare('SELECT created_at FROM users WHERE created_at >= ?').all(since)) {
      const key = dayKey(row.created_at)
      if (signups.has(key)) signups.set(key, signups.get(key) + 1)
    }
    const deliveries = Object.fromEntries(
      db.prepare('SELECT status, COUNT(*) AS n FROM webhook_deliveries GROUP BY status').all().map((row) => [row.status, row.n]),
    )
    res.json({
      users: count('SELECT COUNT(*) AS n FROM users'),
      activeUsers7d: count('SELECT COUNT(DISTINCT user_id) AS n FROM focus_sessions WHERE start >= ?', Date.now() - 7 * DAY),
      sessions: count('SELECT COUNT(*) AS n FROM focus_sessions'),
      focusedMinutes: Math.round(db.prepare('SELECT COALESCE(SUM(minutes), 0) AS n FROM focus_sessions').get().n),
      teams: count('SELECT COUNT(*) AS n FROM teams'),
      webhooks: count('SELECT COUNT(*) AS n FROM webhook_endpoints'),
      apiTokens: count('SELECT COUNT(*) AS n FROM api_tokens'),
      assistantQuestions: count('SELECT COUNT(*) AS n FROM assistant_messages'),
      assistantMode: assistant.mode,
      emailProvider: mailer.provider,
      plans: Object.fromEntries(db.prepare("SELECT plan, COUNT(*) AS n FROM users WHERE plan_status IN ('active', 'trialing', 'past_due') GROUP BY plan").all().map((row) => [row.plan, row.n])),
      emailFailures7d: count("SELECT COUNT(*) AS n FROM email_log WHERE status = 'failed' AND created_at >= ?", Date.now() - 7 * DAY),
      backups: { enabled: backups.enabled, latest: backups.list()[0] || null },
      deliveries,
      signups: [...signups.entries()].map(([date, n]) => ({ date, count: n })),
      recentFailures: db
        .prepare("SELECT id, event_type, last_status, last_error, updated_at FROM webhook_deliveries WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 10")
        .all(),
    })
  })
  r.get('/backups', (req, res) => res.json({ enabled: backups.enabled, backups: backups.list() }))
  r.post(
    '/backups',
    route(async (req, res) => {
      if (!backups.enabled) return res.status(400).json({ error: { code: 'backups_off', message: 'Backups are off. Set BACKUP_DIR to turn them on.' } })
      res.status(201).json({ backup: await backups.run() })
    }),
  )
  return r
}
