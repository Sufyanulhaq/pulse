const bool = (v, fallback) => (v == null || v === '' ? fallback : ['1', 'true', 'yes'].includes(String(v).toLowerCase()))
const num = (v, fallback) => (v == null || v === '' || Number.isNaN(Number(v)) ? fallback : Number(v))

export function loadConfig(env = process.env, overrides = {}) {
  const production = env.NODE_ENV === 'production'
  return {
    production,
    port: num(env.PORT, 3001),
    databasePath: env.DATABASE_PATH || 'data/pulse.db',
    // Comma separated emails that may open the admin page.
    adminEmails: (env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    sessionDays: num(env.SESSION_DAYS, 30),
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    assistantModel: env.ASSISTANT_MODEL || 'claude-opus-5-5',
    webhook: {
      maxAttempts: num(env.WEBHOOK_MAX_ATTEMPTS, 5),
      baseDelayMs: num(env.WEBHOOK_BASE_DELAY_MS, 10_000),
      timeoutMs: num(env.WEBHOOK_TIMEOUT_MS, 10_000),
      pollMs: num(env.WEBHOOK_POLL_MS, 1000),
      allowPrivate: bool(env.WEBHOOK_ALLOW_PRIVATE, false),
      allowHttp: bool(env.WEBHOOK_ALLOW_HTTP, !production),
    },
    trustProxy: bool(env.TRUST_PROXY, production),
    serveClient: bool(env.SERVE_CLIENT, production),
    ...overrides,
  }
}
