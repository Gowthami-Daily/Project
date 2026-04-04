/**
 * Toast API — render `PfToastProvider` / `AppToastProvider` at shell level (already in PersonalFinanceShell).
 *
 * ```jsx
 * const toast = useAppToast()
 * toast.success('Saved')
 * ```
 */
export { PfToastProvider as AppToastProvider } from '../notifications/pfToastContext.jsx'
export { usePfToast as useAppToast } from '../notifications/pfToastContext.jsx'
