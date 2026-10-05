import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { backupTo } from './db.js'

const NAME = /^pulse-\d{8}-\d{6}\.db$/

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
}

/**
 * Scheduled copies of the database into BACKUP_DIR, keeping the newest
 * BACKUP_KEEP. Put that folder on a different disk, or sync it off the
 * machine, for the copies to survive losing the server.
 */
export function createBackups({ db, config, logger }) {
  const { dir, intervalHours, keep } = config.backup
  const enabled = Boolean(dir)

  function list() {
    if (!enabled) return []
    try {
      return readdirSync(dir)
        .filter((f) => NAME.test(f))
        .map((f) => {
          const stat = statSync(join(dir, f))
          return { name: f, bytes: stat.size, createdAt: stat.mtimeMs }
        })
        .sort((a, b) => b.name.localeCompare(a.name))
    } catch {
      return []
    }
  }

  async function run() {
    if (!enabled) throw new Error('Backups are off. Set BACKUP_DIR to turn them on.')
    const path = join(dir, `pulse-${stamp()}.db`)
    await backupTo(db, path)
    for (const old of list().slice(keep)) unlinkSync(join(dir, old.name))
    logger.info({ path }, 'database backup written')
    return list()[0]
  }

  let timer = null
  return {
    enabled,
    list,
    run,
    start() {
      if (!enabled || intervalHours <= 0) return
      timer = setInterval(() => run().catch((err) => logger.error({ err }, 'backup failed')), intervalHours * 3_600_000)
      timer.unref?.()
    },
    stop() {
      clearInterval(timer)
    },
  }
}
