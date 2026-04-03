/**
 * Aether glass surface — uses Personal Finance CSS tokens (--pf-*).
 */
export default function GlassCard({
  children,
  className = '',
  padding = 'default',
  hoverLift = true,
  as: Tag = 'div',
  ...rest
}) {
  const pad =
    padding === 'none'
      ? 'p-0'
      : padding === 'sm'
        ? 'p-4'
        : padding === 'lg'
          ? 'p-8'
          : 'p-6'
  const lift = hoverLift
    ? 'transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--pf-border)] dark:hover:border-white/20'
    : ''
  return (
    <Tag
      className={[
        'rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-card)]/90 shadow-[var(--pf-shadow)] backdrop-blur-[12px]',
        pad,
        lift,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  )
}
