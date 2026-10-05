// Every read and write is wrapped: private windows and blocked storage throw,
// and the app must keep working (in memory) when that happens.
const memory = new Map()

export function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return memory.has(key) ? memory.get(key) : fallback
    return JSON.parse(raw)
  } catch {
    return memory.has(key) ? memory.get(key) : fallback
  }
}

export function writeJSON(key, value) {
  memory.set(key, value)
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key) {
  memory.delete(key)
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
