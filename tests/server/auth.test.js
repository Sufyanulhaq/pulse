import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, signup, startServer } from './helpers.js'

let srv
beforeAll(async () => (srv = await startServer()))
afterAll(() => srv.close())

describe('accounts', () => {
  it('signs up, sets an HttpOnly cookie and knows who you are', async () => {
    const c = client(srv.url)
    const res = await c.post('/api/auth/signup', { name: 'Grace', email: 'Grace@Example.com', password: 'a long enough password' })
    expect(res.status).toBe(201)
    expect(res.data.user.email).toBe('grace@example.com')
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Lax/)
    const me = await c.get('/api/auth/me')
    expect(me.data.user.name).toBe('Grace')
  })

  it('stores passwords with scrypt, never as text', () => {
    const row = srv.db.prepare("SELECT password FROM users WHERE email = 'grace@example.com'").get()
    expect(row.password.startsWith('scrypt$')).toBe(true)
    expect(row.password).not.toContain('a long enough password')
  })

  it('rejects a duplicate email and weak input with field messages', async () => {
    const c = client(srv.url)
    const dup = await c.post('/api/auth/signup', { name: 'G', email: 'grace@example.com', password: 'another long password' })
    expect(dup.status).toBe(409)
    const bad = await c.post('/api/auth/signup', { name: '', email: 'nope', password: 'short' })
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.data.error.details).sort()).toEqual(['email', 'name', 'password'])
  })

  it('logs in and out', async () => {
    const c = client(srv.url)
    expect((await c.post('/api/auth/login', { email: 'grace@example.com', password: 'wrong password!' })).status).toBe(401)
    expect((await c.post('/api/auth/login', { email: 'grace@example.com', password: 'a long enough password' })).status).toBe(200)
    expect((await c.get('/api/settings')).status).toBe(200)
    await c.post('/api/auth/logout')
    expect((await c.get('/api/settings')).status).toBe(401)
  })

  it('locks an email after 5 failed logins, even for the right password', async () => {
    await signup(srv.url, 'Locky')
    const c = client(srv.url)
    for (let i = 0; i < 5; i++) await c.post('/api/auth/login', { email: 'locky@example.com', password: 'wrong password' })
    const res = await c.post('/api/auth/login', { email: 'locky@example.com', password: 'correct horse battery' })
    expect(res.status).toBe(429)
    expect(res.data.error.code).toBe('locked')
  })

  it('refuses cookie changes without the X-Requested-With header', async () => {
    const c = await signup(srv.url, 'Csrf')
    const res = await fetch(`${srv.url}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: c.cookie },
      body: JSON.stringify({ goalMinutes: 60 }),
    })
    expect(res.status).toBe(403)
  })

  it('changes the password and logs out other devices', async () => {
    const a = await signup(srv.url, 'Mover')
    const b = client(srv.url)
    await b.post('/api/auth/login', { email: 'mover@example.com', password: 'correct horse battery' })
    expect((await a.post('/api/account/password', { current: 'nope', next: 'brand new password' })).status).toBe(401)
    expect((await a.post('/api/account/password', { current: 'correct horse battery', next: 'brand new password' })).status).toBe(200)
    expect((await b.get('/api/settings')).status).toBe(401)
    expect((await a.get('/api/settings')).status).toBe(200)
  })

  it('exports and deletes an account', async () => {
    const c = await signup(srv.url, 'Leaver')
    const exp = await c.get('/api/account/export')
    expect(exp.data.user.email).toBe('leaver@example.com')
    expect((await c.del('/api/account', { password: 'wrong' })).status).toBe(401)
    expect((await c.del('/api/account', { password: 'correct horse battery' })).status).toBe(200)
    expect(srv.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'leaver@example.com'").get().n).toBe(0)
  })

  it('rate limits sign up and log in attempts per address', async () => {
    const limited = await startServer({ authRateLimit: 3 })
    const c = client(limited.url)
    const codes = []
    for (let i = 0; i < 4; i++) codes.push((await c.post('/api/auth/login', { email: 'x@example.com', password: 'whatever' })).status)
    expect(codes).toEqual([401, 401, 401, 429])
    await limited.close()
  })

  it('sends security headers and hides the framework', async () => {
    const res = await fetch(`${srv.url}/api/health`)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(res.headers.get('x-powered-by')).toBeNull()
  })

  it('answers unknown API routes and bad JSON with clear errors', async () => {
    expect((await fetch(`${srv.url}/api/nope`)).status).toBe(404)
    const c = await signup(srv.url, 'Json')
    const res = await fetch(`${srv.url}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: c.cookie, 'X-Requested-With': 'pulse' },
      body: '{bad',
    })
    expect(res.status).toBe(400)
  })
})
