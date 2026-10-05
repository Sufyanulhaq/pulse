import { Router } from 'express'
import { digest, newId, randomToken } from '../crypto.js'
import { badRequest, notFound, parse, route } from '../http.js'
import { tokenSchema } from '../schemas.js'
import { requireFeature } from '../auth.js'

export function tokenRoutes({ db, config }) {
  const r = Router()
  r.get('/', (req, res) => {
    const rows = db
      .prepare('SELECT id, name, prefix, scope, created_at, last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id)
    res.json({ tokens: rows })
  })
  r.post(
    '/',
    requireFeature(config, 'apiTokens'),
    route(async (req, res) => {
      const body = parse(tokenSchema, req.body)
      const count = db.prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE user_id = ?').get(req.user.id).n
      if (count >= 20) throw badRequest('You can have up to 20 API tokens. Revoke one first.')
      const token = `pulse_${randomToken(30)}`
      const row = { id: newId('tok_'), name: body.name, prefix: token.slice(0, 12), scope: body.scope, created_at: Date.now() }
      db.prepare('INSERT INTO api_tokens (id, user_id, name, token_digest, prefix, scope, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        row.id,
        req.user.id,
        row.name,
        digest(token),
        row.prefix,
        row.scope,
        row.created_at,
      )
      // The token itself is shown once and never stored in plain text.
      res.status(201).json({ token, record: { ...row, last_used_at: null } })
    }),
  )
  r.delete('/:id', (req, res, next) => {
    const { changes } = db.prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    if (!changes) return next(notFound('That token does not exist.'))
    res.json({ ok: true })
  })
  return r
}
