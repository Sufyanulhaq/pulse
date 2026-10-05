import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const N = 16384
const r = 8
const p = 1
const KEYLEN = 64

export function newId(prefix = '') {
  return prefix + randomBytes(12).toString('base64url')
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

/** Tokens are stored as a SHA 256 digest so a leaked database cannot be replayed. */
export function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

/** Salted scrypt. The cost settings are stored with the result so they can change later. */
export async function protectPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEYLEN, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function checkPassword(password, stored) {
  const parts = String(stored).split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, rr, pp, saltB64, keyB64] = parts
  const expected = Buffer.from(keyB64, 'base64')
  const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
  })
  return timingSafeEqual(key, expected)
}

// Used when the email is unknown so the response takes the same time as a wrong password.
export const DUMMY_PASSWORD = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')
