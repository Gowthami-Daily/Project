/**
 * Mobile-first bottom sheet; on md+ can center as a dialog.
 */
import { pfModalHeader, pfModalOverlay65, pfModalSurface } from './pfFormStyles.js'

export default function PfBottomSheet({ open, title, onClose, children, className = '' }) {
  if (!open) return null
  return (
    <div
      className={`${pfModalOverlay65} flex flex-col justify-end md:items-center md:justify-end md:pb-0 ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Panel'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${pfModalSurface} flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden md:max-w-lg`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--pf-border)] md:hidden" />
        {title ? (
          <div className={`${pfModalHeader} !-mx-0 !-mt-0 !mb-0 rounded-none border-b md:rounded-t-[14px]`}>
            <h2 className="text-lg font-semibold text-[var(--pf-text)]">{title}</h2>
          </div>
        ) : null}
        <div className="max-h-[min(78dvh,640px)] min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
