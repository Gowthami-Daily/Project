import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import RiverLogo from '../RiverLogo.jsx'
import { loginPf, setPfToken } from './api.js'
import { usePfAuth } from './PfAuthContext.jsx'

/** Seeded first user when DB is empty (see ``seed_auth.py``). */
export const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@gowthami.local'

const LOGIN_KIND = {
  pf: 'pf',
  platform: 'platform',
}

const FORM_MAX_W = 'max-w-[420px]'

const inputCls =
  'h-11 w-full rounded-[11px] border border-white/10 bg-white/[0.06] px-3.5 text-[15px] text-white placeholder:text-slate-500 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/25'

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-slate-300'

const features = [
  'Track expenses & income',
  'Manage loans & EMIs',
  'Monitor credit cards',
  'Track investments & assets',
  'See your net worth',
  'Generate financial reports',
]

function LoginToast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5200)
    return () => clearTimeout(t)
  }, [onDismiss, message])

  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
      className="fixed bottom-8 left-1/2 z-[100] w-[min(100vw-2rem,400px)] -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-3 text-sm font-medium text-red-100 shadow-2xl shadow-black/40 backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <span>{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold text-red-200/90 hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  )
}

export default function PersonalFinanceAuth() {
  const navigate = useNavigate()
  const { refreshUser, invalidateSession } = usePfAuth()
  const [loginKind, setLoginKind] = useState(LOGIN_KIND.pf)
  const [loginEmail, setLoginEmail] = useState(() => {
    try {
      if (typeof localStorage === 'undefined') return ''
      return localStorage.getItem('pf_saved_login_email') || ''
    } catch {
      return ''
    }
  })
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem('pf_remember_email') === '1'
    } catch {
      return false
    }
  })
  const [loading, setLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [infoModal, setInfoModal] = useState(null)

  const dismissToast = useCallback(() => setToastMessage(null), [])

  function selectKind(kind) {
    setLoginKind(kind)
    setLoginError('')
    setFieldErrors({})
    dismissToast()
    if (kind === LOGIN_KIND.platform && import.meta.env.DEV) {
      setLoginEmail(DEFAULT_SUPER_ADMIN_EMAIL)
    }
  }

  function validateForm() {
    const next = {}
    const email = loginEmail.trim()
    if (!email) next.email = 'Enter your email address'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address'
    if (!loginPassword) next.password = 'Enter your password'
    return next
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    dismissToast()
    const v = validateForm()
    if (Object.keys(v).length) {
      setFieldErrors(v)
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      const data = await loginPf(loginEmail.trim(), loginPassword)
      setPfToken(data.access_token)
      setLoginPassword('')
      try {
        if (rememberMe && loginKind === LOGIN_KIND.pf) {
          localStorage.setItem('pf_remember_email', '1')
          localStorage.setItem('pf_saved_login_email', loginEmail.trim())
        } else {
          localStorage.removeItem('pf_remember_email')
          localStorage.removeItem('pf_saved_login_email')
        }
      } catch {
        /* ignore */
      }
      const u = await refreshUser()

      if (loginKind === LOGIN_KIND.platform) {
        if (String(u?.role || '').toUpperCase() !== 'SUPER_ADMIN') {
          invalidateSession()
          const msg =
            'This account is not a platform super admin. Use “Personal finance” or ask an administrator.'
          setLoginError(msg)
          setToastMessage(msg)
          return
        }
        navigate('/super-admin', { replace: true })
      }
    } catch (err) {
      const msg = err.message || 'Login failed'
      setLoginError(msg)
      setToastMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  const onPasswordKey = (ev) => {
    try {
      setCapsLockOn(ev.getModifierState('CapsLock'))
    } catch {
      setCapsLockOn(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_0%_0%,rgba(56,189,248,0.14),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_100%,rgba(99,102,241,0.12),transparent)]" />

      <AnimatePresence>
        {toastMessage ? (
          <LoginToast key={toastMessage} message={toastMessage} onDismiss={dismissToast} />
        ) : null}
      </AnimatePresence>

      {infoModal ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pf-auth-info-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl">
            <h2 id="pf-auth-info-title" className="text-lg font-bold text-white">
              {infoModal.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{infoModal.body}</p>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="mt-6 w-full rounded-[11px] bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-[100dvh] flex-col lg:flex-row">
        {/* Left — branding */}
        <aside className="relative flex flex-col justify-between border-b border-white/10 bg-gradient-to-br from-slate-900/95 via-indigo-950/40 to-slate-950 px-6 py-8 sm:px-10 sm:py-10 lg:w-[min(520px,44vw)] lg:border-b-0 lg:border-r lg:py-14">
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:32px_32px]" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
                <RiverLogo className="h-6 w-6 text-white" />
              </span>
              <div>
                <p className="text-lg font-bold tracking-tight text-white">Personal Finance OS</p>
                <p className="text-sm font-medium text-sky-300/90">Track. Analyze. Grow.</p>
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-xs leading-relaxed text-slate-400 sm:mt-8 sm:space-y-2.5 sm:text-sm">
              {features.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-0.5 text-sky-400/80" aria-hidden>
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md sm:mt-10">
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400/90" aria-hidden />
              <p className="text-xs leading-relaxed text-slate-400">
                Your financial data is private and secure. Sign in with credentials issued by your administrator.
              </p>
            </div>

            {import.meta.env.DEV ? (
              <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-950/30 p-3 text-[11px] leading-relaxed text-amber-100/90">
                <span className="font-bold text-amber-200">Dev seed:</span>{' '}
                <code className="rounded bg-black/30 px-1">{DEFAULT_SUPER_ADMIN_EMAIL}</code> /{' '}
                <code className="rounded bg-black/30 px-1">ChangeMe!Admin123</code>
                <span className="mt-1 block text-amber-200/70">Platform tab pre-fills this email.</span>
              </p>
            ) : null}
          </div>

          <div className="relative mt-8 lg:mt-0">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm font-semibold text-slate-400 transition hover:text-white"
            >
              ← Back to home
            </Link>
          </div>
        </aside>

        {/* Right — form */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 lg:py-14">
          <div className={`w-full ${FORM_MAX_W}`}>
            <div className="mb-8 lg:mb-10">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-400">
                {loginKind === LOGIN_KIND.pf
                  ? 'Login to your Personal Finance dashboard'
                  : 'Platform administration — super admin only'}
              </p>
            </div>

            <div className="mb-6 flex rounded-[11px] border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => selectKind(LOGIN_KIND.pf)}
                className={`flex-1 rounded-[9px] py-2 text-xs font-bold transition sm:text-sm ${
                  loginKind === LOGIN_KIND.pf
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Personal finance
              </button>
              <button
                type="button"
                onClick={() => selectKind(LOGIN_KIND.platform)}
                className={`flex-1 rounded-[9px] py-2 text-xs font-bold transition sm:text-sm ${
                  loginKind === LOGIN_KIND.platform
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Platform admin
              </button>
            </div>

            <motion.div
              initial={false}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8"
            >
              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="pf-email" className={labelCls}>
                    Email address
                  </label>
                  <input
                    id="pf-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    value={loginEmail}
                    onChange={(ev) => {
                      setLoginEmail(ev.target.value)
                      setFieldErrors((prev) => {
                        if (!prev.email) return prev
                        const next = { ...prev }
                        delete next.email
                        return next
                      })
                    }}
                    className={`${inputCls} ${fieldErrors.email ? 'border-red-500/40 focus:ring-red-500/20' : ''}`}
                    placeholder="you@example.com"
                    disabled={loading}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'pf-email-err' : undefined}
                  />
                  {fieldErrors.email ? (
                    <p id="pf-email-err" className="mt-1.5 text-[13px] font-medium text-red-400">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="pf-password" className={labelCls}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="pf-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(ev) => {
                        setLoginPassword(ev.target.value)
                        setFieldErrors((prev) => {
                          if (!prev.password) return prev
                          const next = { ...prev }
                          delete next.password
                          return next
                        })
                      }}
                      onKeyDown={onPasswordKey}
                      onKeyUp={onPasswordKey}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => {
                        setPasswordFocused(false)
                        setCapsLockOn(false)
                      }}
                      className={`${inputCls} pr-12 ${fieldErrors.password ? 'border-red-500/40 focus:ring-red-500/20' : ''}`}
                      placeholder="••••••••"
                      disabled={loading}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={
                        [fieldErrors.password ? 'pf-password-err' : null, passwordFocused && capsLockOn ? 'pf-caps' : null]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {passwordFocused && capsLockOn ? (
                    <p id="pf-caps" className="mt-1.5 text-[13px] font-medium text-amber-400/90">
                      Caps Lock is on
                    </p>
                  ) : null}
                  {fieldErrors.password ? (
                    <p id="pf-password-err" className="mt-1.5 text-[13px] font-medium text-red-400">
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(ev) => setRememberMe(ev.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-sky-500 focus:ring-sky-500/40"
                    disabled={loading}
                  />
                  <span className="text-[13px] font-medium text-slate-400">Remember me on this device</span>
                </label>

                {loginError && !fieldErrors.email && !fieldErrors.password ? (
                  <p className="text-[13px] font-medium text-red-400" role="alert">
                    {loginError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                        aria-hidden
                      />
                      Signing in…
                    </>
                  ) : loginKind === LOGIN_KIND.platform ? (
                    'Sign in to platform admin'
                  ) : (
                    'Login to Dashboard'
                  )}
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 text-center text-[13px]">
                <button
                  type="button"
                  onClick={() =>
                    setInfoModal({
                      title: 'Forgot password?',
                      body: 'Password resets are managed by your administrator. Contact them to regain access to your account.',
                    })
                  }
                  className="font-semibold text-sky-400 transition hover:text-sky-300"
                >
                  Forgot password?
                </button>
                <p className="text-slate-500">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() =>
                      setInfoModal({
                        title: 'Create account',
                        body: 'Public registration is disabled. Ask your administrator to create an account for you.',
                      })
                    }
                    className="font-semibold text-slate-300 underline-offset-2 hover:text-white hover:underline"
                  >
                    Create account
                  </button>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
