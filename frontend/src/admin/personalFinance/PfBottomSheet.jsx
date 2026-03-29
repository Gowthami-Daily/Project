/**
 * Mobile-first bottom sheet; on sm+ can be used as centered panel via className override.
 */
export default function PfBottomSheet({ open, title, onClose, children, className = '' }) {
  if (!open) return null
  return (
    <div
      className={`fixed inset-0 z-[65] flex flex-col justify-end bg-slate-900/45 backdrop-blur-sm md:items-center md:justify-end md:pb-0 ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Panel'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="pf-sheet-panel max-h-[min(92dvh,720px)] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.15)] md:max-w-lg md:rounded-2xl md:shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 md:hidden" />
        {title ? (
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
        ) : null}
        <div className="max-h-[min(78dvh,640px)] overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
