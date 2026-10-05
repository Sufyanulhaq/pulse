import { createApp } from './app.js'
import { createAssistant } from './assistant.js'
import { loadConfig } from './config.js'
import { openDatabase } from './db.js'
import { logger } from './http.js'
import { createWorker } from './webhooks.js'

const config = loadConfig()
const db = openDatabase(config.databasePath)
const assistant = createAssistant(config, logger)
const worker = createWorker({ db, config, logger })
const app = createApp({ db, config, logger, assistant, worker })

// Clear out expired logins once an hour.
setInterval(() => db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(Date.now()), 3_600_000).unref()

worker.start()
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, assistant: assistant.mode, database: config.databasePath }, 'pulse server started')
})

function shutdown(signal) {
  logger.info({ signal }, 'shutting down')
  worker.stop()
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
