/**
 * Gradient logistics-style KPI tile (icon, title, value, subtitle).
 */
export default function KpiCard({ icon: Icon, title, value, subtitle, gradientClass }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg ring-1 ring-black/5 ${gradientClass}`}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-sm">
          {Icon && <Icon className="h-6 w-6 text-white" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-white/90">{title}</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</p>
          {subtitle ? <p className="mt-1.5 text-xs leading-relaxed text-white/80">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  )
}
