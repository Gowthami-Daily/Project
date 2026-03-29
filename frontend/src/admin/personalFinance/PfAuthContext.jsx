import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchPfMe, getPfToken, setPfToken } from './api.js'

const PfAuthContext = createContext(null)

function pfLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F1F5F9] px-4 dark:bg-slate-900">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#1E3A8A] dark:border-slate-600 dark:border-t-blue-400"
        aria-hidden
      />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading session…</p>
    </div>
  )
}

export function PfAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const refreshUser = useCallback(async () => {
    const token = getPfToken()
    if (!token) {
      setUser(null)
      return null
    }
    const u = await fetchPfMe()
    setUser(u)
    return u
  }, [])

  const invalidateSession = useCallback(() => {
    setPfToken(null)
    setUser(null)
  }, [])

  const logout = useCallback(() => {
    setPfToken(null)
    setUser(null)
    const url = `${window.location.origin}/personal-finance`
    try {
      window.history.replaceState(null, '', '/personal-finance')
    } catch {
      /* ignore */
    }
    window.location.replace(url)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = getPfToken()
      if (!token) {
        if (!cancelled) {
          setUser(null)
          setReady(true)
        }
        return
      }
      try {
        const u = await fetchPfMe()
        if (!cancelled) setUser(u)
      } catch {
        if (!cancelled) {
          setPfToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      refreshUser,
      logout,
      invalidateSession,
    }),
    [user, ready, refreshUser, logout, invalidateSession],
  )

  if (!ready) {
    return pfLoadingScreen()
  }

  return <PfAuthContext.Provider value={value}>{children}</PfAuthContext.Provider>
}

export function usePfAuth() {
  const ctx = useContext(PfAuthContext)
  if (!ctx) {
    throw new Error('usePfAuth must be used within PfAuthProvider')
  }
  return ctx
}
