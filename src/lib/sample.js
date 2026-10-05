import { mulberry32 } from './random.js'
import { startOfDay, weekdayIndex } from './format.js'

const TAGS = [
  { tag: 'Deep work', labels: ['Billing service refactor', 'API design doc', 'Search ranking fix', 'Webhook retries'] },
  { tag: 'Writing', labels: ['Quarterly update', 'Blog draft', 'Release notes', 'Proposal'] },
  { tag: 'Study', labels: ['FastAPI course', 'SQL indexes', 'Reading papers', 'Spanish'] },
  { tag: 'Code review', labels: ['Review open PRs', 'Pair review'] },
  { tag: 'Admin', labels: ['Inbox zero', 'Invoices', 'Planning'] },
]

/**
 * Sample sessions for the last `days` days, generated from a fixed seed.
 * Shaped to look like a real person: busier on weekdays, sharper in the morning,
 * more interruptions after lunch. All of it is invented.
 */
export function sampleSessions(days = 75, now = Date.now(), seed = 42) {
  const rand = mulberry32(seed)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const sessions = []
  const today = startOfDay(now)

  for (let back = days; back >= 0; back--) {
    const day = new Date(today)
    day.setDate(day.getDate() - back)
    const weekday = weekdayIndex(day.getTime())
    const weekend = weekday >= 5
    if (weekend && rand() < 0.55) continue
    if (!weekend && rand() < 0.06) continue

    const blocks = weekend ? 1 + Math.floor(rand() * 2) : 3 + Math.floor(rand() * 4)
    let cursor = day.getTime() + (8 + rand() * 1.5) * 3_600_000

    for (let b = 0; b < blocks; b++) {
      const hour = new Date(cursor).getHours()
      const afternoon = hour >= 13 && hour < 16
      const planned = rand() < 0.2 ? 50 : 25
      const interruptions = Math.max(0, Math.round(rand() * (afternoon ? 3 : 1.4) - 0.2))
      const completed = rand() > (afternoon ? 0.25 : 0.1)
      const minutes = completed ? planned : Math.max(4, Math.round(planned * (0.35 + rand() * 0.5)))
      const pauseMinutes = interruptions * (1 + Math.floor(rand() * 3))
      const start = cursor
      const end = start + (minutes + pauseMinutes) * 60_000
      if (end > now) break
      const group = pick(hour < 12 ? TAGS.slice(0, 3) : TAGS)
      sessions.push({
        id: `sample-${start}`,
        start,
        end,
        minutes,
        planned,
        label: pick(group.labels),
        tag: group.tag,
        interruptions,
        completed,
        sample: true,
      })
      cursor = end + (5 + rand() * 40) * 60_000
      // Lunch.
      if (new Date(cursor).getHours() === 12) cursor += 60 * 60_000
    }
  }
  return sessions
}
