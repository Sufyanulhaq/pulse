import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { makeSession, signup, startServer } from './helpers.js'

const dir = mkdtempSync(join(tmpdir(), 'pulse-backups-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('backups', () => {
  it('writes a readable copy and keeps only the newest ones', async () => {
    const srv = await startServer({ backup: { dir, intervalHours: 0, keep: 2 } })
    const admin = await signup(srv.url, 'Admin', 'admin@example.com')
    await admin.post('/api/sessions', makeSession({ label: 'Backed up' }))
    const res = await admin.post('/api/admin/backups')
    expect(res.status).toBe(201)
    const copy = new DatabaseSync(join(dir, res.data.backup.name), { readOnly: true })
    expect(copy.prepare("SELECT COUNT(*) AS n FROM focus_sessions WHERE label = 'Backed up'").get().n).toBe(1)
    copy.close()
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 1100))
      await admin.post('/api/admin/backups')
    }
    expect((await admin.get('/api/admin/backups')).data.backups).toHaveLength(2)
    const plain = await signup(srv.url, 'Plain')
    expect((await plain.post('/api/admin/backups')).status).toBe(403)
    await srv.close()
  })

  it('says so when backups are off', async () => {
    const srv = await startServer()
    const admin = await signup(srv.url, 'Admin', 'admin@example.com')
    expect((await admin.post('/api/admin/backups')).status).toBe(400)
    await srv.close()
  })
})
