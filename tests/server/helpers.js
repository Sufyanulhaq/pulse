import { createServer } from 'node:http'
import { createApp } from '../../server/app.js'
import { createAssistant } from '../../server/assistant.js'
import { loadConfig } from '../../server/config.js'
import { openDatabase } from '../../server/db.js'
import { silentLogger } from '../../server/http.js'
import { createWorker } from '../../server/webhooks.js'

export async function startServer(overrides = {}, { assistantClient } = {}) {
  const base = loadConfig({ NODE_ENV: 'test' })
  const config = {
    ...base,
    adminEmails: ['admin@example.com'],
    ...overrides,
    webhook: { ...base.webhook, allowPrivate: true, allowHttp: true, baseDelayMs: 50, maxAttempts: 3, timeoutMs: 2000, ...(overrides.webhook || {}) },
  }
  const db = openDatabase(':memory:')
  const assistant = createAssistant(config, silentLogger, assistantClient)
  const worker = createWorker({ db, config, logger: silentLogger })
  const app = createApp({ db, config, logger: silentLogger, assistant, worker })
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  const url = `http://127.0.0.1:${server.address().port}`
  return { url, db, config, worker, close: () => new Promise((resolve) => server.close(resolve)) }
}

/** A tiny client that keeps the session cookie, like a browser would. */
export function client(url) {
  let cookie = ''
  async function call(method, path, body, headers = {}) {
    const res = await fetch(url + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Requested-With': 'pulse',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0].endsWith('=') ? '' : setCookie.split(';')[0]
    const type = res.headers.get('content-type') || ''
    const data = type.includes('json') ? await res.json() : await res.text()
    return { status: res.status, data, headers: res.headers }
  }
  return {
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b = {}, h) => call('POST', p, b, h),
    put: (p, b, h) => call('PUT', p, b, h),
    patch: (p, b, h) => call('PATCH', p, b, h),
    del: (p, b, h) => call('DELETE', p, b, h),
    get cookie() {
      return cookie
    },
  }
}

export async function signup(url, name = 'Ada', email = `${name.toLowerCase()}@example.com`) {
  const c = client(url)
  const res = await c.post('/api/auth/signup', { name, email, password: 'correct horse battery' })
  if (res.status !== 201) throw new Error(JSON.stringify(res.data))
  return c
}

let counter = 0
export function makeSession(extra = {}) {
  counter += 1
  const start = Date.now() - 3 * 3_600_000 + counter * 1000
  const minutes = extra.minutes ?? 25
  return {
    id: `t${counter}`,
    start,
    end: start + minutes * 60_000,
    minutes,
    planned: 25,
    label: 'Write tests',
    tag: 'Deep work',
    interruptions: 1,
    completed: true,
    ...extra,
  }
}

/** A local HTTP server that records webhook calls and answers as told. */
export async function receiver(responses = [200]) {
  const calls = []
  let i = 0
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      calls.push({ headers: req.headers, body })
      const next = responses[Math.min(i, responses.length - 1)]
      i += 1
      const spec = typeof next === 'number' ? { status: next } : next
      res.writeHead(spec.status, spec.headers || {})
      res.end(spec.body || '')
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${server.address().port}/hook`, calls, close: () => new Promise((r) => server.close(r)) }
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))
