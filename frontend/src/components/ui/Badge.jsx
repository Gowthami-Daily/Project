/** @param {{ children: import('react').ReactNode, variant?: 'neutral' | 'success' | 'warning' | 'danger' }} props */
export default function StatusBadge({ children, variant = 'neutral' }) {
  const cls = {
    neutral: 'bg-[var(--pf-card-hover)] text-[var(--pf-text-muted)]',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
    danger: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  }[variant]
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  )
}
