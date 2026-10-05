import { Router } from 'express'
import { checkPassword, DUMMY_PASSWORD, newId, protectPassword } from '../crypto.js'
import { HttpError, conflict, parse, rateLimit, route, unauthorized } from '../http.js'
import { loginSchema, signupSchema } from '../schemas.js'
import { clearSessionCookie, createLogin, publicUser, setSessionCookie } from '../auth.js'
import { saveSettings } from '../store.js'
import { DEFAULT_SETTINGS } from '../../src/lib/settings.js'

const LOCK_AFTER = 5
const LOCK_MS = 15 * 60_000

export function authRoutes({ db, config }) {
  const r = Router()
  const limiter = rateLimit({ windowMs: 60_000, max: 20, message: 'Too many attempts. Wait a minute and try again.' })

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
      res.status(201).json({ user: publicUser(user, config) })
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
