/**
 * Make a one off copy of the database while the server keeps running.
 *   node scripts/backup.js [output path]
 * Reads DATABASE_PATH like the server does.
 */
import { join } from 'node:path'
import { openDatabase, backupTo } from '../server/db.js'

const source = process.env.DATABASE_PATH || 'data/pulse.db'
const out = process.argv[2] || join('backups', `pulse-manual-${new Date().toISOString().replace(/[:.]/g, '')}.db`)
const db = openDatabase(source)
await backupTo(db, out)
db.close()
console.log(`Backed up ${source} to ${out}`)
