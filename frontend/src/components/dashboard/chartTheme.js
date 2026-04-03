/** Recharts-friendly tooltip + grid styling using PF theme awareness. */

export function chartTooltipBox(isDark) {
  return {
    borderRadius: 12,
    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.06)',
    background: isDark ? 'rgba(15,15,15,0.92)' : 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.45)' : '0 8px 32px rgba(15,23,42,0.08)',
    color: isDark ? '#f4f4f5' : '#111827',
  }
}

export function chartAxisStroke(isDark) {
  return isDark ? '#71717a' : '#64748b'
}

export function chartGridStroke(isDark) {
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
}
