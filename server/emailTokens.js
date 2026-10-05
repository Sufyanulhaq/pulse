import { digest, newId, randomToken } from './crypto.js'

export const TTL = {
  verify: 24 * 3_600_000,
  reset: 3_600_000,
}

/** Make a single use token. Older unused tokens of the same kind stop working. */
export function issueToken(db, userId, kind, ttl = TTL[kind], data = null) {
  const token = randomToken(32)
  const now = Date.now()
  db.prepare('UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL').run(now, userId, kind)
  db.prepare('INSERT INTO email_tokens (id, user_id, kind, token_digest, data, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    newId('et_'),
    userId,
    kind,
    digest(token),
    data ? JSON.stringify(data) : null,
    now + ttl,
    now,
  )
  return token
}

/** Use a token once. Returns the row, or null when it is unknown, used or expired. */
export function consumeToken(db, kind, token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null
  const row = db.prepare('SELECT * FROM email_tokens WHERE token_digest = ? AND kind = ?').get(digest(token), kind)
  if (!row || row.used_at || row.expires_at < Date.now()) return null
  const { changes } = db.prepare('UPDATE email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').run(Date.now(), row.id)
  return changes ? row : null
}
