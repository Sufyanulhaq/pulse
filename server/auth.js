import { digest, newId, randomToken } from './crypto.js'
import { HttpError, forbidden, unauthorized } from './http.js'
import { FEATURE_MESSAGES, billingSummary, entitlements } from './plans.js'

export const COOKIE = 'pulse_session'
const DAY = 86_400_000

export function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const name = part.slice(0, i).trim()
    if (name) out[name] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function createLogin(db, config, userId, userAgent = '') {
  const token = randomToken()
  const now = Date.now()
  db.prepare(
    'INSERT INTO auth_sessions (id, token_digest, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(newId('as_'), digest(token), userId, now, now + config.sessionDays * DAY, String(userAgent).slice(0, 200))
  return token
}

export function setSessionCookie(res, config, token) {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${config.sessionDays * 86400}`,
  ]
  if (config.production) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearSessionCookie(res, config) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.production ? '; Secure' : ''}`)
}

export function publicUser(user, config) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.created_at,
    emailVerified: Boolean(user.email_verified_at),
    isAdmin: config.adminEmails.includes(user.email),
    billing: billingSummary(user, config),
  }
}

/**
 * Works out who is calling. A browser uses the session cookie; scripts use
 * `Authorization: Bearer pulse_...` with a personal API token.
 */
export function authenticate(db, config) {
  const bySession = db.prepare(
    `SELECT users.*, auth_sessions.id AS login_id FROM auth_sessions
     JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.token_digest = ? AND auth_sessions.expires_at > ?`,
  )
  const byToken = db.prepare(
    `SELECT users.*, api_tokens.id AS token_id, api_tokens.scope AS token_scope FROM api_tokens
     JOIN users ON users.id = api_tokens.user_id WHERE api_tokens.token_digest = ?`,
  )
  const touchToken = db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?')

  return (req, res, next) => {
    req.user = null
    req.auth = null
    const header = req.get('authorization') || ''
    if (header.toLowerCase().startsWith('bearer ')) {
      const row = byToken.get(digest(header.slice(7).trim()))
      if (!row) return next(unauthorized('That API token is not valid.'))
      if (!entitlements(row, config).apiTokens) return next(new HttpError(402, 'plan_required', 'API tokens need the Pro plan. Upgrade in Settings to use this token again.'))
      touchToken.run(Date.now(), row.token_id)
      req.user = row
      req.auth = { kind: 'token', tokenId: row.token_id, scope: row.token_scope }
      return next()
    }
    const token = parseCookies(req.get('cookie'))[COOKIE]
    if (token) {
      const row = bySession.get(digest(token), Date.now())
      if (row) {
        req.user = row
        req.auth = { kind: 'session', loginId: row.login_id }
      }
    }
    next()
  }
}

export function requireUser(req, res, next) {
  if (!req.user) return next(unauthorized())
  next()
}

/** Cookie logins only. Account, token and webhook management are not open to API tokens. */
export function requireSession(req, res, next) {
  if (!req.user) return next(unauthorized())
  if (req.auth.kind !== 'session') return next(forbidden('API tokens cannot do this. Use the web app.'))
  next()
}

/** A token with read scope may only read. */
export function requireWrite(req, res, next) {
  if (req.auth?.kind === 'token' && req.auth.scope !== 'write') {
    return next(forbidden('This API token is read only.'))
  }
  next()
}

/**
 * Cross site request forgery guard for cookie logins: every change must carry
 * a header a form on another site cannot add. SameSite=Lax is the first layer.
 */
export function requireCsrfHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.auth?.kind === 'token') return next()
  if (req.get('x-requested-with') !== 'pulse') return next(forbidden('Missing the X-Requested-With header.'))
  next()
}

/** Stop a request when the account's plan does not include `feature`. */
export function requireFeature(config, feature) {
  return (req, res, next) => {
    if (!entitlements(req.user, config)[feature]) {
      return next(new HttpError(402, 'plan_required', FEATURE_MESSAGES[feature]))
    }
    next()
  }
}

export function requireVerified(req, res, next) {
  if (!req.user?.email_verified_at) return next(forbidden('Confirm your email address first. You can resend the link from Settings.'))
  next()
}

export function requireAdmin(config) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized())
    if (!config.adminEmails.includes(req.user.email)) return next(forbidden())
    next()
  }
}
