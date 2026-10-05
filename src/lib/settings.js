export const DEFAULT_TAGS = ['Deep work', 'Writing', 'Study', 'Code review', 'Admin']

export const DEFAULT_SETTINGS = {
  goalMinutes: 120,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  sound: true,
  notifications: false,
  tags: DEFAULT_TAGS,
}

export const LIMITS = {
  goalMinutes: [15, 960],
  focusMinutes: [1, 180],
  shortBreakMinutes: [1, 60],
  longBreakMinutes: [1, 90],
  longBreakEvery: [2, 12],
}

/** Fill gaps and pull numbers back into range, so stored settings can never break the timer. */
export function normalizeSettings(input) {
  const out = { ...DEFAULT_SETTINGS, ...(input && typeof input === 'object' ? input : {}) }
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const n = Math.round(Number(out[key]))
    out[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : DEFAULT_SETTINGS[key]
  }
  for (const key of ['autoStartBreaks', 'autoStartFocus', 'sound', 'notifications']) out[key] = Boolean(out[key])
  const tags = Array.isArray(out.tags) ? out.tags : DEFAULT_TAGS
  out.tags = [...new Set(tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean))].slice(0, 20)
  if (!out.tags.length) out.tags = DEFAULT_TAGS
  return out
}
