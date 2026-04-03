/** Small KPI card — use with icon + label + value. */
export function StatCard({ icon: Icon, label, value, sub, className = '' }) {
  return (
    <div
      className={[
        'rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-[var(--pf-shadow)] backdrop-blur-md sm:p-5',
        'dark:border-[var(--pf-border)] dark:bg-white/[0.04]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {Icon ? (
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--pf-card-hover)] text-[var(--pf-primary)]">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <p className="mt-3 font-mono text-xl font-bold tabular-nums text-[var(--pf-text)] sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--pf-text-muted)]">{label}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">{sub}</p> : null}
    </div>
  )
}
