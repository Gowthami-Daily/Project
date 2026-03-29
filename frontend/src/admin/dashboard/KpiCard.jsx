/**
 * KPI tile: layered card on mobile (theme tokens in dark), gradient on md+.
 */
export default function KpiCard({
  icon: Icon,
  title,
  value,
  subtitle,
  gradientClass,
  iconTintClass,
  wrapperClassName,
}) {
  const tint =
    iconTintClass ?? 'bg-slate-100 text-[#1E3A8A] dark:bg-[var(--pf-card-hover)] dark:text-[var(--pf-primary)]'
  const wrap = wrapperClassName ?? ''
  return (
    <div
      className={`relative overflow-hidden rounded-[14px] border border-slate-200/70 bg-white p-4 text-slate-900 shadow-[var(--pf-shadow)] ring-1 ring-slate-100/80 transition-all duration-200 will-change-transform hover:shadow-[var(--pf-shadow-hover)] active:scale-[0.99] dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)] dark:text-[var(--pf-text)] dark:shadow-[var(--pf-shadow)] dark:ring-[var(--pf-border)]/40 dark:hover:bg-[var(--pf-card-hover)] md:rounded-[14px] md:border-0 md:bg-gradient-to-br md:p-5 md:text-white md:shadow-lg md:ring-1 md:ring-black/10 md:hover:shadow-xl md:hover:brightness-[1.04] dark:md:ring-white/10 ${gradientClass} ${wrap}`}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 hidden h-24 w-24 rounded-full bg-white/10 blur-2xl md:block"
        aria-hidden
      />
      <div className="relative flex items-start gap-3 md:gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner md:h-12 md:w-12 md:rounded-2xl md:bg-white/20 md:text-white md:backdrop-blur-sm ${tint}`}
        >
          {Icon && <Icon className="h-[22px] w-[22px] md:h-6 md:w-6" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-snug text-slate-500 dark:text-[var(--pf-text-muted)] md:text-sm md:font-medium md:text-white/90 md:dark:text-white/90">
            {title}
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-[var(--pf-text)] sm:text-3xl md:mt-2 md:text-2xl md:text-white md:dark:text-white">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-[var(--pf-text-muted)] md:mt-1.5 md:text-xs md:text-white/80 md:dark:text-white/80">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
