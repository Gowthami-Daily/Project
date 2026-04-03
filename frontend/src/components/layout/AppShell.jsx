/**
 * Personal Finance app shell — desktop sidebar + topbar + scroll main + optional mobile bottom bar.
 */
export default function AppShell({ topbar, sidebar, children, bottomBar, className = '' }) {
  return (
    <div className={`flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden antialiased ${className}`}>
      {topbar}
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col md:flex-row md:items-stretch">
        {sidebar}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-[var(--pf-border)]/80 md:border-l md:bg-[var(--pf-content)]">
          {children}
        </div>
      </div>
      {bottomBar}
    </div>
  )
}
