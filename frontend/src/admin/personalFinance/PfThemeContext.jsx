import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'pf_theme'

/** @typedef {'light' | 'dark' | 'system'} PfThemePreference */

const PfThemeContext = createContext(null)

export function PfThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === 'light' || v === 'dark' || v === 'system') return v
    } catch {
      /* ignore */
    }
    return 'dark'
  })

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved = preference === 'dark' ? 'dark' : preference === 'light' ? 'light' : systemDark ? 'dark' : 'light'

  const setPreference = useCallback((/** @type {PfThemePreference} */ v) => {
    setPreferenceState(v)
    try {
      localStorage.setItem(STORAGE_KEY, v)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      resolved,
      isDark: resolved === 'dark',
    }),
    [preference, resolved, setPreference],
  )

  return <PfThemeContext.Provider value={value}>{children}</PfThemeContext.Provider>
}

export function usePfTheme() {
  const ctx = useContext(PfThemeContext)
  if (!ctx) {
    return {
      preference: 'light',
      setPreference: () => {},
      resolved: 'light',
      isDark: false,
    }
  }
  return ctx
}
