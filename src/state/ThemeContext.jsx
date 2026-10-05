import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { readJSON, writeJSON } from '../lib/storage.js'

const ThemeContext = createContext(null)
const KEY = 'pulse.theme'

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(() => readJSON(KEY, 'system'))
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined
    const onChange = (e) => setSystemDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? 'rgb(11, 17, 32)' : 'rgb(248, 250, 252)')
  }, [resolved])

  const setTheme = useCallback((next) => {
    setChoice(next)
    writeJSON(KEY, next)
  }, [])

  const cycle = useCallback(() => {
    setTheme(choice === 'light' ? 'dark' : choice === 'dark' ? 'system' : 'light')
  }, [choice, setTheme])

  const value = useMemo(() => ({ choice, resolved, setTheme, cycle }), [choice, resolved, setTheme, cycle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
