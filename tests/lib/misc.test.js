import { describe, expect, it } from 'vitest'
import { csvCell, toCSV, SESSION_COLUMNS } from '../../src/lib/csv.js'
import { safeEqual, sessionEvent, signPayload, verifyPayload } from '../../src/lib/webhook.js'
import { normalizeSettings, DEFAULT_SETTINGS } from '../../src/lib/settings.js'
import { sampleSessions } from '../../src/lib/sample.js'
import { clock, duration } from '../../src/lib/format.js'

describe('csv', () => {
  it('neutralises spreadsheet formulas and quotes special characters', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('@me')).toBe("'@me")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('')
  })

  it('writes a header and one row per session', () => {
    const text = toCSV([{ start: 0, end: 60_000, minutes: 1, planned: 25, label: 'x', tag: 'y', interruptions: 0, completed: true }], SESSION_COLUMNS)
    const lines = text.split('\r\n')
    expect(lines[0]).toBe('Started,Ended,Focused minutes,Planned minutes,Label,Tag,Interruptions,Finished')
    expect(lines[1]).toContain('1970-01-01T00:00:00.000Z')
    expect(lines[1].endsWith(',yes')).toBe(true)
  })
})

describe('webhook signatures', () => {
  const secret = 'whsec_test'
  const body = JSON.stringify({ hello: 'world' })

  it('verifies its own signature', async () => {
    const { timestamp, signature } = await signPayload(secret, body, 1_000)
    expect(signature).toMatch(/^[0-9a-f]{64}$/)
    const result = await verifyPayload({ secret, rawBody: body, timestamp, signature, now: 1_000_000 + 1000 })
    expect(result.ok).toBe(true)
  })

  it('rejects a changed body, a wrong secret and a stale timestamp', async () => {
    const { timestamp, signature } = await signPayload(secret, body, 1_000)
    const now = 1_000_000
    expect((await verifyPayload({ secret, rawBody: body + ' ', timestamp, signature, now })).ok).toBe(false)
    expect((await verifyPayload({ secret: 'other', rawBody: body, timestamp, signature, now })).ok).toBe(false)
    const stale = await verifyPayload({ secret, rawBody: body, timestamp, signature, now: now + 301_000 })
    expect(stale.ok).toBe(false)
    expect(stale.reason).toMatch(/replay/)
  })

  it('compares strings of different lengths safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('abc', null)).toBe(false)
  })

  it('builds the session.completed event', () => {
    const event = sessionEvent({ id: 's1', start: 0, end: 60_000, minutes: 1, planned: 25, label: '', tag: 'x', interruptions: 0, completed: true })
    expect(event).toMatchObject({ type: 'session.completed', id: 'evt_s1', data: { label: null, finished: true } })
  })
})

describe('settings', () => {
  it('fills gaps and clamps numbers', () => {
    const s = normalizeSettings({ focusMinutes: 999, goalMinutes: 'x', tags: [' a ', 'a', ''] })
    expect(s.focusMinutes).toBe(180)
    expect(s.goalMinutes).toBe(DEFAULT_SETTINGS.goalMinutes)
    expect(s.tags).toEqual(['a'])
  })
})

describe('sample data', () => {
  it('is the same every time and never in the future', () => {
    const now = new Date(2026, 9, 5, 18).getTime()
    const a = sampleSessions(30, now)
    const b = sampleSessions(30, now)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(40)
    expect(a.every((s) => s.end <= now && s.minutes > 0 && s.end > s.start)).toBe(true)
  })
})

describe('format', () => {
  it('formats clocks and durations', () => {
    expect(clock(1500)).toBe('25:00')
    expect(clock(3725)).toBe('1:02:05')
    expect(duration(45)).toBe('45m')
    expect(duration(135)).toBe('2h 15m')
    expect(duration(120)).toBe('2h')
  })
})
