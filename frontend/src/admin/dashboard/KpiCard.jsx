/**
 * KPI tile: fintech-style white card on mobile, gradient on md+.
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
  const tint = iconTintClass ?? 'bg-slate-100 text-[#1E3A8A]'
  const wrap = wrapperClassName ?? ''
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 text-slate-900 shadow-[0_2px_16px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 transition duration-200 will-change-transform hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)] active:scale-[0.99] md:rounded-3xl md:border-0 md:bg-gradient-to-br md:p-5 md:text-white md:shadow-lg md:ring-1 md:ring-black/5 md:hover:shadow-xl ${gradientClass} ${wrap}`}
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
          <p className="text-xs font-semibold leading-snug text-slate-500 md:text-sm md:font-medium md:text-white/90">
            {title}
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums tracking-tight text-slate-900 md:mt-2 md:text-2xl md:text-white sm:text-3xl">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 md:mt-1.5 md:text-xs md:text-white/80">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
