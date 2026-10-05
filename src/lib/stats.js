import { DAY, HOUR, dayKey, startOfDay, weekdayIndex } from './format.js'

/**
 * A session is one focus block:
 * { id, start, end, minutes, planned, label, tag, interruptions, completed }
 * `minutes` is the focused time actually spent (pauses excluded).
 */

export function inRange(sessions, from, to) {
  return sessions.filter((s) => s.start >= from && s.start < to)
}

export function summarize(sessions) {
  const count = sessions.length
  const minutes = sessions.reduce((sum, s) => sum + s.minutes, 0)
  const completed = sessions.filter((s) => s.completed).length
  const interruptions = sessions.reduce((sum, s) => sum + (s.interruptions || 0), 0)
  const hours = minutes / 60
  return {
    count,
    minutes,
    completed,
    completionRate: count ? completed / count : 0,
    interruptions,
    interruptionsPerHour: hours > 0 ? interruptions / hours : 0,
    avgLength: count ? minutes / count : 0,
  }
}

/**
 * The focus score, 0 to 100. Written out so it can be shown on the page:
 *   60 points  for reaching the daily goal on average across the period
 *   25 points  for the share of sessions finished rather than stopped early
 *   15 points  for few interruptions (0 per hour = 15, 4 or more per hour = 0)
 * No sessions means a score of 0, not a guess.
 */
export function focusScore(summary, goalMinutes, days) {
  if (!summary.count) return 0
  const goal = Math.min(1, summary.minutes / Math.max(1, goalMinutes * days)) * 60
  const finish = summary.completionRate * 25
  const calm = Math.max(0, 1 - summary.interruptionsPerHour / 4) * 15
  return Math.round(goal + finish + calm)
}

/** One entry per calendar day, oldest first, ending today. */
export function dailySeries(sessions, days, now = Date.now()) {
  const today = startOfDay(now)
  const buckets = new Map()
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    // Step back by calendar day, not 24h, so daylight saving changes do not skip a day.
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const entry = { key: dayKey(d.getTime()), date: d.getTime(), minutes: 0, count: 0 }
    buckets.set(entry.key, entry)
    series.push(entry)
  }
  for (const s of sessions) {
    const entry = buckets.get(dayKey(s.start))
    if (entry) {
      entry.minutes += s.minutes
      entry.count += 1
    }
  }
  return series
}

/**
 * Focused minutes by weekday (rows, Monday first) and hour (columns).
 * A session that crosses an hour boundary is split across both hours.
 */
export function hourWeekMatrix(sessions) {
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const s of sessions) {
    const wallMinutes = Math.max(1, (s.end - s.start) / 60_000)
    // Spread the focused minutes evenly over the wall-clock span (pauses included).
    const ratio = s.minutes / wallMinutes
    let cursor = s.start
    while (cursor < s.end) {
      const hourEnd = new Date(cursor)
      hourEnd.setMinutes(60, 0, 0)
      const sliceEnd = Math.min(s.end, hourEnd.getTime())
      const d = new Date(cursor)
      matrix[weekdayIndex(cursor)][d.getHours()] += ((sliceEnd - cursor) / 60_000) * ratio
      cursor = sliceEnd
    }
  }
  return matrix
}

export function byHour(sessions) {
  const matrix = hourWeekMatrix(sessions)
  return Array.from({ length: 24 }, (_, h) => matrix.reduce((sum, row) => sum + row[h], 0))
}

export function byWeekday(sessions) {
  return hourWeekMatrix(sessions).map((row) => row.reduce((a, b) => a + b, 0))
}

export function byTag(sessions) {
  const map = new Map()
  for (const s of sessions) {
    const tag = s.tag || 'Untagged'
    const entry = map.get(tag) || { tag, minutes: 0, count: 0, interruptions: 0, completed: 0 }
    entry.minutes += s.minutes
    entry.count += 1
    entry.interruptions += s.interruptions || 0
    entry.completed += s.completed ? 1 : 0
    map.set(tag, entry)
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes)
}

/** Index of the largest value, or -1 when everything is zero. */
export function peakIndex(values) {
  let best = -1
  let bestValue = 0
  values.forEach((v, i) => {
    if (v > bestValue) {
      bestValue = v
      best = i
    }
  })
  return best
}

/**
 * Consecutive days with at least one finished session, counting back from today.
 * A day that has not had a session yet does not break the streak until it is over.
 */
export function streak(sessions, now = Date.now()) {
  const days = new Set(sessions.filter((s) => s.completed).map((s) => dayKey(s.start)))
  const cursor = new Date(startOfDay(now))
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (days.has(dayKey(cursor.getTime()))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}

export function longestStreak(sessions) {
  const days = [...new Set(sessions.filter((s) => s.completed).map((s) => startOfDay(s.start)))].sort(
    (a, b) => a - b,
  )
  let best = 0
  let run = 0
  let prev = null
  for (const d of days) {
    // 20-28h apart counts as the next calendar day, which survives daylight saving.
    run = prev != null && d - prev > 20 * HOUR && d - prev < 28 * HOUR ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** The current period of `days` ending now, and the one just before it. */
export function comparePeriods(sessions, days, now = Date.now()) {
  const end = startOfDay(now) + DAY
  const start = end - days * DAY
  const prevStart = start - days * DAY
  return {
    current: summarize(inRange(sessions, start, end)),
    previous: summarize(inRange(sessions, prevStart, start)),
    currentSessions: inRange(sessions, start, end),
  }
}

export function todayMinutes(sessions, now = Date.now()) {
  const from = startOfDay(now)
  return inRange(sessions, from, from + DAY).reduce((sum, s) => sum + s.minutes, 0)
}
