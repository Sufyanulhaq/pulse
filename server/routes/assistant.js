import { Router } from 'express'
import { newId } from '../crypto.js'
import { parse, rateLimit, route } from '../http.js'
import { assistantSchema } from '../schemas.js'
import { allSessions, getSettings } from '../store.js'
import { buildFacts } from '../../src/lib/assistant.js'

export function assistantRoutes({ db, assistant }) {
  const r = Router()
  const limiter = rateLimit({ windowMs: 60_000, max: 20, key: (req) => req.user.id, message: 'That is a lot of questions. Wait a minute and ask again.' })

  r.get('/', (req, res) => {
    const rows = db
      .prepare('SELECT * FROM assistant_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(req.user.id)
      .reverse()
    res.json({
      mode: assistant.mode,
      messages: rows.map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        citations: JSON.parse(row.citations),
        answerable: Boolean(row.answerable),
        mode: row.mode,
        createdAt: row.created_at,
      })),
    })
  })

  r.post(
    '/',
    limiter,
    route(async (req, res) => {
      const { question } = parse(assistantSchema, req.body)
      const facts = buildFacts(allSessions(db, req.user.id), getSettings(db, req.user.id))
      const result = await assistant.ask(question, facts)
      const message = {
        id: newId('msg_'),
        question,
        answer: result.answer,
        citations: result.citations,
        answerable: result.answerable,
        mode: result.mode,
        createdAt: Date.now(),
      }
      db.prepare(
        'INSERT INTO assistant_messages (id, user_id, question, answer, citations, answerable, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(message.id, req.user.id, question, message.answer, JSON.stringify(message.citations), message.answerable ? 1 : 0, message.mode, message.createdAt)
      res.json({ message })
    }),
  )

  r.delete('/', (req, res) => {
    db.prepare('DELETE FROM assistant_messages WHERE user_id = ?').run(req.user.id)
    res.json({ ok: true })
  })

  return r
}
