import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import { readJSON, removeKey, writeJSON } from '../lib/storage.js'
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/settings.js'
import { sampleSessions } from '../lib/sample.js'
import { useAuth } from './AuthContext.jsx'

const DataContext = createContext(null)
const LOCAL_SESSIONS = 'pulse.sessions'
const LOCAL_SETTINGS = 'pulse.settings'
const OUTBOX = 'pulse.outbox'

const byStart = (a, b) => a.start - b.start
const IMPORT_CHUNK = 5000

/**
 * One place for sessions and settings. Logged out, everything lives in this
 * browser. Logged in, the server is the source of truth, and a session that
 * fails to save waits in an outbox until the connection is back.
 */
export function DataProvider({ children }) {
  const { user, status } = useAuth()
  const mode = user ? 'cloud' : 'local'
  const [sessions, setSessions] = useState(() => readJSON(LOCAL_SESSIONS, []).sort(byStart))
  const [settings, setSettings] = useState(() => normalizeSettings(readJSON(LOCAL_SETTINGS, DEFAULT_SETTINGS)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [localCount, setLocalCount] = useState(() => readJSON(LOCAL_SESSIONS, []).filter((s) => !s.sample).length)
  const [outboxCount, setOutboxCount] = useState(() => readJSON(OUTBOX, []).length)
  const flushing = useRef(false)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [list, prefs] = await Promise.all([api.get('/sessions?limit=20000&sort=start&order=asc'), api.get('/settings')])
      const pending = readJSON(OUTBOX, [])
      const ids = new Set(list.sessions.map((s) => s.id))
      setSessions([...list.sessions, ...pending.filter((s) => !ids.has(s.id))].sort(byStart))
      setSettings(normalizeSettings(prefs.settings))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Switch data source when the login changes.
  useEffect(() => {
    if (status === 'loading') return
    if (user) {
      reload()
    } else {
      setSessions(readJSON(LOCAL_SESSIONS, []).sort(byStart))
      setSettings(normalizeSettings(readJSON(LOCAL_SETTINGS, DEFAULT_SETTINGS)))
    }
    setLocalCount(readJSON(LOCAL_SESSIONS, []).filter((s) => !s.sample).length)
  }, [user, status, reload])

  const persistLocal = useCallback((next) => {
    writeJSON(LOCAL_SESSIONS, next)
    setLocalCount(next.filter((s) => !s.sample).length)
  }, [])

  const flushOutbox = useCallback(async () => {
    if (!user || flushing.current) return
    const pending = readJSON(OUTBOX, [])
    if (!pending.length) return
    flushing.current = true
    const left = []
    for (const s of pending) {
      try {
        await api.post('/sessions', s)
      } catch (err) {
        // A 400 will never succeed, so it is dropped rather than retried forever.
        if (err.status === 0 || err.status >= 500 || err.status === 429) left.push(s)
      }
    }
    writeJSON(OUTBOX, left)
    setOutboxCount(left.length)
    flushing.current = false
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    flushOutbox()
    const onOnline = () => flushOutbox()
    window.addEventListener('online', onOnline)
    const timer = setInterval(flushOutbox, 30_000)
    return () => {
      window.removeEventListener('online', onOnline)
      clearInterval(timer)
    }
  }, [user, flushOutbox])

  const addSession = useCallback(
    async (session) => {
      setSessions((list) => [...list, session].sort(byStart))
      if (mode === 'local') {
        persistLocal([...readJSON(LOCAL_SESSIONS, []), session])
        return
      }
      try {
        await api.post('/sessions', session)
      } catch (err) {
        if (err.status === 0 || err.status >= 500 || err.status === 429) {
          const pending = [...readJSON(OUTBOX, []), session]
          writeJSON(OUTBOX, pending)
          setOutboxCount(pending.length)
        } else {
          setSessions((list) => list.filter((s) => s.id !== session.id))
          throw err
        }
      }
    },
    [mode, persistLocal],
  )

  const updateSession = useCallback(
    async (id, patch) => {
      if (mode === 'cloud') await api.patch(`/sessions/${encodeURIComponent(id)}`, patch)
      setSessions((list) => {
        const next = list.map((s) => (s.id === id ? { ...s, ...patch } : s))
        if (mode === 'local') persistLocal(next)
        return next
      })
    },
    [mode, persistLocal],
  )

  const deleteSession = useCallback(
    async (id) => {
      if (mode === 'cloud') await api.del(`/sessions/${encodeURIComponent(id)}`)
      setSessions((list) => {
        const next = list.filter((s) => s.id !== id)
        if (mode === 'local') persistLocal(next)
        return next
      })
    },
    [mode, persistLocal],
  )

  const importSessions = useCallback(
    async (list) => {
      const clean = list.map(({ sample: _sample, ...rest }) => rest)
      if (mode === 'local') {
        const existing = readJSON(LOCAL_SESSIONS, [])
        const ids = new Set(existing.map((s) => s.id))
        const fresh = list.filter((s) => !ids.has(s.id))
        const next = [...existing, ...fresh].sort(byStart)
        persistLocal(next)
        setSessions(next)
        return { imported: fresh.length, duplicates: list.length - fresh.length, invalid: 0 }
      }
      const totals = { imported: 0, duplicates: 0, invalid: 0 }
      for (let i = 0; i < clean.length; i += IMPORT_CHUNK) {
        const res = await api.post('/sessions/import', { sessions: clean.slice(i, i + IMPORT_CHUNK) })
        totals.imported += res.imported
        totals.duplicates += res.duplicates
        totals.invalid += res.invalid
      }
      await reload()
      return totals
    },
    [mode, persistLocal, reload],
  )

  const clearSessions = useCallback(async () => {
    if (mode === 'cloud') await api.del('/sessions?confirm=delete-all')
    else persistLocal([])
    setSessions([])
  }, [mode, persistLocal])

  const loadSample = useCallback(async () => {
    const sample = sampleSessions()
    if (mode === 'local') {
      const own = readJSON(LOCAL_SESSIONS, []).filter((s) => !s.sample)
      const next = [...own, ...sample].sort(byStart)
      persistLocal(next)
      setSessions(next)
      return { imported: sample.length }
    }
    return importSessions(sample)
  }, [mode, persistLocal, importSessions])

  const removeSample = useCallback(async () => {
    if (mode === 'local') {
      const next = readJSON(LOCAL_SESSIONS, []).filter((s) => !s.sample)
      persistLocal(next)
      setSessions(next)
      return
    }
    const ids = sessions.filter((s) => s.id.startsWith('sample-')).map((s) => s.id)
    for (const id of ids) await api.del(`/sessions/${encodeURIComponent(id)}`)
    await reload()
  }, [mode, persistLocal, sessions, reload])

  /** Move sessions recorded before logging in up to the account. */
  const uploadLocal = useCallback(async () => {
    const own = readJSON(LOCAL_SESSIONS, []).filter((s) => !s.sample)
    const result = await importSessions(own)
    removeKey(LOCAL_SESSIONS)
    setLocalCount(0)
    return result
  }, [importSessions])

  const discardLocal = useCallback(() => {
    removeKey(LOCAL_SESSIONS)
    setLocalCount(0)
  }, [])

  const updateSettings = useCallback(
    async (patch) => {
      const next = normalizeSettings({ ...settings, ...patch })
      setSettings(next)
      if (mode === 'cloud') {
        try {
          const res = await api.put('/settings', patch)
          setSettings(normalizeSettings(res.settings))
        } catch (err) {
          setSettings(settings)
          throw err
        }
      } else {
        writeJSON(LOCAL_SETTINGS, next)
      }
      return next
    },
    [mode, settings],
  )

  const hasSample = sessions.some((s) => s.sample || s.id.startsWith('sample-'))

  const value = useMemo(
    () => ({
      mode,
      sessions,
      settings,
      loading,
      error,
      reload,
      addSession,
      updateSession,
      deleteSession,
      importSessions,
      clearSessions,
      loadSample,
      removeSample,
      hasSample,
      updateSettings,
      localCount: mode === 'cloud' ? localCount : 0,
      uploadLocal,
      discardLocal,
      outboxCount,
    }),
    [mode, sessions, settings, loading, error, reload, addSession, updateSession, deleteSession, importSessions, clearSessions, loadSample, removeSample, hasSample, updateSettings, localCount, uploadLocal, discardLocal, outboxCount],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
