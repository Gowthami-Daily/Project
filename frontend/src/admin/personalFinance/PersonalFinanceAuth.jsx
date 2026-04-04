import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import RiverLogo from '../RiverLogo.jsx'
import { fetchPfMe, loginPf, setPfToken } from './api.js'
import LoginSuccessAnimation from './LoginSuccessAnimation.jsx'
import { consumeFirstLoginConfettiForToday } from './pfLoginCelebrationStorage.js'
import { usePfAuth } from './PfAuthContext.jsx'
import LoginShootingStars from './LoginShootingStars.jsx'
import './loginAuthMotion.css'

/** Seeded first user when DB is empty (see ``seed_auth.py``). */
export const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@gowthami.local'

const LOGIN_KIND = {
  pf: 'pf',
  platform: 'platform',
}

const FORM_MAX_W = 'max-w-[420px]'

const inputCls =
  'pf-login-input h-11 w-full rounded-[11px] border border-white/10 bg-white/[0.06] px-3.5 text-[15px] text-white placeholder:text-slate-500 outline-none transition-colors'

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-slate-300'

function shortDisplayNameFromUser(u, emailFallback) {
  const raw = (u?.name || '').trim()
  if (raw) {
    const parts = raw.split(/\s+/).filter(Boolean)
    return parts[0] || 'there'
  }
  const local = (emailFallback || '').split('@')[0]?.trim()
  return local || 'there'
}

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
  const reduceMotion = useReducedMotion()
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
  const [cardShake, setCardShake] = useState(false)
  const [celebration, setCelebration] = useState(null)

  const dismissToast = useCallback(() => setToastMessage(null), [])

  const triggerAuthShake = useCallback(() => {
    setCardShake(true)
    window.setTimeout(() => setCardShake(false), 480)
  }, [])

  const finishLoginCelebration = useCallback(async () => {
    setCelebration(null)
    try {
      await refreshUser()
    } catch {
      /* session restore can retry from shell */
    }
    navigate('/personal-finance', { replace: true })
  }, [navigate, refreshUser])

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
      const u = await fetchPfMe()

      if (loginKind === LOGIN_KIND.platform) {
        if (String(u?.role || '').toUpperCase() !== 'SUPER_ADMIN') {
          invalidateSession()
          const msg =
            'This account is not a platform super admin. Use “Personal finance” or ask an administrator.'
          setLoginError(msg)
          setToastMessage(msg)
          triggerAuthShake()
          return
        }
        await refreshUser()
        navigate('/super-admin', { replace: true })
        return
      }

      const firstLoginToday = consumeFirstLoginConfettiForToday()
      setCelebration({
        displayName: shortDisplayNameFromUser(u, loginEmail.trim()),
        playConfetti: firstLoginToday && !reduceMotion,
      })
    } catch (err) {
      const msg = err.message || 'Login failed'
      setLoginError(msg)
      setToastMessage(msg)
      triggerAuthShake()
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

  const starSpeedBoost = loading || !!celebration

  return (
    <div className="relative min-h-[100dvh] overflow-hidden text-slate-100">
      <div className="pf-login-bg-radial pointer-events-none absolute inset-0 z-0" />
      <LoginShootingStars speedMultiplier={starSpeedBoost ? 2.5 : 1} reducedMotion={!!reduceMotion} />
      <div className="pf-login-stars-overlay absolute inset-0 z-[2]" />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_90%_70%_at_100%_0%,rgba(99,102,241,0.08),transparent)]" />

      <AnimatePresence>
        {toastMessage ? (
          <LoginToast key={toastMessage} message={toastMessage} onDismiss={dismissToast} />
        ) : null}
      </AnimatePresence>

      {celebration ? (
        <LoginSuccessAnimation
          key="pf-login-celebration"
          displayName={celebration.displayName}
          playConfetti={celebration.playConfetti}
          onDone={finishLoginCelebration}
        />
      ) : null}

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

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <Link
          to="/"
          className="absolute left-4 top-4 text-sm font-semibold text-slate-500 transition-colors duration-150 hover:text-white sm:left-6 sm:top-6"
        >
          ← Back to home
        </Link>

        <div className={`relative w-full ${FORM_MAX_W}`}>
          <div className="pf-login-card-back-glow" aria-hidden />

          <motion.div
            className="relative z-[1] mb-8 text-center"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
              <RiverLogo className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-2xl">Personal Finance OS</h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400/90">Track · Analyze · Grow</p>
            <p className="mx-auto mt-4 max-w-sm text-sm text-slate-400">
              {loginKind === LOGIN_KIND.pf
                ? 'Sign in to your dashboard'
                : 'Platform administration — super admin only'}
            </p>
          </motion.div>

            <motion.div
              className="relative z-[1] mb-6 flex rounded-[11px] border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.38, delay: reduceMotion ? 0 : 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="absolute bottom-1 top-1 z-0 w-[calc(50%-4px)] rounded-[9px] bg-white/15 shadow-sm"
                initial={false}
                animate={{
                  left: loginKind === LOGIN_KIND.pf ? 4 : 'calc(50% + 2px)',
                }}
                transition={
                  reduceMotion
                    ? { duration: 0.15 }
                    : { type: 'spring', stiffness: 420, damping: 34 }
                }
              />
              <button
                type="button"
                disabled={loading || !!celebration}
                onClick={() => selectKind(LOGIN_KIND.pf)}
                className={`relative z-10 flex-1 rounded-[9px] py-2 text-xs font-bold transition-colors duration-150 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                  loginKind === LOGIN_KIND.pf ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Personal finance
              </button>
              <button
                type="button"
                disabled={loading || !!celebration}
                onClick={() => selectKind(LOGIN_KIND.platform)}
                className={`relative z-10 flex-1 rounded-[9px] py-2 text-xs font-bold transition-colors duration-150 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                  loginKind === LOGIN_KIND.platform ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Platform admin
              </button>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.99 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                x: cardShake && !reduceMotion ? [0, -5, 5, -3, 3, 0] : 0,
              }}
              transition={{
                opacity: { duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] },
                y: { duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] },
                scale: { duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] },
                x: { duration: reduceMotion ? 0 : 0.38, ease: 'easeOut' },
              }}
              className="relative z-[1] pf-login-card-glow rounded-2xl border border-white/10 bg-[rgba(18,23,34,0.55)] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8"
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
                    disabled={loading || !!celebration}
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
                      disabled={loading || !!celebration}
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
                      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <motion.span
                        key={showPassword ? 'hide' : 'show'}
                        initial={{ opacity: 0.6, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18 }}
                        className="inline-flex"
                      >
                        {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </motion.span>
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

                <div className="flex items-center gap-3 select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rememberMe}
                    onClick={() => setRememberMe((v) => !v)}
                    className="pf-login-switch"
                    disabled={loading || !!celebration}
                  >
                    <span className="pf-login-switch-thumb" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="text-left text-[13px] font-medium text-slate-400 transition-colors duration-150 hover:text-slate-300"
                    onClick={() => !(loading || celebration) && setRememberMe((v) => !v)}
                  >
                    Remember me on this device
                  </button>
                </div>

                {loginError && !fieldErrors.email && !fieldErrors.password ? (
                  <p className="text-[13px] font-medium text-red-400" role="alert">
                    {loginError}
                  </p>
                ) : null}

                <motion.button
                  type="submit"
                  disabled={loading || !!celebration}
                  whileTap={reduceMotion || loading || celebration ? undefined : { scale: 0.985 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                  className="pf-login-submit-gradient flex h-11 w-full items-center justify-center gap-2 rounded-[11px] text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
                </motion.button>
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

          {import.meta.env.DEV ? (
            <p className="relative z-[1] mt-6 rounded-xl border border-amber-500/25 bg-amber-950/25 p-3 text-center text-[11px] leading-relaxed text-amber-100/90">
              <span className="font-bold text-amber-200">Dev seed:</span>{' '}
              <code className="rounded bg-black/35 px-1">{DEFAULT_SUPER_ADMIN_EMAIL}</code> /{' '}
              <code className="rounded bg-black/35 px-1">ChangeMe!Admin123</code>
              <span className="mt-1 block text-amber-200/70">Platform tab pre-fills this email.</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
