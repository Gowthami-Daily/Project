import { XMarkIcon } from '@heroicons/react/24/solid'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId } from 'react'
import { pfModalOverlay } from '../pfFormStyles.js'

const pfEase = [0.4, 0, 0.2, 1]
const pfEaseIn = [0.4, 0, 1, 1]

/**
 * Design-system modal: centered, max 720px desktop, full-screen mobile, fixed header/footer, scrollable body.
 * Overlay + panel use Framer Motion (fade + scale) for enter/exit.
 */
export function AppModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-[720px]',
  className = '',
  bodyClassName = '',
  scrollBody = true,
}) {
  const titleId = useId()
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const panelClass = [
    'pf-modal-surface pf-modal-surface--flex pf-ds-modal-glass flex w-full min-w-0 flex-col shadow-[var(--pf-modal-shadow)] min-[641px]:rounded-2xl',
    maxWidthClass,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const bodyClasses = [
    'min-h-0 flex-1 px-6 text-[13px] text-[var(--pf-text)]',
    scrollBody ? 'overflow-y-auto overscroll-contain py-4' : 'py-4',
    bodyClassName,
  ]
    .filter(Boolean)
    .join(' ')

  const headerBlock = (
    <header className="shrink-0 border-b border-[var(--pf-border)] px-6 pb-4 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {title ? (
            <h2 id={titleId} className="ds-section-title tracking-tight">
              {title}
            </h2>
          ) : null}
          {subtitle ? <p className="mt-2 text-[12px] leading-relaxed text-[var(--pf-text-muted)]">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[10px] p-2 text-[var(--pf-text-muted)] opacity-80 transition hover:bg-[var(--pf-card-hover)] hover:opacity-100"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </header>
  )

  const footerBlock = footer ? (
    <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--pf-border)] bg-[var(--pf-modal-footer-bg)] px-6 pb-6 pt-4 max-[640px]:pb-[max(1.5rem,env(safe-area-inset-bottom))] min-[641px]:flex-row min-[641px]:flex-wrap min-[641px]:items-center min-[641px]:justify-end min-[641px]:gap-3 [&_button]:w-full [&_button]:min-h-10 min-[641px]:[&_button]:w-auto min-[641px]:[&_button]:min-h-10">
      {footer}
    </footer>
  ) : null

  if (reduceMotion) {
    return open ? (
      <div
        className={pfModalOverlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <div className={panelClass} onMouseDown={(e) => e.stopPropagation()}>
          {headerBlock}
          <div className={bodyClasses}>{children}</div>
          {footerBlock}
        </div>
      </div>
    ) : null
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pf-app-modal-root"
          className={pfModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15, ease: pfEaseIn } }}
          transition={{ duration: 0.18, ease: pfEase }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            className={panelClass}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.2, ease: pfEaseIn } }}
            transition={{ duration: 0.26, ease: pfEase }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {headerBlock}
            <div className={bodyClasses}>{children}</div>
            {footerBlock}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
