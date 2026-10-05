import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, signup, startServer } from './helpers.js'

let srv
beforeAll(async () => (srv = await startServer()))
afterAll(() => srv.close())

const last = (to, template) => [...srv.mailer.outbox].reverse().find((m) => m.to === to && m.template === template)
const tokenFrom = (mail) => new URL(mail.data.url).searchParams.get('token')

describe('email verification', () => {
  it('sends a link on sign up that confirms the address once', async () => {
    const c = await signup(srv.url, 'Vera')
    expect((await c.get('/api/auth/me')).data.user.emailVerified).toBe(false)
    const mail = last('vera@example.com', 'verify')
    expect(mail.subject).toMatch(/Confirm your email/)
    expect(mail.data.url).toMatch(/^https:\/\/pulse\.test\/verify\?token=/)
    expect(mail.html).toContain('Confirm email')
    const anon = client(srv.url)
    expect((await anon.post('/api/auth/verify', { token: tokenFrom(mail) })).status).toBe(200)
    expect((await c.get('/api/auth/me')).data.user.emailVerified).toBe(true)
    expect((await anon.post('/api/auth/verify', { token: tokenFrom(mail) })).status).toBe(400)
  })

  it('resends, and only the newest link works', async () => {
    const c = await signup(srv.url, 'Resa')
    const first = tokenFrom(last('resa@example.com', 'verify'))
    expect((await c.post('/api/account/verify/resend')).status).toBe(200)
    const second = tokenFrom(last('resa@example.com', 'verify'))
    expect(second).not.toBe(first)
    expect((await c.post('/api/auth/verify', { token: first })).status).toBe(400)
    expect((await c.post('/api/auth/verify', { token: second })).status).toBe(200)
  })

  it('rejects expired links', async () => {
    const c = await signup(srv.url, 'Old')
    const token = tokenFrom(last('old@example.com', 'verify'))
    srv.db.prepare("UPDATE email_tokens SET expires_at = 1 WHERE kind = 'verify'").run()
    expect((await c.post('/api/auth/verify', { token })).status).toBe(400)
  })
})

describe('password reset', () => {
  it('answers the same for known and unknown emails', async () => {
    await signup(srv.url, 'Pat')
    const anon = client(srv.url)
    const known = await anon.post('/api/auth/forgot', { email: 'pat@example.com' })
    const unknown = await anon.post('/api/auth/forgot', { email: 'nobody@example.com' })
    expect(known.status).toBe(200)
    expect(unknown.data).toEqual(known.data)
    expect(last('nobody@example.com', 'reset')).toBeUndefined()
  })

  it('resets the password once, logs out every device and confirms by email', async () => {
    const c = await signup(srv.url, 'Riley')
    const anon = client(srv.url)
    await anon.post('/api/auth/forgot', { email: 'riley@example.com' })
    const token = tokenFrom(last('riley@example.com', 'reset'))
    expect((await anon.post('/api/auth/reset', { token, password: 'short' })).status).toBe(400)
    expect((await anon.post('/api/auth/reset', { token, password: 'a brand new password' })).status).toBe(200)
    expect((await anon.post('/api/auth/reset', { token, password: 'another new password' })).status).toBe(400)
    expect((await c.get('/api/settings')).status).toBe(401)
    expect(last('riley@example.com', 'passwordChanged')).toBeDefined()
    expect((await anon.post('/api/auth/login', { email: 'riley@example.com', password: 'a brand new password' })).status).toBe(200)
  })

  it('clears a login lockout', async () => {
    await signup(srv.url, 'Locked')
    const anon = client(srv.url)
    for (let i = 0; i < 5; i++) await anon.post('/api/auth/login', { email: 'locked@example.com', password: 'wrong password' })
    await anon.post('/api/auth/forgot', { email: 'locked@example.com' })
    await anon.post('/api/auth/reset', { token: tokenFrom(last('locked@example.com', 'reset')), password: 'a fresh password' })
    expect((await anon.post('/api/auth/login', { email: 'locked@example.com', password: 'a fresh password' })).status).toBe(200)
  })

  it('emails on a password change from settings', async () => {
    const c = await signup(srv.url, 'Chang')
    await c.post('/api/account/password', { current: 'correct horse battery', next: 'something else entirely' })
    expect(last('chang@example.com', 'passwordChanged')).toBeDefined()
  })
})

describe('team invites by email', () => {
  it('needs a confirmed email, and sends the join link', async () => {
    const owner = await signup(srv.url, 'Owen')
    const { data } = await owner.post('/api/teams', { name: 'Growth' })
    const res = await owner.post(`/api/teams/${data.team.id}/invites`, { emails: ['a@example.com'] })
    expect(res.status).toBe(403)
    await owner.post('/api/auth/verify', { token: tokenFrom(last('owen@example.com', 'verify')) })
    const ok = await owner.post(`/api/teams/${data.team.id}/invites`, { emails: ['a@example.com', 'b@example.com', 'a@example.com'] })
    expect(ok.data.results).toHaveLength(2)
    const mail = last('b@example.com', 'invite')
    expect(mail.subject).toBe('Owen invited you to Growth on Pulse')
    expect(mail.data.url).toBe(`https://pulse.test/app/teams?join=${data.team.inviteCode}`)
    expect((await owner.post(`/api/teams/${data.team.id}/invites`, { emails: ['not an email'] })).status).toBe(400)
  })

  it('escapes names in the email html', async () => {
    const owner = await signup(srv.url, '<b>Mal</b>', 'mal@example.com')
    await owner.post('/api/auth/verify', { token: tokenFrom(last('mal@example.com', 'verify')) })
    const { data } = await owner.post('/api/teams', { name: '<script>x</script>' })
    await owner.post(`/api/teams/${data.team.id}/invites`, { emails: ['c@example.com'] })
    const mail = last('c@example.com', 'invite')
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('logs every email it sends', () => {
    const n = srv.db.prepare("SELECT COUNT(*) AS n FROM email_log WHERE status = 'sent'").get().n
    expect(n).toBeGreaterThan(5)
  })
})
