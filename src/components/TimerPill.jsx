import { Link, useLocation } from 'react-router'
import { useTimer } from '../state/TimerContext.jsx'
import { clock } from '../lib/format.js'
import { Icon } from './Icon.jsx'

/** A small live countdown shown in the header when a timer runs on another page. */
export function TimerPill() {
  const { timer, remaining, toggle } = useTimer()
  const { pathname } = useLocation()
  if (timer.status === 'idle' || pathname === '/app') return null
  const focus = timer.phase === 'focus'
  return (
    <div className={`timer-pill ${focus ? 'is-focus' : 'is-break'}`}>
      <button type="button" className="timer-pill-btn" onClick={toggle} aria-label={timer.status === 'running' ? 'Pause timer' : 'Resume timer'}>
        {timer.status === 'running' ? <Icon.Pause width={12} height={12} /> : <Icon.Play width={12} height={12} />}
      </button>
      <Link to="/app" className="timer-pill-time">
        {clock(remaining / 1000)}
        <span className="sr-only">{focus ? ' left in focus block' : ' left in break'}</span>
      </Link>
    </div>
  )
}
