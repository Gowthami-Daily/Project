/** Inputs — 40px height, 10px radius, 13px body text (design system) */
export const inputCls =
  'mt-1 box-border h-10 w-full rounded-[10px] border px-3 text-[13px] leading-10 outline-none transition-[border-color,box-shadow] duration-200 ' +
  'border-sky-200/80 bg-white text-slate-800 placeholder:text-slate-400 ring-sky-400/30 focus:border-sky-300 focus:ring-2 ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-input-bg)] dark:text-[var(--pf-text)] dark:placeholder:text-[var(--pf-text-muted)] dark:ring-[var(--pf-primary)]/25 dark:focus:border-[var(--pf-primary)] dark:focus:ring-2'

export const labelCls =
  'block text-[12px] font-medium text-sky-950/80 dark:text-[var(--pf-text-muted)]'

/** Cards — 14px radius, layered dark surfaces */
export const cardCls =
  'rounded-[14px] border p-4 shadow-[var(--pf-shadow)] transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out will-change-transform sm:p-5 ' +
  'border-sky-200/55 bg-white text-slate-900 ring-1 ring-sky-100/30 hover:-translate-y-0.5 hover:shadow-[var(--pf-shadow-hover)] ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)] dark:text-[var(--pf-text)] dark:ring-[var(--pf-border)]/50 dark:hover:-translate-y-0.5 dark:hover:bg-[var(--pf-card-hover)]'

/** Page root — fluid width inside shell */
export const pfPageContainer = 'w-full min-w-0 max-w-full'

/** Primary — token-driven (44px min touch target) */
export const btnPrimary =
  'min-h-11 h-11 inline-flex w-full items-center justify-center rounded-[10px] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 sm:h-[42px] sm:min-h-[42px] sm:w-auto ' +
  'bg-[var(--pf-primary)] shadow-slate-900/10 hover:bg-[var(--pf-primary-hover)]'

/** Secondary — outline primary */
export const btnSecondary =
  'min-h-11 h-11 inline-flex w-full items-center justify-center rounded-[10px] border-2 px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 sm:h-[42px] sm:min-h-[42px] sm:w-auto ' +
  'border-[var(--pf-primary)] bg-white text-[var(--pf-primary)] hover:bg-slate-50 dark:bg-[var(--pf-card)] dark:hover:bg-[var(--pf-card-hover)]'

/** Danger — red fill */
export const btnDanger =
  'min-h-11 h-11 inline-flex w-full items-center justify-center rounded-[10px] bg-[var(--pf-danger)] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-600 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 sm:h-[42px] sm:min-h-[42px] sm:w-auto'

/** Compact native select */
export const pfSelectCompact =
  'rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold shadow-sm outline-none transition-colors duration-200 ring-[var(--pf-primary)]/20 focus:ring-2 ' +
  'border-slate-200/90 bg-white text-slate-800 ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-input-bg)] dark:text-[var(--pf-text)] dark:focus:ring-[var(--pf-primary)]/30'

/**
 * Filter / toolbar native select — use inside a `relative` wrapper with a decorative chevron overlay.
 * (`appearance-none` + horizontal padding leaves room for the icon.)
 */
export const pfFilterSelect =
  'w-full cursor-pointer appearance-none rounded-xl border py-2.5 pl-3.5 pr-10 text-sm font-medium ' +
  'shadow-[var(--pf-shadow)] outline-none transition-[border-color,box-shadow,background-color] duration-200 ' +
  'border-sky-200/85 bg-white text-slate-800 ' +
  'hover:border-sky-300 hover:shadow-[var(--pf-shadow-hover)] hover:bg-sky-50/20 ' +
  'focus:border-[var(--pf-primary)] focus:ring-2 focus:ring-[var(--pf-primary)]/25 ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-input-bg)] dark:text-[var(--pf-text)] ' +
  'dark:hover:border-[var(--pf-border)] dark:hover:bg-[var(--pf-card-hover)] ' +
  'dark:focus:border-[var(--pf-primary)] dark:focus:ring-[var(--pf-primary)]/30'

/** Table shell — horizontal scroll; add class `ds-app-table` on `<table>` for sticky header */
export const pfTableWrap =
  'max-w-full overflow-x-auto rounded-[14px] border border-sky-200/60 bg-white shadow-[var(--pf-shadow)] [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]'

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
  'group/tr transition-[background-color] duration-[var(--pf-motion-normal,180ms)] ease-out hover:bg-sky-50/60 dark:hover:bg-[var(--pf-card-hover)]'

export const pfThActions = 'min-w-[10.5rem] whitespace-nowrap'
export const pfThActionsWide = 'min-w-[16rem] whitespace-nowrap'
export const pfTdActions = `${pfTdRight} whitespace-nowrap`
export const pfActionRow =
  'pf-row-actions flex flex-nowrap items-center justify-end gap-2 transition-opacity duration-[var(--pf-motion-normal,180ms)] ease-out max-md:opacity-100 md:opacity-90 md:group-hover/tr:opacity-100'

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
