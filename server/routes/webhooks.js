import { Router } from 'express'
import { z } from 'zod'
import { newId, randomToken } from '../crypto.js'
import { badRequest, notFound, parse, route } from '../http.js'
import { WEBHOOK_EVENTS, webhookSchema } from '../schemas.js'
import { checkDestination } from '../webhooks.js'

const MAX_ENDPOINTS = 10

function publicEndpoint(row, stats) {
  return {
    id: row.id,
    url: row.url,
    description: row.description,
    events: JSON.parse(row.events),
    active: Boolean(row.active),
    createdAt: row.created_at,
    secretPreview: `${row.secret.slice(0, 10)}…`,
    stats,
  }
}

function publicDelivery(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lastStatus: row.last_status,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload: JSON.parse(row.payload),
  }
}

export function webhookRoutes({ db, config, worker }) {
  const r = Router()
  const own = (req) => {
    const row = db.prepare('SELECT * FROM webhook_endpoints WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
    if (!row) throw notFound('That webhook does not exist.')
    return row
  }
  const statsFor = (id) => {
    const rows = db.prepare('SELECT status, COUNT(*) AS n FROM webhook_deliveries WHERE endpoint_id = ? GROUP BY status').all(id)
    return Object.fromEntries(rows.map((row) => [row.status, row.n]))
  }

  r.get('/events', (req, res) => res.json({ events: WEBHOOK_EVENTS }))

  r.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM webhook_endpoints WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id)
    res.json({ webhooks: rows.map((row) => publicEndpoint(row, statsFor(row.id))) })
  })

  r.post(
    '/',
    route(async (req, res) => {
      const body = parse(webhookSchema, req.body)
      const count = db.prepare('SELECT COUNT(*) AS n FROM webhook_endpoints WHERE user_id = ?').get(req.user.id).n
      if (count >= MAX_ENDPOINTS) throw badRequest(`You can have up to ${MAX_ENDPOINTS} webhooks.`)
      await checkDestination(body.url, config.webhook)
      const row = {
        id: newId('wh_'),
        user_id: req.user.id,
        url: body.url,
        description: body.description,
        secret: `whsec_${randomToken(24)}`,
        events: JSON.stringify([...new Set(body.events)]),
        active: body.active ? 1 : 0,
        created_at: Date.now(),
      }
      db.prepare(
        'INSERT INTO webhook_endpoints (id, user_id, url, description, secret, events, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(row.id, row.user_id, row.url, row.description, row.secret, row.events, row.active, row.created_at)
      // The full secret is shown once, now.
      res.status(201).json({ webhook: publicEndpoint(row, {}), secret: row.secret })
    }),
  )

  r.patch(
    '/:id',
    route(async (req, res) => {
      const row = own(req)
      const patch = parse(webhookSchema.partial(), req.body)
      if (patch.url) await checkDestination(patch.url, config.webhook)
      const next = {
        url: patch.url ?? row.url,
        description: patch.description ?? row.description,
        events: patch.events ? JSON.stringify([...new Set(patch.events)]) : row.events,
        active: patch.active == null ? row.active : patch.active ? 1 : 0,
      }
      db.prepare('UPDATE webhook_endpoints SET url = ?, description = ?, events = ?, active = ? WHERE id = ?').run(
        next.url,
        next.description,
        next.events,
        next.active,
        row.id,
      )
      res.json({ webhook: publicEndpoint({ ...row, ...next }, statsFor(row.id)) })
    }),
  )

  r.delete('/:id', route(async (req, res) => {
    const row = own(req)
    db.prepare('DELETE FROM webhook_endpoints WHERE id = ?').run(row.id)
    res.json({ ok: true })
  }))

  r.post('/:id/rotate', route(async (req, res) => {
    const row = own(req)
    const secret = `whsec_${randomToken(24)}`
    db.prepare('UPDATE webhook_endpoints SET secret = ? WHERE id = ?').run(secret, row.id)
    res.json({ secret })
  }))

  r.post('/:id/test', route(async (req, res) => {
    const row = own(req)
    const now = Date.now()
    const event = {
      type: 'ping',
      id: newId('evt_ping_'),
      created: Math.floor(now / 1000),
      data: { message: 'This is a test event from Pulse.', webhook_id: row.id },
    }
    const id = newId('del_')
    db.prepare(
      `INSERT INTO webhook_deliveries (id, endpoint_id, user_id, event_id, event_type, payload, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    ).run(id, row.id, req.user.id, event.id, event.type, JSON.stringify(event), now, now, now)
    await worker?.tick()
    res.status(202).json({ delivery: publicDelivery(db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(id)) })
  }))

  r.get('/:id/deliveries', route(async (req, res) => {
    const row = own(req)
    const { limit, status } = parse(
      z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), status: z.enum(['pending', 'delivering', 'succeeded', 'failed']).optional() }),
      req.query,
    )
    const rows = status
      ? db.prepare('SELECT * FROM webhook_deliveries WHERE endpoint_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?').all(row.id, status, limit)
      : db.prepare('SELECT * FROM webhook_deliveries WHERE endpoint_id = ? ORDER BY created_at DESC LIMIT ?').all(row.id, limit)
    res.json({ deliveries: rows.map(publicDelivery) })
  }))

  return r
}

export function deliveryRoutes({ db, worker }) {
  const r = Router()
  r.post('/:id/replay', route(async (req, res) => {
    const row = db.prepare('SELECT * FROM webhook_deliveries WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
    if (!row) throw notFound('That delivery does not exist.')
    if (row.status !== 'failed') throw badRequest('Only a failed delivery can be replayed.')
    // A replay gets a fresh set of attempts.
    db.prepare("UPDATE webhook_deliveries SET status = 'pending', attempts = 0, next_attempt_at = ?, last_error = NULL, updated_at = ? WHERE id = ?").run(
      Date.now(),
      Date.now(),
      row.id,
    )
    await worker?.tick()
    res.json({ delivery: publicDelivery(db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(row.id)) })
  }))
  return r
}
