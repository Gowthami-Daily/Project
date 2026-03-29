import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const PfRefreshContext = createContext(null)

export function PfRefreshProvider({ children }) {
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])
  const value = useMemo(() => ({ tick, refresh }), [tick, refresh])
  return <PfRefreshContext.Provider value={value}>{children}</PfRefreshContext.Provider>
}

export function usePfRefresh() {
  const ctx = useContext(PfRefreshContext)
  if (!ctx) return { tick: 0, refresh: () => {} }
  return ctx
}
