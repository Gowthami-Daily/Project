/**
 * Dense table shell: sticky header, row hover, horizontal scroll on small screens.
 */
export default function DataTable({ children, className = '', dense = true }) {
  return (
    <div
      className={[
        '-mx-1 max-w-full overflow-x-auto',
        dense ? 'text-sm' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <table className="w-full min-w-[32rem] border-collapse">{children}</table>
    </div>
  )
}

export function DataTableHead({ children }) {
  return (
    <thead className="sticky top-0 z-[1] bg-[var(--pf-th-bg)] shadow-[0_1px_0_var(--pf-border)]">{children}</thead>
  )
}

export function DataTableBody({ children }) {
  return <tbody className="[&_tr]:border-b [&_tr]:border-[var(--pf-border)]/80">{children}</tbody>
}

export function DataTableRow({ children, className = '' }) {
  return (
    <tr className={['transition-colors hover:bg-[var(--pf-card-hover)]/60', className].filter(Boolean).join(' ')}>
      {children}
    </tr>
  )
}
