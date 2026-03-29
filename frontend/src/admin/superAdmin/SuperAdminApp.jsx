import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { fetchPfMe, getPfToken, setPfToken } from '../personalFinance/api.js'
import { PfThemeProvider } from '../personalFinance/PfThemeContext.jsx'
import SuperAdminBackupPage from './SuperAdminBackupPage.jsx'
import SuperAdminDashboard from './SuperAdminDashboard.jsx'
import SuperAdminLayout from './SuperAdminLayout.jsx'
import SuperAdminLogsPage from './SuperAdminLogsPage.jsx'
import SuperAdminPermissionsPage from './SuperAdminPermissionsPage.jsx'
import SuperAdminUsersPage from './SuperAdminUsersPage.jsx'

function SuperAdminGate({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    if (!getPfToken()) {
      setUser(null)
      setReady(true)
      return
    }
    try {
      const u = await fetchPfMe()
      setUser(u)
    } catch {
      setPfToken(null)
      setUser(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 dark:bg-slate-900">
        <p className="text-slate-700 dark:text-slate-200">Sign in first, then return here.</p>
        <Link
          to="/personal-finance"
          className="rounded-xl bg-[#004080] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#003366]"
        >
          Go to Personal Finance login
        </Link>
      </div>
    )
  }

  if (String(user.role || '').toUpperCase() !== 'SUPER_ADMIN') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 dark:bg-slate-900">
        <p className="text-slate-700 dark:text-slate-200">Super Admin only. Your role: {user.role}</p>
        <Link to="/personal-finance" className="text-sm font-semibold text-[#004080] underline">
          Back to app
        </Link>
      </div>
    )
  }

  return children
}

export default function SuperAdminApp() {
  return (
    <PfThemeProvider>
      <SuperAdminGate>
        <Routes>
          <Route element={<SuperAdminLayout />}>
            <Route index element={<SuperAdminDashboard />} />
            <Route path="users" element={<SuperAdminUsersPage />} />
            <Route path="permissions" element={<SuperAdminPermissionsPage />} />
            <Route path="logs" element={<SuperAdminLogsPage />} />
            <Route path="backup" element={<SuperAdminBackupPage />} />
            <Route path="*" element={<Navigate to="/super-admin" replace />} />
          </Route>
        </Routes>
      </SuperAdminGate>
    </PfThemeProvider>
  )
}
