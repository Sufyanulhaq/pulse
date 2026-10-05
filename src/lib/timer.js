/**
 * The focus timer as plain functions over a state object. Time is always read
 * from timestamps, never counted in ticks, so a sleeping laptop or a background
 * tab cannot make it drift.
 */
export const PHASES = {
  focus: { label: 'Focus', key: 'focusMinutes' },
  short: { label: 'Short break', key: 'shortBreakMinutes' },
  long: { label: 'Long break', key: 'longBreakMinutes' },
}

export function phaseDuration(phase, settings) {
  return settings[PHASES[phase].key] * 60_000
}

export function initialTimer(settings, keep = {}) {
  const duration = phaseDuration('focus', settings)
  return {
    phase: 'focus',
    status: 'idle',
    duration,
    remaining: duration,
    endsAt: null,
    startedAt: null,
    resumedAt: null,
    focusedMs: 0,
    interruptions: 0,
    completedFocus: 0,
    label: '',
    tag: settings.tags?.[0] || '',
    ...keep,
  }
}

export function remainingMs(state, now) {
  if (state.status === 'running') return Math.max(0, state.endsAt - now)
  return state.remaining
}

export function elapsedFocusMs(state, now) {
  return state.focusedMs + (state.status === 'running' ? now - state.resumedAt : 0)
}

export function start(state, now) {
  if (state.status === 'running') return state
  return {
    ...state,
    status: 'running',
    startedAt: state.startedAt ?? now,
    resumedAt: now,
    endsAt: now + state.remaining,
  }
}

export function pause(state, now) {
  if (state.status !== 'running') return state
  return {
    ...state,
    status: 'paused',
    remaining: Math.max(0, state.endsAt - now),
    focusedMs: state.focusedMs + (now - state.resumedAt),
    endsAt: null,
    resumedAt: null,
  }
}

export function toggle(state, now) {
  return state.status === 'running' ? pause(state, now) : start(state, now)
}

export function interrupt(state) {
  if (state.phase !== 'focus' || state.status === 'idle') return state
  return { ...state, interruptions: state.interruptions + 1 }
}

export function setPhase(state, phase, settings) {
  const duration = phaseDuration(phase, settings)
  return {
    ...state,
    phase,
    status: 'idle',
    duration,
    remaining: duration,
    endsAt: null,
    startedAt: null,
    resumedAt: null,
    focusedMs: 0,
    interruptions: 0,
  }
}

/** When settings change while idle, the new length applies at once. */
export function applySettings(state, settings) {
  if (state.status !== 'idle') return state
  const tag = settings.tags.includes(state.tag) ? state.tag : settings.tags[0]
  return { ...setPhase(state, state.phase, settings), tag }
}

export function isDue(state, now) {
  return state.status === 'running' && now >= state.endsAt
}

function makeSession(state, end, completed) {
  const focused = completed ? Math.min(state.duration, elapsedFocusMs(state, end)) : elapsedFocusMs(state, end)
  return {
    id: `s_${state.startedAt.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    start: state.startedAt,
    end,
    minutes: Math.round((focused / 60_000) * 10) / 10,
    planned: Math.round(state.duration / 60_000),
    label: state.label.trim(),
    tag: state.tag,
    interruptions: state.interruptions,
    completed,
  }
}

/**
 * The phase ran out. Returns the next state and, for a focus phase, the finished session.
 * `end` is the moment it ran out, which may be earlier than now if the tab slept.
 */
export function finish(state, settings, now) {
  const end = state.endsAt && state.endsAt < now ? state.endsAt : now
  let session = null
  let next
  if (state.phase === 'focus') {
    session = makeSession(state, end, true)
    const completedFocus = state.completedFocus + 1
    const phase = completedFocus % settings.longBreakEvery === 0 ? 'long' : 'short'
    next = { ...setPhase(state, phase, settings), completedFocus }
    if (settings.autoStartBreaks) next = start(next, now)
  } else {
    next = setPhase(state, 'focus', settings)
    if (settings.autoStartFocus) next = start(next, now)
  }
  return { state: next, session }
}

/**
 * Stop early. A focus block with at least a minute of real focus is kept as an
 * unfinished session; anything shorter is dropped.
 */
export function stop(state, settings, now) {
  let session = null
  if (state.phase === 'focus' && state.status !== 'idle' && elapsedFocusMs(state, now) >= 60_000) {
    session = makeSession(state, now, false)
  }
  return { state: setPhase(state, 'focus', settings), session }
}

/** Skip a break and go straight back to focus. */
export function skipBreak(state, settings) {
  if (state.phase === 'focus') return state
  return setPhase(state, 'focus', settings)
}
