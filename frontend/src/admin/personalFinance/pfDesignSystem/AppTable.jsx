import { pfTable, pfTableWrap } from '../pfFormStyles.js'

/**
 * Table shell: rounded border wrapper, horizontal scroll, sticky thead via `.ds-app-table`.
 * Pass `<thead>…</thead>` and `<tbody>…</tbody>` as children.
 */
export function AppTable({ children, className = '', tableClassName = '', footer = null }) {
  return (
    <div className={[pfTableWrap, className].filter(Boolean).join(' ')}>
      <table className={[pfTable, 'ds-app-table', tableClassName].filter(Boolean).join(' ')}>{children}</table>
      {footer ? (
        <div className="border-t border-[var(--pf-border)] px-4 py-3 text-[13px] text-[var(--pf-text-muted)]">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
