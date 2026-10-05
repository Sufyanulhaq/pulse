import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  // 'loading' | 'ready' | 'offline' (the API could not be reached; the app works locally)

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me')
      setUser(data.user)
      setStatus('ready')
      return data.user
    } catch {
      setUser(null)
      setStatus('offline')
      return null
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    setUser(data.user)
    setStatus('ready')
    return data.user
  }, [])

  const signup = useCallback(async (name, email, password) => {
    const data = await api.post('/auth/signup', { name, email, password })
    setUser(data.user)
    setStatus('ready')
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {})
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, status, setUser, refresh, login, signup, logout }), [user, status, refresh, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
