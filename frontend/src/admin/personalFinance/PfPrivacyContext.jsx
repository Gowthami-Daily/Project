import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const STORAGE_KEY = 'pf_privacy_blur'

const PfPrivacyContext = createContext(null)

export function PfPrivacyProvider({ children }) {
  const [privacyBlur, setPrivacyBlurState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const setPrivacyBlur = useCallback((v) => {
    setPrivacyBlurState(!!v)
    try {
      if (v) localStorage.setItem(STORAGE_KEY, '1')
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(() => ({ privacyBlur, setPrivacyBlur }), [privacyBlur, setPrivacyBlur])

  return <PfPrivacyContext.Provider value={value}>{children}</PfPrivacyContext.Provider>
}

export function usePfPrivacy() {
  const ctx = useContext(PfPrivacyContext)
  if (!ctx) {
    return { privacyBlur: false, setPrivacyBlur: () => {} }
  }
  return ctx
}
