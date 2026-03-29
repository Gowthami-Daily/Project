/** Inputs & focus — theme tokens in dark */
export const inputCls =
  'mt-1 w-full rounded-[10px] border px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 ' +
  'border-sky-200/80 bg-white text-slate-800 ring-sky-400/30 focus:border-sky-300 focus:ring-2 ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-input-bg)] dark:text-[var(--pf-text)] dark:placeholder:text-[var(--pf-text-muted)] dark:ring-blue-500/25 dark:focus:border-[var(--pf-primary)] dark:focus:ring-2'

export const labelCls =
  'block text-sm font-medium text-sky-950/80 dark:text-[var(--pf-text-muted)]'

/** Cards — 14px radius, layered dark surfaces */
export const cardCls =
  'rounded-[14px] border p-4 shadow-[var(--pf-shadow)] transition-all duration-200 sm:p-5 ' +
  'border-sky-200/55 bg-white text-slate-900 ring-1 ring-sky-100/30 hover:shadow-[var(--pf-shadow-hover)] ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)] dark:text-[var(--pf-text)] dark:ring-[var(--pf-border)]/50 dark:hover:bg-[var(--pf-card-hover)]'

/** Primary — token-driven */
export const btnPrimary =
  'h-[42px] min-h-[42px] inline-flex items-center justify-center rounded-[10px] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 ' +
  'bg-[var(--pf-primary)] shadow-slate-900/10 hover:bg-[var(--pf-primary-hover)]'

/** Secondary — outline primary */
export const btnSecondary =
  'h-[42px] min-h-[42px] inline-flex items-center justify-center rounded-[10px] border-2 px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 ' +
  'border-[var(--pf-primary)] bg-white text-[var(--pf-primary)] hover:bg-slate-50 dark:bg-[var(--pf-card)] dark:hover:bg-[var(--pf-card-hover)]'

/** Danger — red fill */
export const btnDanger =
  'h-[42px] min-h-[42px] inline-flex items-center justify-center rounded-[10px] bg-[var(--pf-danger)] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-600 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60'

/** Compact native select */
export const pfSelectCompact =
  'rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold shadow-sm outline-none transition-colors duration-200 ring-[var(--pf-primary)]/20 focus:ring-2 ' +
  'border-slate-200/90 bg-white text-slate-800 ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-input-bg)] dark:text-[var(--pf-text)] dark:focus:ring-[var(--pf-primary)]/30'

/** Table shell */
export const pfTableWrap =
  'overflow-x-auto rounded-[14px] border border-sky-200/60 bg-white shadow-[var(--pf-shadow)] dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]'

export const pfTable = 'w-full min-w-0 border-collapse text-left text-sm'

export const pfTh =
  'border-b px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider first:pl-4 ' +
  'border-sky-200/90 bg-sky-100 text-sky-950 ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-th-bg)] dark:text-[var(--pf-text-muted)]'

export const pfThRight =
  'border-b px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider last:pr-4 ' +
  'border-sky-200/90 bg-sky-100 text-sky-950 ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-th-bg)] dark:text-[var(--pf-text-muted)]'

export const pfTd =
  'border-b px-3 py-2.5 align-middle first:pl-4 ' +
  'border-sky-100/90 text-slate-800 dark:border-[var(--pf-border)] dark:text-[var(--pf-text)]'

export const pfTdRight =
  'border-b px-3 py-2.5 text-right align-middle font-mono tabular-nums last:pr-4 ' +
  'border-sky-100/90 text-slate-800 dark:border-[var(--pf-border)] dark:text-[var(--pf-text)]'

export const pfTrHover =
  'transition-colors duration-200 hover:bg-sky-50/60 dark:hover:bg-[var(--pf-card-hover)]'

export const pfThActions = 'min-w-[10.5rem] whitespace-nowrap'
export const pfThActionsWide = 'min-w-[16rem] whitespace-nowrap'
export const pfTdActions = `${pfTdRight} whitespace-nowrap`
export const pfActionRow = 'flex flex-nowrap items-center justify-end gap-2'

export const pfThSm =
  'border-b px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider first:pl-2 ' +
  'border-sky-200/90 bg-sky-100 text-sky-950 dark:border-[var(--pf-border)] dark:bg-[var(--pf-th-bg)] dark:text-[var(--pf-text-muted)]'
export const pfThSmRight =
  'border-b px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider last:pr-2 ' +
  'border-sky-200/90 bg-sky-100 text-sky-950 dark:border-[var(--pf-border)] dark:bg-[var(--pf-th-bg)] dark:text-[var(--pf-text-muted)]'
export const pfTdSm =
  'border-b px-2 py-1.5 align-middle text-xs first:pl-2 ' +
  'border-sky-100/90 text-slate-800 dark:border-[var(--pf-border)] dark:text-[var(--pf-text)]'
export const pfTdSmRight =
  'border-b px-2 py-1.5 text-right align-middle font-mono text-xs tabular-nums last:pr-2 ' +
  'border-sky-100/90 text-slate-800 dark:border-[var(--pf-border)] dark:text-[var(--pf-text)]'

export const pfTdSmActions = `${pfTdSmRight} whitespace-nowrap`
export const pfThSmActionCol = 'min-w-[6.5rem] whitespace-nowrap'

/** Chart / dashboard cards */
export const pfChartCard =
  'rounded-[14px] border p-4 shadow-[var(--pf-shadow)] ring-1 transition-all duration-200 sm:p-5 ' +
  'border-sky-200/55 bg-white ring-sky-100/30 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)] dark:ring-[var(--pf-border)]/40 dark:hover:bg-[var(--pf-card-hover)]'

/** Modal overlay — rgba(0,0,0,0.6) + blur; use only inside `.pf-app` */
export const pfModalOverlay = 'pf-modal-overlay'

export const pfModalOverlay60 = 'pf-modal-overlay pf-modal-overlay--60'

export const pfModalOverlay65 = 'pf-modal-overlay pf-modal-overlay--65'

export const pfModalOverlay70 = 'pf-modal-overlay pf-modal-overlay--70'

/** Modal panel: layered surface (#0F172A dark), 14px radius, open animation */
export const pfModalSurface = 'pf-modal-surface pf-modal-surface--animate'

/** Compact centered dialog (no max-height cap) */
export const pfModalSurfaceFit = 'pf-modal-surface pf-modal-surface--animate pf-modal-surface--fit'

/** Flush header bar — pair with panel `p-5 md:p-6` */
export const pfModalHeader =
  '-mx-5 -mt-5 mb-4 flex items-start justify-between gap-4 rounded-t-[14px] border-b border-[var(--pf-border)] bg-[var(--pf-modal-header-bg)] px-5 py-4 md:-mx-6 md:-mt-6 md:mb-5 md:px-6'

export const pfModalCloseBtn =
  'rounded-lg p-1 text-[var(--pf-text-muted)] opacity-70 transition hover:opacity-100 hover:bg-[var(--pf-card-hover)]'

/** Sticky-style footer strip inside modals */
export const pfModalFooter =
  'flex shrink-0 flex-wrap gap-2 border-t border-[var(--pf-border)] bg-[var(--pf-modal-footer-bg)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
