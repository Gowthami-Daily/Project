/** Reusable glass / elevated surface for PF dashboards. */
export function GlassCard({ children, className = '', as: Comp = 'div', ...rest }) {
  return (
    <Comp
      className={[
        'rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[var(--pf-shadow)] backdrop-blur-md transition-all duration-200',
        'dark:border-[var(--pf-border)] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Comp>
  )
}
