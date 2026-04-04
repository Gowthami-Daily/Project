/**
 * Underline-style tabs — `tabs`: `{ id: string, label: string }[]`.
 */
export function AppTabs({ tabs, value, onChange, className = '', ariaLabel = 'Sections' }) {
  return (
    <div
      className={['flex gap-2 border-b border-[var(--pf-border)]', className].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={[
              'relative -mb-px border-b-2 px-3 pb-3 text-[13px] font-medium transition-colors',
              active
                ? 'border-[var(--pf-primary)] text-[var(--pf-text)]'
                : 'border-transparent text-[var(--pf-text-muted)] hover:text-[var(--pf-text)]',
            ].join(' ')}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
