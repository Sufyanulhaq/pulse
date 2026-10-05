import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { signPayload } from '../src/lib/webhook.js'
import { newId } from './crypto.js'
import { badRequest } from './http.js'

/** True for loopback, private, link local, carrier grade NAT and other non public ranges. */
export function isPrivateAddress(address) {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (isIP(ip) === 6) {
    if (ip === '::' || ip === '::1') return true
    if (ip.startsWith('::ffff:')) return isPrivateAddress(ip.slice(7))
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(ip)
  }
  return true
}

/**
 * Refuse URLs that would make the server call itself or an internal network
 * (server side request forgery). Checked when saved and again before each delivery,
 * because DNS can change in between.
 */
export async function checkDestination(rawUrl, { allowPrivate, allowHttp }) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw badRequest('That is not a valid URL.', { url: 'Enter a full URL.' })
  }
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    throw badRequest('Webhook URLs must use https.', { url: 'Use https://' })
  }
  if (url.username || url.password) throw badRequest('Do not put credentials in the URL.', { url: 'Remove the user name and password.' })
  if (allowPrivate) return url
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw badRequest('That address points at a private network.', { url: 'Use a public address.' })
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addresses.length) throw badRequest('That host name could not be found.', { url: 'Check the host name.' })
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw badRequest('That address points at a private network.', { url: 'Use a public address.' })
  }
  return url
}

/** Queue one delivery per active endpoint that listens for this event. */
export function enqueueEvent(db, userId, event) {
  const endpoints = db
    .prepare('SELECT id, events FROM webhook_endpoints WHERE user_id = ? AND active = 1')
    .all(userId)
    .filter((e) => JSON.parse(e.events).includes(event.type))
  const insert = db.prepare(
    `INSERT OR IGNORE INTO webhook_deliveries
     (id, endpoint_id, user_id, event_id, event_type, payload, status, attempts, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
  )
  const now = Date.now()
  for (const endpoint of endpoints) {
    insert.run(newId('del_'), endpoint.id, userId, event.id, event.type, JSON.stringify(event), now, now, now)
  }
  return endpoints.length
}

function retryAfterMs(header) {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.min(3600, Math.max(0, seconds)) * 1000
  const date = Date.parse(header)
  return Number.isFinite(date) ? Math.min(3_600_000, Math.max(0, date - Date.now())) : null
}

/**
 * How a response is treated:
 *   2xx                          done
 *   network error, 408, 429, 5xx retry with doubling delay (Retry-After respected, up to an hour)
 *   any other 4xx                stop; retrying a refusal only repeats it
 *   3xx                          stop; redirects are not followed
 */
export function classify(status) {
  if (status >= 200 && status < 300) return 'succeeded'
  if (status === 408 || status === 429 || status >= 500) return 'retry'
  return 'failed'
}

export function createWorker({ db, config, logger, fetchImpl = fetch }) {
  const due = db.prepare(
    `SELECT webhook_deliveries.*, webhook_endpoints.url, webhook_endpoints.secret
     FROM webhook_deliveries JOIN webhook_endpoints ON webhook_endpoints.id = webhook_deliveries.endpoint_id
     WHERE webhook_deliveries.status = 'pending' AND webhook_deliveries.next_attempt_at <= ?
     ORDER BY webhook_deliveries.next_attempt_at LIMIT 20`,
  )
  const claim = db.prepare(
    "UPDATE webhook_deliveries SET status = 'delivering', updated_at = ? WHERE id = ? AND status = 'pending'",
  )
  const save = db.prepare(
    `UPDATE webhook_deliveries SET status = ?, attempts = ?, next_attempt_at = ?, last_status = ?, last_error = ?, updated_at = ?
     WHERE id = ?`,
  )
  // Anything left 'delivering' by a crash goes back in the queue.
  db.prepare("UPDATE webhook_deliveries SET status = 'pending' WHERE status = 'delivering'").run()

  async function deliver(row) {
    const attempts = row.attempts + 1
    let status = null
    let error = null
    let outcome
    let wait = null
    try {
      await checkDestination(row.url, config.webhook)
      const { timestamp, signature } = await signPayload(row.secret, row.payload)
      const response = await fetchImpl(row.url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(config.webhook.timeoutMs),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Pulse-Webhooks/1.0',
          'X-Pulse-Event': row.event_type,
          'X-Pulse-Timestamp': String(timestamp),
          'X-Pulse-Signature': signature,
          'Idempotency-Key': `${row.event_id}:${row.endpoint_id}`,
        },
        body: row.payload,
      })
      status = response.status
      outcome = classify(status)
      if (outcome === 'failed') {
        const text = (await response.text().catch(() => '')).slice(0, 300)
        error = status >= 300 && status < 400 ? `Redirect to ${response.headers.get('location') || 'another address'} was not followed.` : `Refused with ${status}${text ? `: ${text}` : ''}`
      } else if (outcome === 'retry') {
        error = `Answered ${status}.`
        wait = retryAfterMs(response.headers.get('retry-after'))
      }
      await response.body?.cancel?.().catch(() => {})
    } catch (err) {
      if (err?.status === 400) {
        outcome = 'failed'
        error = err.message
      } else {
        outcome = 'retry'
        error = err?.name === 'TimeoutError' ? `No answer within ${config.webhook.timeoutMs / 1000}s.` : `Network error: ${err?.cause?.code || err?.message || 'unknown'}`
      }
    }
    let next = null
    if (outcome === 'retry') {
      if (attempts >= config.webhook.maxAttempts) {
        outcome = 'failed'
        error = `${error} Gave up after ${attempts} attempts.`
      } else {
        outcome = 'pending'
        next = Date.now() + (wait ?? config.webhook.baseDelayMs * 2 ** (attempts - 1))
      }
    }
    save.run(outcome, attempts, next, status, error, Date.now(), row.id)
    logger.info({ delivery: row.id, outcome, status, attempts }, 'webhook delivery')
    return outcome
  }

  let running = false
  async function tick() {
    if (running) return 0
    running = true
    try {
      const rows = due.all(Date.now()).filter((row) => claim.run(Date.now(), row.id).changes === 1)
      await Promise.all(rows.map(deliver))
      return rows.length
    } finally {
      running = false
    }
  }

  let timer = null
  return {
    tick,
    start() {
      timer = setInterval(() => tick().catch((err) => logger.error({ err }, 'webhook worker')), config.webhook.pollMs)
      timer.unref?.()
    },
    stop() {
      clearInterval(timer)
    },
  }
}
