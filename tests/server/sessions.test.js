import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, makeSession, signup, startServer } from './helpers.js'

let srv
beforeAll(async () => (srv = await startServer()))
afterAll(() => srv.close())

describe('sessions', () => {
  it('needs a login', async () => {
    expect((await client(srv.url).get('/api/sessions')).status).toBe(401)
  })

  it('creates, lists, edits and deletes sessions', async () => {
    const c = await signup(srv.url, 'Sam')
    const s = makeSession()
    expect((await c.post('/api/sessions', s)).status).toBe(201)
    const again = await c.post('/api/sessions', s)
    expect(again.status).toBe(200)
    expect(again.data.duplicate).toBe(true)
    const list = await c.get('/api/sessions')
    expect(list.data.total).toBe(1)
    expect(list.data.sessions[0]).toEqual(s)
    const edited = await c.patch(`/api/sessions/${s.id}`, { label: 'Renamed', tag: 'Writing' })
    expect(edited.data.session.label).toBe('Renamed')
    expect((await c.patch(`/api/sessions/${s.id}`, { minutes: 999 })).status).toBe(400)
    expect((await c.del(`/api/sessions/${s.id}`)).status).toBe(200)
    expect((await c.del(`/api/sessions/${s.id}`)).status).toBe(404)
  })

  it('validates sessions', async () => {
    const c = await signup(srv.url, 'Val')
    const bad = await c.post('/api/sessions', makeSession({ end: 0 }))
    expect(bad.status).toBe(400)
    expect(bad.data.error.details.end).toBeDefined()
    expect((await c.post('/api/sessions', makeSession({ minutes: 2000 }))).status).toBe(400)
    const s = makeSession()
    expect((await c.post('/api/sessions', { ...s, minutes: 60 })).status).toBe(400)
    expect((await c.post('/api/sessions', makeSession({ start: Date.now() + 3_600_000, end: Date.now() + 7_200_000 }))).status).toBe(400)
    expect((await c.post('/api/sessions', makeSession({ id: 'bad id!' }))).status).toBe(400)
  })

  it('keeps each user’s sessions private', async () => {
    const a = await signup(srv.url, 'Alice')
    const b = await signup(srv.url, 'Bob')
    const s = makeSession()
    await a.post('/api/sessions', s)
    expect((await b.get('/api/sessions')).data.total).toBe(0)
    expect((await b.patch(`/api/sessions/${s.id}`, { label: 'x' })).status).toBe(404)
    expect((await b.del(`/api/sessions/${s.id}`)).status).toBe(404)
    // The same id may exist for two different people.
    expect((await b.post('/api/sessions', s)).status).toBe(201)
  })

  it('filters, searches, sorts and pages', async () => {
    const c = await signup(srv.url, 'Finder')
    await c.post('/api/sessions/import', {
      sessions: [
        makeSession({ label: 'Alpha report', tag: 'Writing', minutes: 10 }),
        makeSession({ label: 'Beta 100%_done', tag: 'Study', minutes: 20, completed: false }),
        makeSession({ label: 'Gamma', tag: 'Writing', minutes: 15 }),
      ],
    })
    expect((await c.get('/api/sessions?tag=Writing')).data.total).toBe(2)
    expect((await c.get('/api/sessions?q=alpha')).data.total).toBe(1)
    // % and _ are searched literally.
    expect((await c.get('/api/sessions?q=100%25_')).data.total).toBe(1)
    expect((await c.get('/api/sessions?completed=false')).data.total).toBe(1)
    const sorted = await c.get('/api/sessions?sort=minutes&order=asc&limit=2')
    expect(sorted.data.sessions.map((s) => s.minutes)).toEqual([10, 15])
    expect((await c.get('/api/sessions?sort=password')).status).toBe(400)
  })

  it('imports in bulk, skipping duplicates and reporting invalid rows', async () => {
    const c = await signup(srv.url, 'Importer')
    const good = makeSession()
    const res = await c.post('/api/sessions/import', { sessions: [good, good, { id: 'x' }, makeSession()] })
    expect(res.data).toMatchObject({ imported: 2, duplicates: 1, invalid: 1 })
    expect(res.data.errors[0].index).toBe(2)
  })

  it('exports CSV with formulas neutralised', async () => {
    const c = await signup(srv.url, 'Csv')
    await c.post('/api/sessions', makeSession({ label: '=HYPERLINK("x")' }))
    const res = await c.get('/api/sessions/export.csv')
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.data).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('deletes everything only with explicit confirmation', async () => {
    const c = await signup(srv.url, 'Wiper')
    await c.post('/api/sessions', makeSession())
    expect((await c.del('/api/sessions')).status).toBe(400)
    expect((await c.del('/api/sessions?confirm=delete-all')).data.deleted).toBe(1)
  })

  it('returns stats built from the same functions as the app', async () => {
    const c = await signup(srv.url, 'Stat')
    await c.post('/api/sessions', makeSession({ minutes: 25, interruptions: 0 }))
    const res = await c.get('/api/stats?days=7')
    expect(res.data.current.minutes).toBe(25)
    expect(res.data.daily).toHaveLength(7)
    expect(res.data.heatmap).toHaveLength(7)
    expect(res.data.current.score).toBeGreaterThan(0)
    expect((await c.get('/api/stats?days=8')).status).toBe(400)
  })

  it('saves settings and rejects values out of range', async () => {
    const c = await signup(srv.url, 'Setter')
    expect((await c.get('/api/settings')).data.settings.focusMinutes).toBe(25)
    const saved = await c.put('/api/settings', { focusMinutes: 50, tags: ['Client A', 'Client B'] })
    expect(saved.data.settings).toMatchObject({ focusMinutes: 50, tags: ['Client A', 'Client B'], goalMinutes: 120 })
    expect((await c.put('/api/settings', { focusMinutes: 0 })).status).toBe(400)
  })
})

describe('API tokens', () => {
  it('lets scripts read with a token, and only write with a write token', async () => {
    const c = await signup(srv.url, 'Dev')
    const read = await c.post('/api/tokens', { name: 'Dashboard', scope: 'read' })
    expect(read.status).toBe(201)
    expect(read.data.token).toMatch(/^pulse_/)
    const auth = (t) => ({ Authorization: `Bearer ${t}`, 'X-Requested-With': '' })
    const anon = client(srv.url)
    expect((await anon.get('/api/sessions', auth(read.data.token))).status).toBe(200)
    expect((await anon.post('/api/sessions', makeSession(), auth(read.data.token))).status).toBe(403)
    const write = await c.post('/api/tokens', { name: 'Logger', scope: 'write' })
    expect((await anon.post('/api/sessions', makeSession(), auth(write.data.token))).status).toBe(201)
    // Tokens cannot manage the account.
    expect((await anon.get('/api/tokens', auth(write.data.token))).status).toBe(403)
    expect((await anon.get('/api/sessions', auth('pulse_wrong'))).status).toBe(401)
    // Only a digest is stored.
    const stored = srv.db.prepare('SELECT token_digest FROM api_tokens WHERE id = ?').get(read.data.record.id)
    expect(stored.token_digest).not.toBe(read.data.token)
    // Revoking stops it working.
    await c.del(`/api/tokens/${read.data.record.id}`)
    expect((await anon.get('/api/sessions', auth(read.data.token))).status).toBe(401)
    const listed = await c.get('/api/tokens')
    expect(listed.data.tokens).toHaveLength(1)
    expect(listed.data.tokens[0].last_used_at).toBeTruthy()
  })
})
