/** Inputs & focus — sky accent, soft borders */
export const inputCls =
  'mt-1 w-full rounded-[10px] border border-sky-200/80 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-sky-400/30 transition-shadow focus:border-sky-300 focus:ring-2'

export const labelCls = 'block text-sm font-medium text-sky-950/80'

/** Cards: 16px radius, global PF shadow */
export const cardCls =
  'rounded-[16px] border border-sky-200/55 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)] ring-1 ring-sky-100/30 transition-shadow duration-200 hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_4px_12px_rgba(0,0,0,0.35)] dark:ring-slate-700/50 dark:hover:shadow-[0_6px_16px_rgba(0,0,0,0.45)] sm:p-5'

/** Primary — blue fill, 42px height, 10px radius */
export const btnPrimary =
  'h-[42px] min-h-[42px] inline-flex items-center justify-center rounded-[10px] bg-[#1E3A8A] px-4 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition hover:bg-[#172554] active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none'

/** Secondary — white, blue border/text */
export const btnSecondary =
  'h-[42px] min-h-[42px] inline-flex items-center justify-center rounded-[10px] border-2 border-[#1E3A8A] bg-white px-4 text-sm font-semibold text-[#1E3A8A] transition hover:bg-slate-50 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none'

/** Danger — red fill */
export const btnDanger =
  'h-[42px] min-h-[42px] inline-flex items-center justify-center rounded-[10px] bg-[#EF4444] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none'

/** Compact native select — Year / Bank row on mobile */
export const pfSelectCompact =
  'rounded-[10px] border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm outline-none ring-[#1E3A8A]/20 focus:ring-2'

/** Table shell: horizontal scroll on small screens, rounded frame (add ``mt-4`` in parent when needed) */
export const pfTableWrap =
  'overflow-x-auto rounded-[16px] border border-sky-200/60 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)]'

export const pfTable = 'w-full min-w-0 border-collapse text-left text-sm'

/** Column headers — light blue band */
export const pfTh =
  'bg-sky-100 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-sky-950 border-b border-sky-200/90 first:pl-4'

export const pfThRight =
  'bg-sky-100 px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-sky-950 border-b border-sky-200/90 last:pr-4'

/** Body cells */
export const pfTd = 'border-b border-sky-100/90 px-3 py-2.5 align-middle text-slate-800 first:pl-4'

export const pfTdRight =
  'border-b border-sky-100/90 px-3 py-2.5 text-right align-middle font-mono tabular-nums text-slate-800 last:pr-4'

export const pfTrHover = 'transition-colors duration-150 hover:bg-sky-50/60'

/**
 * Table **Actions** column — use on any PF (or imported) data table so control buttons stay one line.
 * Header: `${pfThRight} ${pfThActions}` or `${pfThSmRight} ${pfThSmActionCol}`.
 * Cell: `pfTdActions` / `pfTdSmActions` + inner `pfActionRow`.
 */
export const pfThActions = 'min-w-[10.5rem] whitespace-nowrap'
/** Row has 3+ buttons (e.g. View + Record + Delete). */
export const pfThActionsWide = 'min-w-[16rem] whitespace-nowrap'
/** Right-aligned actions body cell (inherits ``pfTdRight`` + nowrap). */
export const pfTdActions = `${pfTdRight} whitespace-nowrap`
/** Single horizontal row of buttons inside an actions cell. */
export const pfActionRow = 'flex flex-nowrap items-center justify-end gap-2'

/** Compact tables (modals, dense EMI grids) */
export const pfThSm =
  'bg-sky-100 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-sky-950 border-b border-sky-200/90 first:pl-2'
export const pfThSmRight =
  'bg-sky-100 px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-sky-950 border-b border-sky-200/90 last:pr-2'
export const pfTdSm =
  'border-b border-sky-100/90 px-2 py-1.5 align-middle text-xs text-slate-800 first:pl-2'
export const pfTdSmRight =
  'border-b border-sky-100/90 px-2 py-1.5 text-right align-middle font-mono text-xs tabular-nums text-slate-800 last:pr-2'

export const pfTdSmActions = `${pfTdSmRight} whitespace-nowrap`
/** Last column on dense schedule tables (e.g. “Mark paid”). */
export const pfThSmActionCol = 'min-w-[6.5rem] whitespace-nowrap'

/** Chart / KPI cards on PF dashboard */
export const pfChartCard =
  'rounded-[16px] border border-sky-200/55 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)] ring-1 ring-sky-100/30 dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_4px_12px_rgba(0,0,0,0.35)] dark:ring-slate-700/50 sm:p-5'
