import { normalizeSettings } from '../src/lib/settings.js'

export function rowToSession(row) {
  return {
    id: row.id,
    start: row.start,
    end: row.end,
    minutes: row.minutes,
    planned: row.planned,
    label: row.label,
    tag: row.tag,
    interruptions: row.interruptions,
    completed: Boolean(row.completed),
  }
}

export function getSettings(db, userId) {
  const row = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(userId)
  return normalizeSettings(row ? JSON.parse(row.data) : {})
}

export function saveSettings(db, userId, settings) {
  const data = JSON.stringify(normalizeSettings(settings))
  db.prepare(
    'INSERT INTO settings (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data',
  ).run(userId, data)
  return JSON.parse(data)
}

export function allSessions(db, userId, from = 0, to = Number.MAX_SAFE_INTEGER) {
  return db
    .prepare('SELECT * FROM focus_sessions WHERE user_id = ? AND start >= ? AND start < ? ORDER BY start')
    .all(userId, from, to)
    .map(rowToSession)
}
