import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadPfAppPrefs } from '../pfSettingsPrefs.js'

/** @typedef {'success' | 'error' | 'warning' | 'info' | 'neutral'} PfToastType */

/**
 * @typedef {{
 *   id: string,
 *   type: PfToastType,
 *   title: string,
 *   description?: string,
 *   duration?: number,
 * }} PfToastItem
 */

const PfToastContext = createContext(null)

let idSeq = 0
function nextId() {
  idSeq += 1
  return `pf-toast-${idSeq}`
}

function playSoftChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.value = 0.04
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.07)
    setTimeout(() => ctx.close?.(), 200)
  } catch {
    /* ignore */
  }
}

const typeStyles = {
  success: {
    border: 'border-emerald-500/35',
    bg: 'bg-emerald-500/10',
    icon: CheckCircleIcon,
    iconCls: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    icon: ExclamationCircleIcon,
    iconCls: 'text-red-600 dark:text-red-400',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    icon: ExclamationTriangleIcon,
    iconCls: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    border: 'border-sky-500/35',
    bg: 'bg-sky-500/10',
    icon: InformationCircleIcon,
    iconCls: 'text-sky-600 dark:text-sky-400',
  },
  neutral: {
    border: 'border-[var(--pf-border)]',
    bg: 'bg-[var(--pf-card)]',
    icon: InformationCircleIcon,
    iconCls: 'text-[var(--pf-text-muted)]',
  },
}

function ToastCard({ toast, onDismiss }) {
  const { type, title, description, duration = 4200 } = toast
  const cfg = typeStyles[type] || typeStyles.neutral
  const Icon = cfg.icon
  const closeTimer = useRef(null)
  const endAt = useRef(0)
  const paused = useRef(false)

  const clearTimer = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const schedule = useCallback(
    (ms) => {
      clearTimer()
      const t = Math.max(120, ms)
      endAt.current = Date.now() + t
      closeTimer.current = window.setTimeout(() => onDismiss(toast.id), t)
    },
    [clearTimer, onDismiss, toast.id],
  )

  useEffect(() => {
    paused.current = false
    schedule(duration)
    return () => clearTimer()
  }, [toast.id, duration, schedule, clearTimer])

  function onEnter() {
    if (paused.current) return
    paused.current = true
    clearTimer()
  }

  function onLeave() {
    if (!paused.current) return
    paused.current = false
    const left = Math.max(400, endAt.current - Date.now())
    schedule(left)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      role="status"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`pointer-events-auto flex max-w-[min(100vw-2rem,22rem)] gap-3 rounded-xl border px-3 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${cfg.border} ${cfg.bg} backdrop-blur-md`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.iconCls}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-[var(--pf-text)]">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--pf-text-muted)]">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg p-1 text-[var(--pf-text-muted)] transition hover:bg-black/10 hover:text-[var(--pf-text)] dark:hover:bg-white/10"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </motion.div>
  )
}

function ToastViewport({ toasts, onDismiss }) {
  const root = typeof document !== 'undefined' ? document.querySelector('.pf-app') || document.body : null
  if (!root) return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-[90] flex flex-col items-end gap-3 max-md:bottom-[calc(6.5rem+env(safe-area-inset-bottom))] max-md:right-3 md:bottom-24 md:right-6"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    root,
  )
}

export function PfToastProvider({ children }) {
  const [toasts, setToasts] = useState(/** @type {PfToastItem[]} */ ([]))

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (partial) => {
      const id = nextId()
      const type = partial.type || 'info'
      const item = {
        id,
        type,
        title: partial.title || '',
        description: partial.description,
        duration: partial.duration ?? (type === 'error' ? 6500 : type === 'warning' ? 5200 : 4200),
      }
      setToasts((prev) => [...prev.slice(-4), item])
      try {
        const prefs = loadPfAppPrefs()
        if (type === 'success' && prefs.notifications?.soundOnAction) {
          playSoftChime()
        }
      } catch {
        /* ignore */
      }
      return id
    },
    [],
  )

  const value = useMemo(
    () => ({
      toast: push,
      success: (title, description) => push({ type: 'success', title, description }),
      error: (title, description) => push({ type: 'error', title: title || 'Something went wrong', description }),
      warning: (title, description) => push({ type: 'warning', title, description }),
      info: (title, description) => push({ type: 'info', title, description }),
      neutral: (title, description) => push({ type: 'neutral', title, description }),
      dismiss,
    }),
    [dismiss, push],
  )

  return (
    <PfToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </PfToastContext.Provider>
  )
}

export function usePfToast() {
  const ctx = useContext(PfToastContext)
  if (!ctx) {
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      neutral: () => {},
      dismiss: () => {},
    }
  }
  return ctx
}
