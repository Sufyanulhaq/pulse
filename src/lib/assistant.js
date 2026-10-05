import { DAY, WEEKDAYS_LONG, duration, hourLabel, percent, startOfDay } from './format.js'
import {
  byHour,
  byTag,
  byWeekday,
  comparePeriods,
  focusScore,
  hourWeekMatrix,
  inRange,
  longestStreak,
  peakIndex,
  streak,
  summarize,
  todayMinutes,
} from './stats.js'

/**
 * Facts are the only thing the assistant may say. Each one has an id, so an answer
 * can point at exactly which figures it used. The offline answerer and the Claude
 * path both read from this same list.
 */
export function buildFacts(sessions, settings, now = Date.now()) {
  const goal = settings?.goalMinutes || 120
  const facts = []
  const add = (id, label, value) => facts.push({ id, label, value })

  const all = summarize(sessions)
  add('total_sessions', 'Sessions recorded in total', String(all.count))
  if (!all.count) return facts

  const today = todayMinutes(sessions, now)
  add('today_minutes', 'Focused time today', duration(today))
  add('daily_goal', 'Daily goal', duration(goal))
  add('today_goal_progress', 'Progress towards today’s goal', percent(Math.min(1, today / goal)))

  const week = comparePeriods(sessions, 7, now)
  add('week_minutes', 'Focused time in the last 7 days', duration(week.current.minutes))
  add('prev_week_minutes', 'Focused time in the 7 days before that', duration(week.previous.minutes))
  add('week_sessions', 'Sessions in the last 7 days', String(week.current.count))
  add('week_score', 'Focus score for the last 7 days (0 to 100)', String(focusScore(week.current, goal, 7)))
  add('prev_week_score', 'Focus score for the 7 days before that', String(focusScore(week.previous, goal, 7)))
  add('week_completion', 'Share of sessions finished in the last 7 days', percent(week.current.completionRate))
  add(
    'week_interruptions_per_hour',
    'Interruptions per focused hour in the last 7 days',
    week.current.interruptionsPerHour.toFixed(1),
  )

  const month = comparePeriods(sessions, 30, now)
  add('month_minutes', 'Focused time in the last 30 days', duration(month.current.minutes))
  add('month_sessions', 'Sessions in the last 30 days', String(month.current.count))

  const recent = inRange(sessions, startOfDay(now) - 29 * DAY, now + DAY)
  const basis = recent.length >= 5 ? recent : sessions
  const basisLabel = basis === recent ? 'in the last 30 days' : 'across all sessions'

  const hours = byHour(basis)
  const peakHour = peakIndex(hours)
  if (peakHour >= 0) add('best_hour', `Hour with the most focused time ${basisLabel}`, `${hourLabel(peakHour)} to ${hourLabel((peakHour + 1) % 24)}`)

  const morning = hours.slice(5, 12).reduce((a, b) => a + b, 0)
  const afternoon = hours.slice(12, 17).reduce((a, b) => a + b, 0)
  const evening = hours.slice(17, 24).reduce((a, b) => a + b, 0)
  add('morning_minutes', `Focused time before noon ${basisLabel}`, duration(morning))
  add('afternoon_minutes', `Focused time from noon to 5pm ${basisLabel}`, duration(afternoon))
  add('evening_minutes', `Focused time after 5pm ${basisLabel}`, duration(evening))

  const weekdays = byWeekday(basis)
  const peakDay = peakIndex(weekdays)
  if (peakDay >= 0) add('best_weekday', `Weekday with the most focused time ${basisLabel}`, WEEKDAYS_LONG[peakDay])

  // Interruption rate by part of day, from session starts.
  const rate = (from, to) => {
    const part = basis.filter((s) => {
      const h = new Date(s.start).getHours()
      return h >= from && h < to
    })
    const sum = summarize(part)
    return sum.minutes >= 30 ? sum.interruptionsPerHour : null
  }
  const amRate = rate(5, 12)
  const pmRate = rate(12, 17)
  if (amRate != null) add('morning_interruptions', `Interruptions per hour in sessions started before noon ${basisLabel}`, amRate.toFixed(1))
  if (pmRate != null) add('afternoon_interruptions', `Interruptions per hour in sessions started noon to 5pm ${basisLabel}`, pmRate.toFixed(1))

  const tags = byTag(basis)
  if (tags.length) {
    add('top_tag', `Tag with the most focused time ${basisLabel}`, `${tags[0].tag} (${duration(tags[0].minutes)})`)
    const worst = [...tags]
      .filter((t) => t.minutes >= 30)
      .sort((a, b) => b.interruptions / b.minutes - a.interruptions / a.minutes)[0]
    if (worst) {
      add(
        'most_interrupted_tag',
        `Tag with the most interruptions per hour ${basisLabel}`,
        `${worst.tag} (${((worst.interruptions / worst.minutes) * 60).toFixed(1)} per hour)`,
      )
    }
    add(
      'tag_breakdown',
      `Focused time by tag ${basisLabel}`,
      tags.slice(0, 5).map((t) => `${t.tag} ${duration(t.minutes)}`).join(', '),
    )
  }

  add('avg_session', 'Average focused length of a session', duration(all.avgLength))
  add('completion_all', 'Share of all sessions finished', percent(all.completionRate))
  add('current_streak', 'Current streak (days in a row with a finished session)', String(streak(sessions, now)))
  add('longest_streak', 'Longest streak ever', String(longestStreak(sessions)))

  // Best single day.
  const days = new Map()
  for (const s of sessions) {
    const key = startOfDay(s.start)
    days.set(key, (days.get(key) || 0) + s.minutes)
  }
  const [bestDay, bestMinutes] = [...days.entries()].sort((a, b) => b[1] - a[1])[0]
  add(
    'best_day_ever',
    'Most focused day on record',
    `${new Date(bestDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} (${duration(bestMinutes)})`,
  )

  const matrix = hourWeekMatrix(basis)
  let quiet = null
  for (let d = 0; d < 5; d++) {
    for (let h = 9; h < 17; h++) {
      if (matrix[d][h] < 1 && quiet == null) quiet = `${WEEKDAYS_LONG[d]} ${hourLabel(h)}`
    }
  }
  if (quiet) add('unused_slot', `First working hour slot (Mon to Fri, 9am to 5pm) with no focus ${basisLabel}`, quiet)

  return facts
}

const INTENTS = [
  { id: 'advice', test: /\b(tip|tips|advice|improve|better at|should i|suggest|help me|recommend)/, facts: ['best_hour', 'morning_interruptions', 'afternoon_interruptions', 'most_interrupted_tag', 'week_completion', 'unused_slot'] },
  { id: 'compare', test: /\b(compare|compared|versus|vs\.?|last week|previous week|trend|improving|getting better|worse)\b/, facts: ['week_minutes', 'prev_week_minutes', 'week_score', 'prev_week_score'] },
  { id: 'best_time', test: /\b(when|what time|which hour|best time|most productive|peak|morning|afternoon|evening)\b/, facts: ['best_hour', 'morning_minutes', 'afternoon_minutes', 'evening_minutes'] },
  { id: 'best_day', test: /\b(which day|best day|weekday|day of the week)\b/, facts: ['best_weekday', 'best_day_ever'] },
  { id: 'interruptions', test: /\b(interrupt\w*|distract\w*|context switch\w*|disturb\w*)/, facts: ['week_interruptions_per_hour', 'morning_interruptions', 'afternoon_interruptions', 'most_interrupted_tag'] },
  { id: 'streak', test: /\b(streak|in a row|consecutive)\b/, facts: ['current_streak', 'longest_streak'] },
  { id: 'tags', test: /\b(tag|tags|project|projects|spend|spent|split|breakdown|on what|categories|where does)\b|time go/, facts: ['tag_breakdown', 'top_tag'] },
  { id: 'average', test: /\b(average|typical|usual|how long)\b/, facts: ['avg_session', 'completion_all'] },
  { id: 'goal', test: /\b(goal|target)\b/, facts: ['today_minutes', 'daily_goal', 'today_goal_progress'] },
  { id: 'score', test: /\bscore\b/, facts: ['week_score', 'prev_week_score', 'week_completion', 'week_interruptions_per_hour'] },
  { id: 'completion', test: /\b(finish\w*|complet\w*|abandon\w*|stopp?ed early|quit)\b/, facts: ['week_completion', 'completion_all'] },
  { id: 'today', test: /\btoday\b/, facts: ['today_minutes', 'today_goal_progress'] },
  { id: 'month', test: /\b(month|30 days)\b/, facts: ['month_minutes', 'month_sessions'] },
  { id: 'week', test: /\b(week|7 days|how much|how many|total|hours)\b/, facts: ['week_minutes', 'week_sessions'] },
]

export const SUGGESTED_QUESTIONS = [
  'When do I focus best?',
  'How does this week compare with last week?',
  'What interrupts me most?',
  'Where does my time go?',
  'Any tips to improve my focus?',
  'How is my streak?',
]

export function detectIntent(question) {
  const q = question.toLowerCase()
  return INTENTS.find((intent) => intent.test.test(q)) || null
}

function factMap(facts) {
  return new Map(facts.map((f) => [f.id, f]))
}

function write(intentId, f) {
  const v = (id) => f.get(id)?.value
  switch (intentId) {
    case 'compare': {
      const now = v('week_minutes')
      const before = v('prev_week_minutes')
      const a = Number(v('week_score'))
      const b = Number(v('prev_week_score'))
      const direction = a > b ? 'up' : a < b ? 'down' : 'level'
      return `You focused for ${now} in the last 7 days [week_minutes], against ${before} in the 7 days before [prev_week_minutes]. Your focus score is ${direction === 'level' ? 'level' : direction} at ${a} [week_score], compared with ${b} before [prev_week_score].`
    }
    case 'best_time': {
      const parts = [
        ['morning', v('morning_minutes'), 'morning_minutes'],
        ['afternoon', v('afternoon_minutes'), 'afternoon_minutes'],
        ['evening', v('evening_minutes'), 'evening_minutes'],
      ]
      return `Your strongest hour is ${v('best_hour')} [best_hour]. By part of the day: ${parts.map(([name, val, id]) => `${name} ${val} [${id}]`).join(', ')}.`
    }
    case 'best_day':
      return `${v('best_weekday')} is the weekday with the most focused time [best_weekday]. Your most focused single day was ${v('best_day_ever')} [best_day_ever].`
    case 'interruptions': {
      const lines = [`Over the last 7 days you logged ${v('week_interruptions_per_hour')} interruptions per focused hour [week_interruptions_per_hour].`]
      if (f.has('morning_interruptions') && f.has('afternoon_interruptions')) {
        lines.push(`Sessions started before noon average ${v('morning_interruptions')} per hour [morning_interruptions], and noon to 5pm averages ${v('afternoon_interruptions')} [afternoon_interruptions].`)
      }
      if (f.has('most_interrupted_tag')) lines.push(`The most interrupted kind of work is ${v('most_interrupted_tag')} [most_interrupted_tag].`)
      return lines.join(' ')
    }
    case 'streak':
      return `Your current streak is ${v('current_streak')} day${v('current_streak') === '1' ? '' : 's'} [current_streak]. Your longest ever is ${v('longest_streak')} [longest_streak].`
    case 'tags':
      return `Most of your focus goes to ${v('top_tag')} [top_tag]. The full split: ${v('tag_breakdown')} [tag_breakdown].`
    case 'average':
      return `A typical session lasts ${v('avg_session')} of focused time [avg_session], and you finish ${v('completion_all')} of the sessions you start [completion_all].`
    case 'goal':
    case 'today':
      return `Today you have focused for ${v('today_minutes')} [today_minutes], which is ${v('today_goal_progress')} of your ${v('daily_goal')} goal [today_goal_progress] [daily_goal].`
    case 'score':
      return `Your focus score for the last 7 days is ${v('week_score')} [week_score] (the week before: ${v('prev_week_score')} [prev_week_score]). It is built from goal progress, finishing ${v('week_completion')} of sessions [week_completion], and ${v('week_interruptions_per_hour')} interruptions per hour [week_interruptions_per_hour].`
    case 'completion':
      return `In the last 7 days you finished ${v('week_completion')} of your sessions [week_completion]. Across everything recorded it is ${v('completion_all')} [completion_all].`
    case 'month':
      return `In the last 30 days you focused for ${v('month_minutes')} [month_minutes] across ${v('month_sessions')} sessions [month_sessions].`
    case 'week':
      return `In the last 7 days you focused for ${v('week_minutes')} [week_minutes] across ${v('week_sessions')} sessions [week_sessions].`
    case 'advice': {
      const tips = []
      if (f.has('best_hour')) tips.push(`Protect ${v('best_hour')} for your hardest task; it is when you focus most [best_hour].`)
      const am = Number(v('morning_interruptions'))
      const pm = Number(v('afternoon_interruptions'))
      if (f.has('morning_interruptions') && f.has('afternoon_interruptions') && pm > am) {
        tips.push(`Afternoons are noisier (${pm.toFixed(1)} vs ${am.toFixed(1)} interruptions per hour) [afternoon_interruptions] [morning_interruptions], so move reviews and admin there and keep mornings for deep work.`)
      }
      if (f.has('most_interrupted_tag')) tips.push(`${v('most_interrupted_tag')} gets interrupted the most [most_interrupted_tag]; try turning notifications off for those blocks.`)
      if (parseInt(v('week_completion'), 10) < 75) tips.push(`You finished ${v('week_completion')} of sessions this week [week_completion]. Shorter blocks may be easier to finish.`)
      if (f.has('unused_slot')) tips.push(`${v('unused_slot')} has had no focus time yet [unused_slot]; it could be a fresh slot for a block.`)
      return tips.length ? tips.join(' ') : null
    }
    default:
      return null
  }
}

/** Pull the [fact_id] markers out of an answer, keeping only real ids. */
export function citedFacts(answer, facts) {
  const ids = new Set(facts.map((f) => f.id))
  const used = []
  for (const match of answer.matchAll(/\[([a-z_]+)\]/g)) {
    if (ids.has(match[1]) && !used.includes(match[1])) used.push(match[1])
  }
  return used
}

/**
 * Answer a question from the user's own data without any model.
 * Returns { answerable, answer, citations } where citations are fact objects.
 */
export function answerOffline(question, facts) {
  const trimmed = String(question || '').trim()
  if (!trimmed) return { answerable: false, answer: 'Ask a question about your focus sessions.', citations: [] }
  const f = factMap(facts)
  if (!f.has('today_minutes')) {
    return {
      answerable: false,
      answer: 'There are no sessions to look at yet. Run a focus session, or load the sample data from Settings, then ask again.',
      citations: [],
    }
  }
  const intent = detectIntent(trimmed)
  const text = intent ? write(intent.id, f) : null
  if (!text) {
    return {
      answerable: false,
      answer:
        'I can only answer from your own session data, and I could not match that question to it. Try asking when you focus best, how this week compares, what interrupts you, where your time goes, or for tips.',
      citations: [],
    }
  }
  const used = citedFacts(text, facts)
  return { answerable: true, answer: text, citations: used.map((id) => f.get(id)), intent: intent.id }
}
