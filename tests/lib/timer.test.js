import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/lib/settings.js'
import { finish, initialTimer, interrupt, isDue, pause, remainingMs, skipBreak, start, stop } from '../../src/lib/timer.js'

const settings = { ...DEFAULT_SETTINGS, focusMinutes: 25, longBreakEvery: 2 }
const MIN = 60_000

describe('timer', () => {
  it('counts down from timestamps and pauses without losing time', () => {
    let t = start(initialTimer(settings), 0)
    expect(remainingMs(t, 10 * MIN)).toBe(15 * MIN)
    t = pause(t, 10 * MIN)
    expect(remainingMs(t, 50 * MIN)).toBe(15 * MIN)
    t = start(t, 50 * MIN)
    expect(remainingMs(t, 55 * MIN)).toBe(10 * MIN)
    expect(isDue(t, 65 * MIN)).toBe(true)
  })

  it('records a finished session with focused time excluding the pause', () => {
    let t = start({ ...initialTimer(settings), label: 'Write tests' }, 0)
    t = interrupt(t)
    t = pause(t, 5 * MIN)
    t = start(t, 8 * MIN)
    const { state, session } = finish(t, settings, 28 * MIN)
    expect(session).toMatchObject({ start: 0, end: 28 * MIN, minutes: 25, planned: 25, completed: true, interruptions: 1, label: 'Write tests' })
    expect(state.phase).toBe('short')
    expect(state.status).toBe('idle')
  })

  it('uses the moment the phase ran out, even if noticed later', () => {
    const t = start(initialTimer(settings), 0)
    const { session } = finish(t, settings, 90 * MIN)
    expect(session.end).toBe(25 * MIN)
  })

  it('takes a long break after the set number of focus blocks', () => {
    let t = initialTimer(settings)
    t = finish(start(t, 0), settings, 25 * MIN).state
    t = finish(start(t, 30 * MIN), settings, 35 * MIN).state
    expect(t.phase).toBe('focus')
    t = finish(start(t, 40 * MIN), settings, 65 * MIN).state
    expect(t.phase).toBe('long')
  })

  it('keeps a stopped session of at least a minute as unfinished', () => {
    const t = start(initialTimer(settings), 0)
    expect(stop(t, settings, 30_000).session).toBeNull()
    const { session, state } = stop(t, settings, 12 * MIN)
    expect(session).toMatchObject({ minutes: 12, completed: false })
    expect(state.status).toBe('idle')
  })

  it('auto starts the break when asked to', () => {
    const t = start(initialTimer(settings), 0)
    const { state } = finish(t, { ...settings, autoStartBreaks: true }, 25 * MIN)
    expect(state.status).toBe('running')
  })

  it('only skips breaks and ignores interruptions outside focus', () => {
    let t = finish(start(initialTimer(settings), 0), settings, 25 * MIN).state
    expect(interrupt(t)).toBe(t)
    t = skipBreak(t, settings)
    expect(t.phase).toBe('focus')
    expect(skipBreak(t, settings)).toBe(t)
  })
})
