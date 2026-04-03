/**
 * Glass KPI tile — muted gradient tint + blur (premium fintech).
 * Supports `tint` presets (Personal Finance) or legacy `gradientClass` (other admin dashboards).
 */

const TINT_LAYER = {
  violet: 'from-violet-500/35 via-violet-600/12 to-transparent',
  blue: 'from-sky-500/35 via-blue-600/12 to-transparent',
  indigo: 'from-indigo-500/35 via-indigo-600/12 to-transparent',
  cyan: 'from-cyan-500/35 via-sky-600/12 to-transparent',
  rose: 'from-rose-500/35 via-rose-600/12 to-transparent',
  amber: 'from-amber-500/35 via-orange-500/12 to-transparent',
  emerald: 'from-emerald-500/35 via-teal-600/12 to-transparent',
  slate: 'from-slate-500/25 via-slate-600/10 to-transparent',
  orange: 'from-orange-500/35 via-red-500/10 to-transparent',
  red: 'from-red-500/35 via-rose-600/12 to-transparent',
  fuchsia: 'from-fuchsia-500/35 via-purple-600/12 to-transparent',
  purple: 'from-purple-500/35 via-violet-700/12 to-transparent',
  teal: 'from-teal-500/35 via-cyan-600/12 to-transparent',
  lime: 'from-lime-500/35 via-green-600/12 to-transparent',
  yellow: 'from-yellow-500/35 via-amber-600/12 to-transparent',
  green: 'from-green-600/35 via-emerald-700/12 to-transparent',
  sky: 'from-sky-500/35 via-blue-700/12 to-transparent',
  pink: 'from-pink-500/35 via-rose-600/12 to-transparent',
}

export default function KpiCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trendLabel,
  /** @type {keyof typeof TINT_LAYER | undefined} */
  tint,
  /** Full Tailwind gradient utilities, e.g. `bg-gradient-to-br from-emerald-600 to-teal-800` */
  gradientClass,
  iconTintClass,
  wrapperClassName,
  /** Larger hero tile (e.g. primary metric) */
  size,
  /**
   * Icon + title row, then full-width value — avoids clipped amounts in tight multi-column grids.
   */
  stacked = false,
}) {
  const wrap = wrapperClassName ?? ''
  const isHero = size === 'hero'
  const usesTint = Boolean(tint && TINT_LAYER[tint] != null)
  const overlay = usesTint
    ? `bg-gradient-to-br ${TINT_LAYER[tint]}`
    : gradientClass || `bg-gradient-to-br ${TINT_LAYER.slate}`

  const legacyFade = !usesTint && gradientClass ? 'opacity-[0.4] dark:opacity-[0.48]' : ''

  const iconBox =
    iconTintClass ??
    'border-black/[0.06] bg-black/[0.04] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white'

  return (
    <div
      className={[
        'group relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-[var(--pf-shadow)] backdrop-blur-[16px] transition-all duration-200',
        'border-black/[0.07] bg-white/65 hover:-translate-y-[3px] hover:border-black/12 hover:shadow-xl',
        'dark:border-white/[0.09] dark:bg-white/[0.04] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] dark:hover:border-white/[0.18] dark:hover:shadow-[0_10px_25px_rgba(0,0,0,0.25)]',
        'active:scale-[0.99]',
        isHero ? 'p-6' : 'p-5',
        wrap,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={`pointer-events-none absolute inset-0 ${overlay} ${legacyFade}`} aria-hidden />
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/25 blur-2xl dark:bg-white/10"
        aria-hidden
      />
      {stacked ? (
        <div className="relative flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex ${isHero ? 'h-10 w-10' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-[1.03] ${iconBox}`}
            >
              {Icon && <Icon className={isHero ? 'h-5 w-5' : 'h-5 w-5'} aria-hidden />}
            </div>
            <p className="min-w-0 flex-1 pt-0.5 text-[12px] font-semibold uppercase leading-snug tracking-wide text-slate-600/90 dark:text-white/70">
              {title}
            </p>
          </div>
          <p
            className={`w-full min-w-0 break-words font-mono font-bold leading-snug tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-lg ${isHero ? 'text-xl sm:text-2xl' : 'text-base'}`}
          >
            {value}
          </p>
          {subtitle ? (
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-white/75">{subtitle}</p>
          ) : null}
          {trendLabel ? (
            <p className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-white/85">{trendLabel}</p>
          ) : null}
        </div>
      ) : (
        <div className="relative flex flex-1 items-start gap-4">
          <div
            className={`flex ${isHero ? 'h-12 w-12' : 'h-11 w-11'} shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-[1.03] ${iconBox}`}
          >
            {Icon && <Icon className={isHero ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-600/90 dark:text-white/70">{title}</p>
            <p
              className={`mt-1 font-mono font-bold leading-tight tracking-tight text-slate-900 tabular-nums dark:text-white ${isHero ? 'text-2xl sm:text-[1.75rem]' : 'text-xl sm:text-[1.65rem]'}`}
            >
              {value}
            </p>
            {subtitle ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-white/75">{subtitle}</p>
            ) : null}
            {trendLabel ? (
              <p className="mt-2 text-[11px] font-semibold tabular-nums text-slate-700 dark:text-white/85">{trendLabel}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
