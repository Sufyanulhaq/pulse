import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyPayload } from '../../src/lib/webhook.js'
import { checkDestination, classify, isPrivateAddress } from '../../server/webhooks.js'
import { makeSession, receiver, signup, startServer, wait } from './helpers.js'

let srv
beforeAll(async () => (srv = await startServer()))
afterAll(() => srv.close())

async function drain(times = 10) {
  for (let i = 0; i < times; i++) {
    await srv.worker.tick()
    await wait(60)
  }
}

describe('webhooks', () => {
  it('delivers a signed session.completed event that verifies', async () => {
    const hook = await receiver([200])
    const c = await signup(srv.url, 'Hooky')
    const created = await c.post('/api/webhooks', { url: hook.url, description: 'Sheet' })
    expect(created.status).toBe(201)
    const secret = created.data.secret
    expect(secret).toMatch(/^whsec_/)
    expect(created.data.webhook.secretPreview).not.toBe(secret)

    const s = makeSession()
    await c.post('/api/sessions', s)
    await drain(2)
    expect(hook.calls).toHaveLength(1)
    const call = hook.calls[0]
    expect(call.headers['x-pulse-event']).toBe('session.completed')
    expect(call.headers['idempotency-key']).toContain(`evt_${s.id}`)
    const result = await verifyPayload({
      secret,
      rawBody: call.body,
      timestamp: call.headers['x-pulse-timestamp'],
      signature: call.headers['x-pulse-signature'],
    })
    expect(result.ok).toBe(true)
    expect(JSON.parse(call.body).data.session_id).toBe(s.id)

    const deliveries = await c.get(`/api/webhooks/${created.data.webhook.id}/deliveries`)
    expect(deliveries.data.deliveries[0]).toMatchObject({ status: 'succeeded', attempts: 1, lastStatus: 200 })
    await hook.close()
  })

  it('retries on 500 and 429, then succeeds', async () => {
    const hook = await receiver([500, { status: 429, headers: { 'Retry-After': '0' } }, 200])
    const c = await signup(srv.url, 'Retry')
    const { data } = await c.post('/api/webhooks', { url: hook.url })
    await c.post('/api/sessions', makeSession())
    await drain(12)
    expect(hook.calls).toHaveLength(3)
    const d = (await c.get(`/api/webhooks/${data.webhook.id}/deliveries`)).data.deliveries[0]
    expect(d).toMatchObject({ status: 'succeeded', attempts: 3 })
    await hook.close()
  })

  it('stops at once on a 4xx refusal and can be replayed', async () => {
    const hook = await receiver([{ status: 422, body: 'unknown tag' }, 200])
    const c = await signup(srv.url, 'Refused')
    const { data } = await c.post('/api/webhooks', { url: hook.url })
    await c.post('/api/sessions', makeSession())
    await drain(4)
    expect(hook.calls).toHaveLength(1)
    let d = (await c.get(`/api/webhooks/${data.webhook.id}/deliveries`)).data.deliveries[0]
    expect(d.status).toBe('failed')
    expect(d.lastError).toContain('unknown tag')
    const replay = await c.post(`/api/deliveries/${d.id}/replay`)
    expect(replay.data.delivery.status).toBe('succeeded')
    expect((await c.post(`/api/deliveries/${d.id}/replay`)).status).toBe(400)
    await hook.close()
  })

  it('gives up after the attempt limit', async () => {
    const hook = await receiver([503])
    const c = await signup(srv.url, 'Down')
    const { data } = await c.post('/api/webhooks', { url: hook.url })
    await c.post('/api/sessions', makeSession())
    await drain(15)
    const d = (await c.get(`/api/webhooks/${data.webhook.id}/deliveries`)).data.deliveries[0]
    expect(d.status).toBe('failed')
    expect(d.attempts).toBe(3)
    expect(d.lastError).toMatch(/Gave up after 3/)
    await hook.close()
  })

  it('does not follow redirects', async () => {
    const hook = await receiver([{ status: 302, headers: { Location: 'http://169.254.169.254/' } }])
    const c = await signup(srv.url, 'Redirect')
    const { data } = await c.post('/api/webhooks', { url: hook.url })
    const test = await c.post(`/api/webhooks/${data.webhook.id}/test`)
    expect(test.data.delivery.status).toBe('failed')
    expect(test.data.delivery.lastError).toMatch(/not followed/)
    await hook.close()
  })

  it('only sends the events an endpoint asked for, and nothing when paused', async () => {
    const hook = await receiver([200])
    const c = await signup(srv.url, 'Picky')
    const { data } = await c.post('/api/webhooks', { url: hook.url, events: ['session.deleted'] })
    const s = makeSession()
    await c.post('/api/sessions', s)
    await drain(2)
    expect(hook.calls).toHaveLength(0)
    await c.del(`/api/sessions/${s.id}`)
    await drain(2)
    expect(hook.calls.map((x) => x.headers['x-pulse-event'])).toEqual(['session.deleted'])
    await c.patch(`/api/webhooks/${data.webhook.id}`, { active: false })
    const s2 = makeSession()
    await c.post('/api/sessions', s2)
    await c.del(`/api/sessions/${s2.id}`)
    await drain(2)
    expect(hook.calls).toHaveLength(1)
    await hook.close()
  })

  it('fires goal.reached once when the daily goal is crossed', async () => {
    const hook = await receiver([200])
    const c = await signup(srv.url, 'Goal')
    await c.put('/api/settings', { goalMinutes: 30 })
    await c.post('/api/webhooks', { url: hook.url, events: ['goal.reached'] })
    const base = Date.now() - 2 * 3_600_000
    const at = (offset, minutes) => makeSession({ start: base + offset, end: base + offset + minutes * 60_000, minutes })
    // Keep all three on the same calendar day as each other.
    const today = new Date()
    if (today.getHours() < 3) return
    await c.post('/api/sessions', at(0, 20))
    await c.post('/api/sessions', at(30 * 60_000, 20))
    await c.post('/api/sessions', at(60 * 60_000, 20))
    await drain(2)
    expect(hook.calls.map((x) => x.headers['x-pulse-event'])).toEqual(['goal.reached'])
    expect(JSON.parse(hook.calls[0].body).data.goal_minutes).toBe(30)
    await hook.close()
  })

  it('rotates secrets, validates input and keeps endpoints private', async () => {
    const c = await signup(srv.url, 'Owner')
    const other = await signup(srv.url, 'Other')
    const { data } = await c.post('/api/webhooks', { url: 'https://example.com/hook' })
    const rotated = await c.post(`/api/webhooks/${data.webhook.id}/rotate`)
    expect(rotated.data.secret).not.toBe(data.secret)
    expect((await other.get(`/api/webhooks/${data.webhook.id}/deliveries`)).status).toBe(404)
    expect((await other.del(`/api/webhooks/${data.webhook.id}`)).status).toBe(404)
    expect((await c.post('/api/webhooks', { url: 'not a url' })).status).toBe(400)
    expect((await c.post('/api/webhooks', { url: 'https://example.com', events: ['nope'] })).status).toBe(400)
  })
})

describe('destination checks', () => {
  const strict = { allowPrivate: false, allowHttp: false }
  it('spots private and internal addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1', '0.0.0.0']) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false)
  })

  it('refuses http, credentials and private hosts in strict mode', async () => {
    await expect(checkDestination('http://example.com', strict)).rejects.toThrow(/https/)
    await expect(checkDestination('https://user:pw@example.com', strict)).rejects.toThrow(/credentials/)
    await expect(checkDestination('https://127.0.0.1/x', strict)).rejects.toThrow(/private/)
    await expect(checkDestination('https://localhost/x', strict)).rejects.toThrow(/private/)
    await expect(checkDestination('https://[::1]/x', strict)).rejects.toThrow(/private/)
    await expect(checkDestination('https://8.8.8.8/x', strict)).resolves.toBeInstanceOf(URL)
  })

  it('classifies responses', () => {
    expect(classify(204)).toBe('succeeded')
    expect(classify(500)).toBe('retry')
    expect(classify(408)).toBe('retry')
    expect(classify(429)).toBe('retry')
    expect(classify(404)).toBe('failed')
    expect(classify(301)).toBe('failed')
  })
})
