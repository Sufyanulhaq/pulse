import './env.js'
import { createApp } from './app.js'
import { createAssistant } from './assistant.js'
import { loadConfig } from './config.js'
import { openDatabase } from './db.js'
import { logger } from './http.js'
import { createWorker } from './webhooks.js'
import { createMailer } from './mailer.js'
import { createBackups } from './backups.js'
import Stripe from 'stripe'

const config = loadConfig()
const db = openDatabase(config.databasePath)
const assistant = createAssistant(config, logger)
const worker = createWorker({ db, config, logger })
const mailer = createMailer({ config, db, logger })
const backups = createBackups({ db, config, logger })
const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null
const app = createApp({ db, config, logger, assistant, worker, mailer, stripe, backups })

if (config.production && config.email.provider === 'log') {
  logger.info({}, 'EMAIL_PROVIDER is log: emails are printed, not sent. Set RESEND_API_KEY to send them.')
}

// Clear out expired logins once an hour.
setInterval(() => db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(Date.now()), 3_600_000).unref()

worker.start()
backups.start()
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, assistant: assistant.mode, billing: Boolean(stripe), email: mailer.provider, backups: backups.enabled, database: config.databasePath }, 'pulse server started')
})

function shutdown(signal) {
  logger.info({ signal }, 'shutting down')
  worker.stop()
  backups.stop()
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
