/**
 * Page-level hero title (Aether).
 */
export function PageHeader({ title, description, action, className = '', titleClassName = '' }) {
  const h1Cls =
    titleClassName ||
    'text-xl font-semibold tracking-tight text-[var(--pf-text)] sm:text-2xl md:text-[1.75rem] md:leading-tight'
  return (
    <header
      className={[
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0">
        <h1 className={h1Cls}>{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-[var(--pf-text-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

/**
 * Card / section title.
 */
export function SectionHeader({ title, subtitle, action, className = '' }) {
  return (
    <div
      className={[
        'mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div>
        <h2 className="text-base font-semibold text-[var(--pf-text)]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
