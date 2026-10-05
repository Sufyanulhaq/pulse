import express from 'express'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { authenticate, requireAdmin, requireCsrfHeader, requireSession, requireUser } from './auth.js'
import { errorHandler, notFound, rateLimit, securityHeaders } from './http.js'
import { accountRoutes } from './routes/account.js'
import { adminRoutes } from './routes/admin.js'
import { assistantRoutes } from './routes/assistant.js'
import { authRoutes } from './routes/auth.js'
import { sessionRoutes, statsRoutes } from './routes/sessions.js'
import { settingsRoutes } from './routes/settings.js'
import { teamRoutes } from './routes/teams.js'
import { tokenRoutes } from './routes/tokens.js'
import { billingRoutes, stripeWebhook } from './routes/billing.js'
import { deliveryRoutes, webhookRoutes } from './routes/webhooks.js'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

export function createApp({ db, config, logger, assistant, worker, mailer, stripe = null, backups }) {
  const app = express()
  app.disable('x-powered-by')
  if (config.trustProxy) app.set('trust proxy', 1)

  app.use(securityHeaders(config))
  // Stripe signs the exact bytes it sends, so this route reads the raw body before JSON parsing.
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhook({ db, config, stripe, logger }))
  app.use('/api', express.json({ limit: '2mb' }))
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', rateLimit({ windowMs: 60_000, max: 600 }))
  app.use('/api', authenticate(db, config))
  app.use('/api', requireCsrfHeader)

  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get()
    res.json({ ok: true, assistant: assistant.mode, billing: Boolean(config.stripe.secretKey), email: mailer.provider, time: new Date().toISOString() })
  })

  const deps = { db, config, logger, assistant, worker, mailer, stripe, backups }
  app.use('/api/auth', authRoutes(deps))
  app.use('/api/account', requireSession, accountRoutes(deps))
  app.use('/api/sessions', requireUser, sessionRoutes(deps))
  app.use('/api/stats', requireUser, statsRoutes(deps))
  app.use('/api/settings', requireUser, settingsRoutes(deps))
  app.use('/api/webhooks', requireSession, webhookRoutes(deps))
  app.use('/api/deliveries', requireSession, deliveryRoutes(deps))
  app.use('/api/tokens', requireSession, tokenRoutes(deps))
  app.use('/api/teams', requireSession, teamRoutes(deps))
  app.use('/api/assistant', requireSession, assistantRoutes(deps))
  app.use('/api/billing', requireSession, billingRoutes(deps))
  app.use('/api/admin', requireAdmin(config), adminRoutes(deps))
  app.use('/api', (req, res, next) => next(notFound('No such API route.')))

  // In production the same server hands out the built front end.
  const dist = join(root, 'dist')
  if (config.serveClient && existsSync(dist)) {
    app.use(
      '/assets',
      express.static(join(dist, 'assets'), { immutable: true, maxAge: '1y', index: false }),
    )
    app.use(express.static(dist, { index: false, maxAge: '1h' }))
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(join(dist, 'index.html'))
    })
  }

  app.use(errorHandler(logger))
  return app
}
