import { Router } from 'express'
import { checkPassword, DUMMY_PASSWORD, newId, protectPassword } from '../crypto.js'
import { HttpError, badRequest, conflict, parse, rateLimit, route, unauthorized } from '../http.js'
import { loginSchema, signupSchema } from '../schemas.js'
import { clearSessionCookie, createLogin, publicUser, setSessionCookie } from '../auth.js'
import { saveSettings } from '../store.js'
import { DEFAULT_SETTINGS } from '../../src/lib/settings.js'
import { consumeToken, issueToken } from '../emailTokens.js'
import { email as emailSchema, password as passwordSchema } from '../schemas.js'
import { z } from 'zod'

const LOCK_AFTER = 5
const LOCK_MS = 15 * 60_000

export async function sendVerification(db, config, mailer, user) {
  const token = issueToken(db, user.id, 'verify')
  return mailer.send(user.email, 'verify', { name: user.name, url: `${config.appUrl}/verify?token=${token}` })
}

export function authRoutes({ db, config, mailer }) {
  const r = Router()
  const limiter = rateLimit({ windowMs: 60_000, max: config.authRateLimit, message: 'Too many attempts. Wait a minute and try again.' })

  r.post(
    '/signup',
    limiter,
    route(async (req, res) => {
      const body = parse(signupSchema, req.body)
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email)) {
        throw conflict('An account with that email already exists. Log in instead.')
      }
      const user = { id: newId('usr_'), email: body.email, name: body.name, created_at: Date.now() }
      const stored = await protectPassword(body.password)
      db.prepare('INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)').run(
        user.id,
        user.email,
        user.name,
        stored,
        user.created_at,
      )
      saveSettings(db, user.id, DEFAULT_SETTINGS)
      setSessionCookie(res, config, createLogin(db, config, user.id, req.get('user-agent')))
      await sendVerification(db, config, mailer, user)
      res.status(201).json({ user: publicUser({ ...user, plan: 'free' }, config) })
    }),
  )

  r.post(
    '/login',
    limiter,
    route(async (req, res) => {
      const body = parse(loginSchema, req.body)
      const attempt = db.prepare('SELECT * FROM login_attempts WHERE email = ?').get(body.email)
      if (attempt?.locked_until && attempt.locked_until > Date.now()) {
        const minutes = Math.ceil((attempt.locked_until - Date.now()) / 60_000)
        throw new HttpError(429, 'locked', `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`)
      }
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email)
      // Same work for an unknown email, so timing does not reveal which emails exist.
      const ok = await checkPassword(body.password, user ? user.password : DUMMY_PASSWORD)
      if (!user || !ok) {
        const failures = (attempt?.failures || 0) + 1
        db.prepare(
          `INSERT INTO login_attempts (email, failures, locked_until) VALUES (?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until`,
        ).run(body.email, failures >= LOCK_AFTER ? 0 : failures, failures >= LOCK_AFTER ? Date.now() + LOCK_MS : null)
        throw unauthorized('That email and password do not match.')
      }
      db.prepare('DELETE FROM login_attempts WHERE email = ?').run(body.email)
      setSessionCookie(res, config, createLogin(db, config, user.id, req.get('user-agent')))
      res.json({ user: publicUser(user, config) })
    }),
  )

  r.post(
    '/verify',
    limiter,
    route(async (req, res) => {
      const { token } = parse(z.object({ token: z.string().min(1).max(200) }), req.body)
      const row = consumeToken(db, 'verify', token)
      if (!row) throw badRequest('That link has expired or was already used. Log in and send a new one from Settings.')
      db.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').run(Date.now(), row.user_id)
      res.json({ ok: true })
    }),
  )

  // Always the same answer, so the form cannot be used to find out who has an account.
  r.post(
    '/forgot',
    limiter,
    route(async (req, res) => {
      const { email } = parse(z.object({ email: emailSchema }), req.body)
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      if (user) {
        const token = issueToken(db, user.id, 'reset')
        await mailer.send(user.email, 'reset', { name: user.name, url: `${config.appUrl}/reset?token=${token}` })
      }
      res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' })
    }),
  )

  r.post(
    '/reset',
    limiter,
    route(async (req, res) => {
      const body = parse(z.object({ token: z.string().min(1).max(200), password: passwordSchema }), req.body)
      const row = consumeToken(db, 'reset', body.token)
      if (!row) throw badRequest('That reset link has expired or was already used. Ask for a new one.')
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)
      db.prepare('UPDATE users SET password = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').run(
        await protectPassword(body.password),
        Date.now(),
        user.id,
      )
      // A reset ends every login and clears any lockout.
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(user.id)
      db.prepare('DELETE FROM login_attempts WHERE email = ?').run(user.email)
      await mailer.send(user.email, 'passwordChanged', { name: user.name })
      res.json({ ok: true })
    }),
  )

  r.post('/logout', (req, res) => {
    if (req.auth?.kind === 'session') db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(req.auth.loginId)
    clearSessionCookie(res, config)
    res.json({ ok: true })
  })

  r.get('/me', (req, res) => {
    res.json({ user: req.user ? publicUser(req.user, config) : null })
  })

  return r
}
