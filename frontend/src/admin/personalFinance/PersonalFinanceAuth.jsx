import { useState } from 'react'
import { loginPf, registerPf, setPfToken } from './api.js'

export default function PersonalFinanceAuth({ onSuccess }) {
  const [authMode, setAuthMode] = useState('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerPassword2, setRegisterPassword2] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerSubmitting, setRegisterSubmitting] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    try {
      const data = await loginPf(loginEmail.trim(), loginPassword)
      setPfToken(data.access_token)
      setLoginPassword('')
      onSuccess?.()
    } catch (err) {
      setLoginError(err.message || 'Login failed')
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setRegisterError('')
    if (registerPassword.length < 8) {
      setRegisterError('Password must be at least 8 characters.')
      return
    }
    if (registerPassword !== registerPassword2) {
      setRegisterError('Passwords do not match.')
      return
    }
    setRegisterSubmitting(true)
    try {
      await registerPf({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
      })
      const data = await loginPf(registerEmail.trim().toLowerCase(), registerPassword)
      setPfToken(data.access_token)
      setLoginEmail(registerEmail.trim().toLowerCase())
      setRegisterPassword('')
      setRegisterPassword2('')
      setRegisterName('')
      setRegisterEmail('')
      setAuthMode('login')
      onSuccess?.()
    } catch (err) {
      setRegisterError(err.message || 'Could not create account')
    } finally {
      setRegisterSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Personal finance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to view your profiles, net worth, and cashflow (multi-profile).
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login')
              setLoginError('')
              setRegisterError('')
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              authMode === 'login' ? 'bg-white text-[#004080] shadow-sm' : 'text-slate-600'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register')
              setLoginError('')
              setRegisterError('')
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              authMode === 'register' ? 'bg-white text-[#004080] shadow-sm' : 'text-slate-600'
            }`}
          >
            Create account
          </button>
        </div>

        {authMode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="pf-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="pf-email"
                type="email"
                autoComplete="username"
                value={loginEmail}
                onChange={(ev) => setLoginEmail(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="pf-password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="pf-password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(ev) => setLoginPassword(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2"
                required
              />
            </div>
            {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
            {import.meta.env.DEV ? (
              <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Local demo:</span>{' '}
                finance.demo@example.com / FinanceDemo123!
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-[#004080] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
            >
              Sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <p className="text-xs text-slate-500">
              Creates your login and a personal finance profile on the server. Use a real email domain (e.g.{' '}
              <code className="rounded bg-slate-100 px-1">@gmail.com</code>) — not{' '}
              <code className="rounded bg-slate-100 px-1">.local</code>.
            </p>
            <div>
              <label htmlFor="pf-reg-name" className="block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                id="pf-reg-name"
                type="text"
                autoComplete="name"
                value={registerName}
                onChange={(ev) => setRegisterName(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2"
                required
                maxLength={100}
              />
            </div>
            <div>
              <label htmlFor="pf-reg-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="pf-reg-email"
                type="email"
                autoComplete="email"
                value={registerEmail}
                onChange={(ev) => setRegisterEmail(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2"
                placeholder="you@gmail.com"
                required
              />
            </div>
            <div>
              <label htmlFor="pf-reg-pass" className="block text-sm font-medium text-slate-700">
                Password (min 8 characters)
              </label>
              <input
                id="pf-reg-pass"
                type="password"
                autoComplete="new-password"
                value={registerPassword}
                onChange={(ev) => setRegisterPassword(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2"
                required
                minLength={8}
              />
            </div>
            <div>
              <label htmlFor="pf-reg-pass2" className="block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input
                id="pf-reg-pass2"
                type="password"
                autoComplete="new-password"
                value={registerPassword2}
                onChange={(ev) => setRegisterPassword2(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2"
                required
                minLength={8}
              />
            </div>
            {registerError ? <p className="text-sm text-red-600">{registerError}</p> : null}
            <button
              type="submit"
              disabled={registerSubmitting}
              className="w-full rounded-xl bg-[#004080] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366] disabled:opacity-60"
            >
              {registerSubmitting ? 'Creating account…' : 'Create account & sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
