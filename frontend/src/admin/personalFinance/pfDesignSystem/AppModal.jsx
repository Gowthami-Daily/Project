import { XMarkIcon } from '@heroicons/react/24/solid'
import { useEffect, useId } from 'react'
import { pfModalOverlay } from '../pfFormStyles.js'

/**
 personal-finance shell modal — glass surface + header / body / footer slots.
 */
export function AppModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-[480px]',
  className = '',
  bodyClassName = '',
  /** Wider modals (transfer, liabilities) scroll inside body */
  scrollBody = true,
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={pfModalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={[
          'pf-modal-surface pf-modal-surface--animate pf-ds-modal-glass flex max-h-[min(92dvh,900px)] w-full flex-col p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] md:rounded-2xl',
          maxWidthClass,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="mb-5 shrink-0 border-b border-[var(--pf-border)] pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="text-lg font-semibold tracking-tight text-[var(--pf-text)]">
                  {title}
                </h2>
              ) : null}
              {subtitle ? <p className="mt-1.5 text-sm leading-relaxed text-[var(--pf-text-muted)]">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--pf-text-muted)] opacity-80 transition hover:bg-[var(--pf-card-hover)] hover:opacity-100"
              aria-label="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </header>

        <div
          className={[
            'min-h-0 flex-1 text-[var(--pf-text)]',
            scrollBody ? 'overflow-y-auto overscroll-contain pr-1' : '',
            bodyClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>

        {footer ? (
          <footer className="mt-6 flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[var(--pf-border)] pt-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}
