import GlassCard from '../ui/GlassCard.jsx'

/** Compact numeric stat for dashboards. */
export default function StatCard({ label, value, hint, className = '' }) {
  return (
    <GlassCard padding="sm" className={className}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--pf-text)]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--pf-text-muted)]">{hint}</p> : null}
    </GlassCard>
  )
}
