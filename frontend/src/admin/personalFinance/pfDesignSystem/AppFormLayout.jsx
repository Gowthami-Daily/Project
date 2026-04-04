/**
 * Responsive form grid: one column on small screens, two equal columns from `sm` up.
 * Use `AppFormFull` for notes / attachments spanning both columns.
 */
export function AppFormRow({ children, className = '' }) {
  return (
    <div className={['grid grid-cols-1 sm:grid-cols-2', className].filter(Boolean).join(' ')} style={{ gap: '16px' }}>
      {children}
    </div>
  )
}

export function AppFormFull({ children, className = '' }) {
  return <div className={['col-span-full min-w-0', className].filter(Boolean).join(' ')}>{children}</div>
}
