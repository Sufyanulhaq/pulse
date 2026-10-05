import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTimer } from '../../state/TimerContext.jsx'
import { useData } from '../../state/DataContext.jsx'
import { PHASES, elapsedFocusMs } from '../../lib/timer.js'
import { clock, duration, dateTime } from '../../lib/format.js'
import { streak, todayMinutes } from '../../lib/stats.js'
import { NOISES, playNoise, setNoiseVolume, stopNoise } from '../../lib/sound.js'
import { Icon } from '../../components/Icon.jsx'
import { Badge, Kbd, Segmented, usePageTitle } from '../../components/ui.jsx'
import { Ring as ProgressRing } from '../../components/Charts.jsx'

function TimerDial({ remaining, total, phase, status }) {
  const size = 300
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const progress = total ? 1 - remaining / total : 0
  return (
    <div className={`dial dial-${phase} ${status === 'running' ? 'is-running' : ''}`}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="dial-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="dial-fill"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="dial-center">
        <span className="dial-phase">{PHASES[phase].label}</span>
        <span className="dial-time" aria-live="off">
          {clock(remaining / 1000)}
        </span>
        <span className="dial-status">{status === 'running' ? 'Running' : status === 'paused' ? 'Paused' : 'Ready'}</span>
      </div>
    </div>
  )
}

function AmbientSound() {
  const [noise, setNoise] = useState(null)
  const [volume, setVolume] = useState(0.4)
  useEffect(() => () => stopNoise(), [])
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Ambient sound</h2>
          <p className="card-sub">Generated in your browser. Nothing is downloaded.</p>
        </div>
        <Icon.Volume />
      </div>
      <div className="noise-grid">
        {NOISES.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`noise-btn ${noise === n.id ? 'active' : ''}`}
            aria-pressed={noise === n.id}
            onClick={() => {
              if (noise === n.id) {
                stopNoise()
                setNoise(null)
              } else if (playNoise(n.id, volume)) {
                setNoise(n.id)
              }
            }}
          >
            <strong>{n.label}</strong>
            <span>{n.hint}</span>
          </button>
        ))}
      </div>
      <label className="volume">
        <span className="small muted">Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVolume(v)
            setNoiseVolume(v)
          }}
          aria-label="Ambient sound volume"
        />
      </label>
    </div>
  )
}

export default function TimerPage() {
  usePageTitle('Timer')
  const reduce = useReducedMotion()
  const { timer, now, remaining, toggle, stop, interrupt, skipBreak, setPhase, setLabel, setTag } = useTimer()
  const { sessions, settings } = useData()
  const today = todayMinutes(sessions, now)
  const running = timer.status !== 'idle'
  const focusSoFar = timer.phase === 'focus' && running ? elapsedFocusMs(timer, now) / 60_000 : 0
  const recent = useMemo(() => [...sessions].reverse().slice(0, 5), [sessions])
  const currentStreak = useMemo(() => streak(sessions, now), [sessions, now])

  // Keyboard shortcuts for this page.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'i') interrupt()
      else if (e.key === 's' && running) stop()
      else if (e.key === 'n' && timer.phase !== 'focus') skipBreak()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, interrupt, stop, skipBreak, running, timer.phase])

  const cycle = Array.from({ length: settings.longBreakEvery }, (_, i) => i < timer.completedFocus % settings.longBreakEvery)

  return (
    <div className="timer-page">
      <h1 className="sr-only">Focus timer</h1>
      <div className="grid grid-2-1">
        <section className="card timer-card" aria-label="Focus timer">
          <div className="timer-top">
            <Segmented
              label="Phase"
              value={timer.phase}
              onChange={setPhase}
              size="sm"
              options={Object.entries(PHASES).map(([value, p]) => ({ value, label: p.label, disabled: running && value !== timer.phase }))}
            />
            <div className="cycle" aria-label={`${timer.completedFocus % settings.longBreakEvery} of ${settings.longBreakEvery} blocks before a long break`}>
              {cycle.map((done, i) => (
                <span key={i} className={done ? 'done' : ''} />
              ))}
            </div>
          </div>

          <TimerDial remaining={remaining} total={timer.duration} phase={timer.phase} status={timer.status} />

          <div className="timer-controls">
            <motion.button
              type="button"
              className="btn btn-primary btn-lg timer-main"
              onClick={toggle}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              aria-keyshortcuts="Space"
            >
              {timer.status === 'running' ? <Icon.Pause /> : <Icon.Play />}
              {timer.status === 'running' ? 'Pause' : timer.status === 'paused' ? 'Resume' : timer.phase === 'focus' ? 'Start focus' : 'Start break'}
            </motion.button>
            {timer.phase === 'focus' ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={interrupt} disabled={!running} aria-keyshortcuts="i">
                  <Icon.Bell width={16} height={16} /> Interrupted
                  {timer.interruptions > 0 && <Badge tone="accent">{timer.interruptions}</Badge>}
                </button>
                <button type="button" className="btn btn-ghost" onClick={stop} disabled={!running} aria-keyshortcuts="s">
                  <Icon.Stop width={14} height={14} /> Stop
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={skipBreak} aria-keyshortcuts="n">
                <Icon.Skip width={16} height={16} /> Skip break
              </button>
            )}
          </div>

          <div className="timer-intent">
            <label className="field-label" htmlFor="intent">
              What are you focusing on?
            </label>
            <div className="intent-row">
              <input
                id="intent"
                className="input"
                placeholder="Optional, for example: draft the API docs"
                value={timer.label}
                maxLength={120}
                onChange={(e) => setLabel(e.target.value)}
              />
              <select className="select intent-tag" value={timer.tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
                {settings.tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="shortcuts">
            <Kbd>Space</Kbd> start or pause <Kbd>I</Kbd> log an interruption <Kbd>S</Kbd> stop <Kbd>N</Kbd> skip break
          </p>
        </section>

        <div className="stack">
          <section className="card today-card" aria-label="Today">
            <div className="card-head">
              <h2>Today</h2>
              <Link to="/app/insights" className="small">
                Insights
              </Link>
            </div>
            <div className="today-body">
              <ProgressRing value={today + focusSoFar} max={settings.goalMinutes} size={132} stroke={11} label={`${Math.round(((today + focusSoFar) / settings.goalMinutes) * 100)}% of today’s goal`}>
                <strong className="ring-value">{Math.min(999, Math.round(((today + focusSoFar) / settings.goalMinutes) * 100))}%</strong>
                <span className="ring-label">of goal</span>
              </ProgressRing>
              <dl className="today-stats">
                <div>
                  <dt>Focused</dt>
                  <dd>{duration(today + focusSoFar)}</dd>
                </div>
                <div>
                  <dt>Goal</dt>
                  <dd>{duration(settings.goalMinutes)}</dd>
                </div>
                <div>
                  <dt>Streak</dt>
                  <dd>
                    {currentStreak} day{currentStreak === 1 ? '' : 's'}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="card" aria-label="Recent sessions">
            <div className="card-head">
              <h2>Recent sessions</h2>
              <Link to="/app/history" className="small">
                See all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="muted small">Your finished blocks will appear here. Start the timer, or load sample data from Settings to explore.</p>
            ) : (
              <ul className="recent">
                <AnimatePresence initial={false}>
                  {recent.map((s) => (
                    <motion.li key={s.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                      <span className={`recent-dot ${s.completed ? 'done' : ''}`} aria-hidden="true" />
                      <div className="recent-text">
                        <strong>{s.label || s.tag || 'Focus block'}</strong>
                        <span>
                          {dateTime(s.start)} · {s.tag || 'Untagged'}
                        </span>
                      </div>
                      <span className="recent-min">{duration(s.minutes)}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>

          <AmbientSound />
        </div>
      </div>
    </div>
  )
}
