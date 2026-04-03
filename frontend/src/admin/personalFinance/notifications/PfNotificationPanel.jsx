import { XMarkIcon } from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {import('./pfNotificationFeed.js').PfNotifItem[]} props.items
 * @param {boolean} props.loading
 */
export default function PfNotificationPanel({ onClose, items, loading }) {
  const navigate = useNavigate()

  function go(link) {
    onClose()
    navigate(link)
  }

  const priorityDot = (p) => {
    if (p === 'high') return 'bg-red-500'
    if (p === 'medium') return 'bg-amber-500'
    if (p === 'low') return 'bg-sky-500'
    return 'bg-[var(--pf-text-muted)]'
  }

  return (
    <motion.div
      key="pf-notif-layer"
      className="fixed inset-0 z-[200] flex justify-end"
      style={{ pointerEvents: 'auto' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <button
        type="button"
        aria-label="Close notifications"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] md:bg-black/30"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '104%' }}
        animate={{ x: 0 }}
        exit={{ x: '104%' }}
        transition={{ type: 'tween', duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-[1] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col border-l border-[var(--pf-border)] bg-[var(--pf-bg)] text-[var(--pf-text)] shadow-[-12px_0_40px_rgba(0,0,0,0.12)] dark:shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--pf-border)] px-4 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--pf-text)]">Notifications</h2>
            <p className="text-xs text-[var(--pf-text-muted)]">Reminders and alerts for your finances</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--pf-text-muted)] transition hover:bg-[var(--pf-card-hover)]"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--pf-border)] border-t-[var(--pf-primary)]"
                aria-hidden
              />
              <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
            </div>
          ) : items.length === 0 ? (
            <p className="flex flex-1 items-center px-2 py-8 text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              You&apos;re all caught up. We&apos;ll surface EMI due dates, card bills, and balance alerts here.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => go(it.link)}
                    className="flex w-full gap-3 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card)] px-3 py-3 text-left transition hover:border-[var(--pf-primary)]/40 hover:bg-[var(--pf-card-hover)]"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot(it.priority)}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--pf-text)]">{it.title}</span>
                      {it.subtitle ? (
                        <span className="mt-0.5 block text-xs text-[var(--pf-text-muted)]">{it.subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.aside>
    </motion.div>
  )
}
