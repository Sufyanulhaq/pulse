/**
 * Webhook signing, the same scheme Pulse uses for outgoing events:
 *   X-Pulse-Timestamp: unix seconds
 *   X-Pulse-Signature: hex HMAC-SHA256 of `${timestamp}.${rawBody}` with the shared secret
 * Runs on the Web Crypto API, so it works in browsers and in Node 20+.
 */
const encoder = new TextEncoder()

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function signPayload(secret, rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = await hmacHex(secret, `${timestamp}.${rawBody}`)
  return { timestamp, signature }
}

/** Compare every character, so the time taken does not reveal where they differ. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  let diff = a.length ^ b.length
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

export async function verifyPayload({ secret, rawBody, timestamp, signature, now = Date.now(), tolerance = 300 }) {
  if (!secret) return { ok: false, reason: 'No shared secret set.' }
  if (!timestamp || !signature) return { ok: false, reason: 'Missing timestamp or signature header.' }
  const ts = Number(timestamp)
  if (!Number.isInteger(ts)) return { ok: false, reason: 'Timestamp is not a whole number of seconds.' }
  const age = Math.floor(now / 1000) - ts
  if (Math.abs(age) > tolerance) {
    return { ok: false, reason: `Timestamp is ${Math.abs(age)}s away from now (limit ${tolerance}s). Possible replay.` }
  }
  const expected = await hmacHex(secret, `${ts}.${rawBody}`)
  if (!safeEqual(expected, String(signature).trim().toLowerCase())) {
    return { ok: false, reason: 'Signature does not match. The body or secret is different.' }
  }
  return { ok: true, reason: 'Signature is valid and the timestamp is fresh.' }
}

export function sessionEvent(session) {
  return {
    type: 'session.completed',
    id: `evt_${session.id}`,
    created: Math.floor(session.end / 1000),
    data: {
      session_id: session.id,
      started_at: new Date(session.start).toISOString(),
      ended_at: new Date(session.end).toISOString(),
      focused_minutes: session.minutes,
      planned_minutes: session.planned,
      label: session.label || null,
      tag: session.tag || null,
      interruptions: session.interruptions,
      finished: session.completed,
    },
  }
}
