import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { readJSON, writeJSON } from '../lib/storage.js'
import { asset } from '../env.js'
import { applySettings, finish, initialTimer, interrupt, isDue, PHASES, remainingMs, setPhase, skipBreak, stop, toggle } from '../lib/timer.js'
import { chime } from '../lib/sound.js'
import { clock, duration } from '../lib/format.js'
import { useData } from './DataContext.jsx'
import { useToast } from './ToastContext.jsx'

const TimerContext = createContext(null)
const KEY = 'pulse.timer'

function notify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: asset('favicon.svg'), tag: 'pulse-timer' })
    }
  } catch {
    // Some browsers only allow notifications from a service worker. The toast still shows.
  }
}

/**
 * The timer lives above the router so it keeps running while you move around
 * the site, and it is saved so a reload carries on where it was.
 */
export function TimerProvider({ children }) {
  const { settings, addSession } = useData()
  const { toast } = useToast()
  const [timer, setTimer] = useState(() => {
    const saved = readJSON(KEY, null)
    return saved?.phase && PHASES[saved.phase] ? saved : initialTimer(settings)
  })
  const [now, setNow] = useState(Date.now())
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    writeJSON(KEY, timer)
  }, [timer])

  // A new focus length applies straight away when the timer is idle.
  useEffect(() => {
    setTimer((t) => applySettings(t, settings))
  }, [settings])

  const record = useCallback(
    (session) => {
      if (!session) return
      addSession(session).catch((err) => toast(`The session could not be saved: ${err.message}`, { tone: 'error' }))
    },
    [addSession, toast],
  )

  // Tick only while running. Time is read from timestamps, so the interval just repaints.
  useEffect(() => {
    if (timer.status !== 'running') return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [timer.status])

  useEffect(() => {
    if (!isDue(timer, now)) return
    const s = settingsRef.current
    const result = finish(timer, s, Date.now())
    setTimer(result.state)
    record(result.session)
    if (s.sound) chime(timer.phase === 'focus' ? 'focus' : 'break')
    if (timer.phase === 'focus') {
      const next = PHASES[result.state.phase].label.toLowerCase()
      toast(`Focus block done: ${duration(result.session.minutes)} recorded. Time for a ${next}.`, { tone: 'success' })
      if (s.notifications) notify('Focus block done', `Nice work. Time for a ${next}.`)
    } else {
      toast('Break over. Ready for the next block?', { tone: 'info' })
      if (s.notifications) notify('Break over', 'Ready for the next focus block?')
    }
  }, [now, timer, record, toast])

  const remaining = remainingMs(timer, now)

  // Show the countdown in the tab title while it runs.
  useEffect(() => {
    if (timer.status === 'idle') return undefined
    const previous = document.title
    document.title = `${clock(remaining / 1000)} ${timer.phase === 'focus' ? 'Focus' : 'Break'} · Pulse`
    return () => {
      document.title = previous
    }
  }, [remaining, timer.status, timer.phase])

  const actions = useMemo(
    () => ({
      toggle: () => {
        setNow(Date.now())
        setTimer((t) => toggle(t, Date.now()))
      },
      stop: () => {
        const result = stop(timer, settingsRef.current, Date.now())
        setTimer(result.state)
        if (result.session) {
          record(result.session)
          toast(`Stopped early. ${duration(result.session.minutes)} saved as unfinished.`)
        }
      },
      interrupt: () => {
        setTimer((t) => interrupt(t))
      },
      skipBreak: () => setTimer((t) => skipBreak(t, settingsRef.current)),
      setPhase: (phase) => setTimer((t) => (t.status === 'idle' ? setPhase(t, phase, settingsRef.current) : t)),
      setLabel: (label) => setTimer((t) => ({ ...t, label: label.slice(0, 120) })),
      setTag: (tag) => setTimer((t) => ({ ...t, tag })),
      resetCycle: () => setTimer((t) => ({ ...t, completedFocus: 0 })),
    }),
    [timer, record, toast],
  )

  const value = useMemo(() => ({ timer, now, remaining, ...actions }), [timer, now, remaining, actions])
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer() {
  return useContext(TimerContext)
}
