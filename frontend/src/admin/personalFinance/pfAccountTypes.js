/** Canonical backend types (Phase A) — labels for UI. */
export const PF_FINANCE_ACCOUNT_TYPES = [
  { value: 'BANK', label: 'Bank' },
  { value: 'CASH', label: 'Cash' },
  { value: 'WALLET', label: 'Wallet (UPI / app)' },
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'LOAN_GIVEN', label: 'Loan given' },
  { value: 'LOAN_TAKEN', label: 'Loan taken' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'ASSET', label: 'Asset' },
]

export function pfAccountTypeLabel(value) {
  const v = String(value || '').toUpperCase()
  return PF_FINANCE_ACCOUNT_TYPES.find((t) => t.value === v)?.label ?? value ?? '—'
}

export function pfDefaultIncludeLiquid(accountType) {
  const t = String(accountType || '').toUpperCase()
  return t === 'BANK' || t === 'CASH' || t === 'WALLET'
}
