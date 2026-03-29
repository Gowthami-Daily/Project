import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginPf, setPfToken } from './api.js'
import { usePfAuth } from './PfAuthContext.jsx'

/** Seeded first user when DB is empty (see ``seed_auth.py``). */
export const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@gowthami.local'

const LOGIN_KIND = {
  pf: 'pf',
  platform: 'platform',
}

export default function PersonalFinanceAuth() {
  const navigate = useNavigate()
  const { refreshUser, invalidateSession } = usePfAuth()
  const [loginKind, setLoginKind] = useState(LOGIN_KIND.pf)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  function selectKind(kind) {
    setLoginKind(kind)
    setLoginError('')
    if (kind === LOGIN_KIND.platform && import.meta.env.DEV) {
      setLoginEmail(DEFAULT_SUPER_ADMIN_EMAIL)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    try {
      const data = await loginPf(loginEmail.trim(), loginPassword)
      setPfToken(data.access_token)
      setLoginPassword('')
      const u = await refreshUser()

      if (loginKind === LOGIN_KIND.platform) {
        if (String(u?.role || '').toUpperCase() !== 'SUPER_ADMIN') {
          invalidateSession()
          setLoginError('This account is not a platform super admin. Use “Personal finance” or ask an administrator.')
          return
        }
        navigate('/super-admin', { replace: true })
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed')
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Personal finance</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in with an account issued by your administrator. Public registration is disabled.
        </p>
      </div>

      <div className="flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-600 dark:bg-slate-800/50">
        <button
          type="button"
          onClick={() => selectKind(LOGIN_KIND.pf)}
          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
            loginKind === LOGIN_KIND.pf
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          Personal finance
        </button>
        <button
          type="button"
          onClick={() => selectKind(LOGIN_KIND.platform)}
          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
            loginKind === LOGIN_KIND.platform
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          Super admin
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {loginKind === LOGIN_KIND.pf
          ? 'For day-to-day finance: expenses, loans, net worth, and reports.'
          : 'For platform administration only: users, permissions, audit logs, backups. Requires SUPER_ADMIN role.'}
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="pf-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              id="pf-email"
              type="email"
              autoComplete="username"
              value={loginEmail}
              onChange={(ev) => setLoginEmail(ev.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="pf-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              id="pf-password"
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(ev) => setLoginPassword(ev.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
          </div>
          {loginError ? <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p> : null}
          {import.meta.env.DEV ? (
            <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Local seed super admin:</span>{' '}
              <code className="rounded bg-white px-1 dark:bg-slate-900">{DEFAULT_SUPER_ADMIN_EMAIL}</code> /{' '}
              <code className="rounded bg-white px-1 dark:bg-slate-900">ChangeMe!Admin123</code>
              {loginKind === LOGIN_KIND.platform ? (
                <span className="block pt-1 text-slate-500">Super admin tab pre-fills this email in development.</span>
              ) : null}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-[#004080] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
          >
            {loginKind === LOGIN_KIND.platform ? 'Sign in to platform admin' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
