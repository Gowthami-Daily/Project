/**
 * Personal Finance app shell — desktop sidebar + topbar + scroll main + optional mobile bottom bar.
 */
export default function AppShell({ topbar, sidebar, children, bottomBar, className = '' }) {
  return (
    <div className={`flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden antialiased ${className}`}>
      {topbar}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:flex-row lg:items-stretch">
        {sidebar}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-[var(--pf-border)]/80 lg:border-l lg:bg-[var(--pf-content)]">
          {children}
        </div>
      </div>
      {bottomBar}
    </div>
  )
}
