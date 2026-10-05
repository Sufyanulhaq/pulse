import { describe, expect, it } from 'vitest'
import {
  byHour,
  byTag,
  comparePeriods,
  dailySeries,
  focusScore,
  hourWeekMatrix,
  longestStreak,
  peakIndex,
  streak,
  summarize,
} from '../../src/lib/stats.js'

const at = (y, m, d, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const session = (start, minutes, extra = {}) => ({
  id: String(start),
  start,
  end: start + minutes * 60_000,
  minutes,
  planned: 25,
  label: '',
  tag: 'Deep work',
  interruptions: 0,
  completed: true,
  ...extra,
})

describe('summarize', () => {
  it('handles no sessions without dividing by zero', () => {
    expect(summarize([])).toEqual({
      count: 0,
      minutes: 0,
      completed: 0,
      completionRate: 0,
      interruptions: 0,
      interruptionsPerHour: 0,
      avgLength: 0,
    })
  })

  it('adds up minutes, completion and interruptions per hour', () => {
    const s = summarize([
      session(at(2026, 10, 1), 30, { interruptions: 2 }),
      session(at(2026, 10, 1, 11), 30, { completed: false, interruptions: 1 }),
    ])
    expect(s.minutes).toBe(60)
    expect(s.completionRate).toBe(0.5)
    expect(s.interruptionsPerHour).toBe(3)
    expect(s.avgLength).toBe(30)
  })
})

describe('focusScore', () => {
  it('is 0 with no sessions', () => {
    expect(focusScore(summarize([]), 120, 7)).toBe(0)
  })

  it('is 100 for meeting the goal, finishing everything, with no interruptions', () => {
    const s = summarize([session(at(2026, 10, 1), 120)])
    expect(focusScore(s, 120, 1)).toBe(100)
  })

  it('takes points away for interruptions, capped at zero for that part', () => {
    const s = summarize([session(at(2026, 10, 1), 60, { interruptions: 10 })])
    // 30 for half the goal, 25 for finishing, 0 for calm.
    expect(focusScore(s, 120, 1)).toBe(55)
  })
})

describe('dailySeries', () => {
  it('returns one entry per day ending today, oldest first', () => {
    const now = at(2026, 10, 5, 15)
    const series = dailySeries([session(at(2026, 10, 5), 25), session(at(2026, 10, 3), 50)], 7, now)
    expect(series).toHaveLength(7)
    expect(series[6].key).toBe('2026-10-05')
    expect(series[6].minutes).toBe(25)
    expect(series[4].minutes).toBe(50)
    expect(series[0].key).toBe('2026-09-29')
  })

  it('ignores sessions outside the window', () => {
    const series = dailySeries([session(at(2026, 1, 1), 25)], 7, at(2026, 10, 5))
    expect(series.every((d) => d.minutes === 0)).toBe(true)
  })
})

describe('hourWeekMatrix', () => {
  it('splits a session across the hours it covers', () => {
    // Monday 5 Oct 2026, 9:30 to 10:30, 60 focused minutes.
    const matrix = hourWeekMatrix([session(at(2026, 10, 5, 9, 30), 60)])
    expect(matrix[0][9]).toBeCloseTo(30)
    expect(matrix[0][10]).toBeCloseTo(30)
  })

  it('spreads focused minutes over a span that includes pauses', () => {
    const s = { ...session(at(2026, 10, 5, 9), 30), end: at(2026, 10, 5, 10) }
    const hours = byHour([s])
    expect(hours[9]).toBeCloseTo(30)
  })
})

describe('streaks', () => {
  const now = at(2026, 10, 5, 8)
  it('counts back from yesterday when today has no session yet', () => {
    const sessions = [session(at(2026, 10, 4), 25), session(at(2026, 10, 3), 25), session(at(2026, 10, 1), 25)]
    expect(streak(sessions, now)).toBe(2)
  })

  it('does not count unfinished sessions', () => {
    expect(streak([session(at(2026, 10, 4), 25, { completed: false })], now)).toBe(0)
  })

  it('finds the longest run', () => {
    const days = [1, 2, 3, 5, 6]
    expect(longestStreak(days.map((d) => session(at(2026, 10, d), 25)))).toBe(3)
  })
})

describe('byTag and peakIndex', () => {
  it('sorts tags by minutes', () => {
    const tags = byTag([
      session(at(2026, 10, 1), 25, { tag: 'Writing' }),
      session(at(2026, 10, 1, 11), 50, { tag: 'Study' }),
      session(at(2026, 10, 1, 13), 10, { tag: '' }),
    ])
    expect(tags.map((t) => t.tag)).toEqual(['Study', 'Writing', 'Untagged'])
  })

  it('returns -1 when everything is zero', () => {
    expect(peakIndex([0, 0, 0])).toBe(-1)
    expect(peakIndex([1, 5, 2])).toBe(1)
  })
})

describe('comparePeriods', () => {
  it('splits sessions into this period and the one before', () => {
    const now = at(2026, 10, 5, 12)
    const { current, previous } = comparePeriods([session(at(2026, 10, 4), 25), session(at(2026, 9, 27), 50)], 7, now)
    expect(current.minutes).toBe(25)
    expect(previous.minutes).toBe(50)
  })
})
