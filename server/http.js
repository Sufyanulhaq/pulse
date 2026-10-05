import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message, details) => new HttpError(400, 'bad_request', message, details)
export const unauthorized = (message = 'Log in to continue.') => new HttpError(401, 'unauthorized', message)
export const forbidden = (message = 'You do not have access to this.') => new HttpError(403, 'forbidden', message)
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message)
export const conflict = (message) => new HttpError(409, 'conflict', message)

/** Wrap an async handler so a thrown error reaches the error middleware. */
export const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/** Parse with a zod schema; a failure becomes a 400 that names each field. */
export function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) {
    const fields = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_'
      if (!fields[key]) fields[key] = issue.message
    }
    throw badRequest('Some fields are not valid.', fields)
  }
  return result.data
}

export function errorHandler(logger) {
  // Express recognises error middleware by its four arguments.
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, _next) => {
    if (error instanceof ZodError) error = badRequest('Some fields are not valid.')
    if (error?.type === 'entity.parse.failed') error = badRequest('The request body is not valid JSON.')
    if (error?.type === 'entity.too.large') error = new HttpError(413, 'too_large', 'The request body is too large.')
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } })
    }
    logger.error({ err: error, path: req.path }, 'unhandled error')
    res.status(500).json({ error: { code: 'internal', message: 'Something went wrong on our side.' } })
  }
}

/**
 * A fixed window rate limiter kept in memory. Good for a single instance;
 * put a shared store behind it before running several.
 */
export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many requests. Try again shortly.' }) {
  const hits = new Map()
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [k, entry] of hits) if (entry.reset <= now) hits.delete(k)
  }, windowMs)
  sweep.unref?.()
  return (req, res, next) => {
    const now = Date.now()
    const k = key(req)
    let entry = hits.get(k)
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs }
      hits.set(k, entry)
    }
    entry.count += 1
    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)))
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)))
      return next(new HttpError(429, 'rate_limited', message))
    }
    next()
  }
}

export function securityHeaders({ production }) {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    )
    next()
  }
}

export const logger = {
  info: (data, msg) => console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), msg, ...data })),
  error: (data, msg) =>
    console.error(
      JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        msg,
        ...data,
        err: data?.err ? { message: data.err.message, stack: data.err.stack } : undefined,
      }),
    ),
}

export const silentLogger = { info: () => {}, error: () => {} }
