import { Router } from 'express'
import { parse, route } from '../http.js'
import { settingsSchema } from '../schemas.js'
import { requireWrite } from '../auth.js'
import { getSettings, saveSettings } from '../store.js'

export function settingsRoutes({ db }) {
  const r = Router()
  r.get('/', (req, res) => res.json({ settings: getSettings(db, req.user.id) }))
  r.put(
    '/',
    requireWrite,
    route(async (req, res) => {
      const patch = parse(settingsSchema, req.body)
      res.json({ settings: saveSettings(db, req.user.id, { ...getSettings(db, req.user.id), ...patch }) })
    }),
  )
  return r
}
