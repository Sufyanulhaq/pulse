import { describe, expect, it } from 'vitest'
import { answerOffline, buildFacts, citedFacts, detectIntent } from '../../src/lib/assistant.js'
import { sampleSessions } from '../../src/lib/sample.js'
import { DEFAULT_SETTINGS } from '../../src/lib/settings.js'

const now = new Date(2026, 9, 5, 18).getTime()
const facts = buildFacts(sampleSessions(60, now), DEFAULT_SETTINGS, now)

describe('assistant', () => {
  it('says so when there is no data, instead of guessing', () => {
    const result = answerOffline('When do I focus best?', buildFacts([], DEFAULT_SETTINGS, now))
    expect(result.answerable).toBe(false)
    expect(result.answer).toMatch(/no sessions/)
  })

  it('refuses questions it cannot match to the data', () => {
    const result = answerOffline('What is the capital of France?', facts)
    expect(result.answerable).toBe(false)
    expect(result.citations).toEqual([])
  })

  it('answers common questions and cites every figure it used', () => {
    for (const q of ['When do I focus best?', 'How does this week compare with last week?', 'What interrupts me most?', 'Where does my time go?', 'How is my streak?', 'Any tips?']) {
      const result = answerOffline(q, facts)
      expect(result.answerable, q).toBe(true)
      expect(result.citations.length, q).toBeGreaterThan(0)
      for (const c of result.citations) expect(result.answer).toContain(`[${c.id}]`)
    }
  })

  it('routes questions to the right intent', () => {
    expect(detectIntent('which day of the week is best')?.id).toBe('best_day')
    expect(detectIntent('how many hours this month')?.id).toBe('month')
    expect(detectIntent('am I getting distracted')?.id).toBe('interruptions')
  })

  it('only keeps citation markers that match real facts', () => {
    expect(citedFacts('a [week_minutes] b [made_up] c [week_minutes]', facts)).toEqual(['week_minutes'])
  })
})
