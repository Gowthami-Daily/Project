import { fastapiUrl } from '../../lib/fastapiBase.js'

const BASE = fastapiUrl('/api/v1')

const TOKEN_KEY = 'gowthami_pf_access_token'

export function getPfToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/** Read ``active_profile_id`` claim from JWT (client-side, no verification). */
export function readActiveProfileIdFromToken() {
  const t = getPfToken()
  if (!t) return null
  try {
    let b64 = t.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (!b64) return null
    while (b64.length % 4) b64 += '='
    const json = atob(b64)
    const payload = JSON.parse(json)
    const id = payload.active_profile_id
    return id != null && id !== '' ? Number(id) : null
  } catch {
    return null
  }
}

export function setPfToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function authHeaders() {
  const t = getPfToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function parseJson(res) {
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      const j = JSON.parse(text)
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j)
    } catch {
      /* ignore */
    }
    const err = new Error(detail || res.statusText)
    err.status = res.status
    throw err
  }
  return text ? JSON.parse(text) : null
}

export async function pfFetch(path, options = {}) {
  const { headers: extra = {}, ...rest } = options
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...extra,
    },
  })
  return parseJson(res)
}

/** JSON login — stores token client-side; caller should call setPfToken. */
export async function loginPf(email, password) {
  const res = await fetch(`${BASE}/auth/login/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(typeof data.detail === 'string' ? data.detail : 'Login failed')
    err.status = res.status
    throw err
  }
  return data
}

/**
 * Open registration — creates FastAPI ``users`` row + personal profile (no auth header).
 * Password min length 8 (backend). Then call ``loginPf`` to obtain a JWT.
 */
export async function registerPf({ name, email, password, role = 'USER' }) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = 'Registration failed'
    if (typeof data.detail === 'string') msg = data.detail
    else if (Array.isArray(data.detail)) {
      msg = data.detail.map((d) => d.msg || d).join('; ')
    }
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

export function listProfiles() {
  return pfFetch('/pf/profiles/mine')
}

export function switchProfile(profileId) {
  return pfFetch('/pf/profiles/switch', {
    method: 'POST',
    body: JSON.stringify({ profile_id: profileId }),
  })
}

/** Append ``account_id`` for per-bank dashboard filtering (omit or null for all accounts). */
function withFinanceAccountId(path, financeAccountId) {
  if (financeAccountId == null || financeAccountId === '') return path
  const id = Number(financeAccountId)
  if (!id || Number.isNaN(id)) return path
  return path.includes('?')
    ? `${path}&account_id=${encodeURIComponent(id)}`
    : `${path}?account_id=${encodeURIComponent(id)}`
}

export function getDashboardSummary(financeAccountId) {
  return pfFetch(withFinanceAccountId('/pf/dashboard/summary', financeAccountId))
}

export function getIncomeVsExpense(year, financeAccountId) {
  let path = '/pf/dashboard/income-vs-expense'
  const q = new URLSearchParams()
  if (year != null) q.set('year', String(year))
  if (financeAccountId != null && financeAccountId !== '') {
    const id = Number(financeAccountId)
    if (id && !Number.isNaN(id)) q.set('account_id', String(id))
  }
  const s = q.toString()
  if (s) path += `?${s}`
  return pfFetch(path)
}

export function getExpenseByCategory(start, end, financeAccountId) {
  const p = new URLSearchParams()
  if (start) p.set('start_date', start)
  if (end) p.set('end_date', end)
  if (financeAccountId != null && financeAccountId !== '') {
    const id = Number(financeAccountId)
    if (id && !Number.isNaN(id)) p.set('account_id', String(id))
  }
  const s = p.toString()
  return pfFetch(`/pf/dashboard/expense-category${s ? `?${s}` : ''}`)
}

export function getNetworthGrowth(year, financeAccountId) {
  const q = new URLSearchParams()
  if (year != null) q.set('year', String(year))
  if (financeAccountId != null && financeAccountId !== '') {
    const id = Number(financeAccountId)
    if (id && !Number.isNaN(id)) q.set('account_id', String(id))
  }
  const s = q.toString()
  return pfFetch(`/pf/dashboard/networth-growth${s ? `?${s}` : ''}`)
}

export function getInvestmentAllocation() {
  return pfFetch('/pf/dashboard/investment-allocation')
}

export function getLoanDashboardAnalytics(year) {
  const q = new URLSearchParams()
  if (year != null && year !== '') q.set('year', String(year))
  const s = q.toString()
  return pfFetch(`/pf/dashboard/loans-analytics${s ? `?${s}` : ''}`)
}

/** Current calendar month expense buckets, cash/bank split, pending EMIs (receivable). */
export function getCashflowMonthSummary() {
  return pfFetch('/pf/dashboard/cashflow-month')
}

export function getExpenseAnalytics(startDate, endDate) {
  const p = new URLSearchParams()
  if (startDate) p.set('start_date', startDate)
  if (endDate) p.set('end_date', endDate)
  const s = p.toString()
  return pfFetch(`/pf/reports/expense-analytics${s ? `?${s}` : ''}`)
}

export function getMonthlyFinancialTables(year, financeAccountId) {
  const q = new URLSearchParams({ year: String(year) })
  if (financeAccountId != null && financeAccountId !== '') {
    const id = Number(financeAccountId)
    if (id && !Number.isNaN(id)) q.set('account_id', String(id))
  }
  return pfFetch(`/pf/reports/monthly-tables?${q}`)
}

/** Single-month income + expenses for daily statement (lightweight vs full monthly tables). */
export function getMonthLedger(year, month, financeAccountId) {
  const q = new URLSearchParams({ year: String(year), month: String(month) })
  if (financeAccountId != null && financeAccountId !== '') {
    const id = Number(financeAccountId)
    if (id && !Number.isNaN(id)) q.set('account_id', String(id))
  }
  return pfFetch(`/pf/reports/month-ledger?${q}`)
}

const fin = (path, opts) => pfFetch(`/pf/finance${path}`, opts)

export function listFinanceAccounts(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/accounts?${q}`)
}

export function createFinanceAccount(body) {
  return fin('/accounts', { method: 'POST', body: JSON.stringify(body) })
}

export function patchFinanceAccountBalance(accountId, body) {
  return fin(`/accounts/${accountId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteFinanceAccount(accountId) {
  return fin(`/accounts/${accountId}`, { method: 'DELETE' })
}

export function listFinanceIncome(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/income?${q}`)
}

export function createFinanceIncome(body) {
  return fin('/income', { method: 'POST', body: JSON.stringify(body) })
}

export function patchFinanceIncome(incomeId, body) {
  return fin(`/income/${incomeId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteFinanceIncome(incomeId) {
  return fin(`/income/${incomeId}`, { method: 'DELETE' })
}

export function listPfExpenseCategories() {
  return fin('/expense-categories')
}

export function listPfIncomeCategories() {
  return fin('/income-categories')
}

export function listPfPaymentInstruments(kind) {
  const q = new URLSearchParams()
  if (kind) q.set('kind', kind)
  const s = q.toString()
  return fin(`/payment-instruments${s ? `?${s}` : ''}`)
}

export function createPfPaymentInstrument(body) {
  return fin('/payment-instruments', { method: 'POST', body: JSON.stringify(body) })
}

export function deletePfPaymentInstrument(id) {
  return fin(`/payment-instruments/${id}`, { method: 'DELETE' })
}

export function listFinanceExpenses(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/expenses?${q}`)
}

export function createFinanceExpense(body) {
  return fin('/expenses', { method: 'POST', body: JSON.stringify(body) })
}

export function patchFinanceExpense(expenseId, body) {
  return fin(`/expenses/${expenseId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteFinanceExpense(expenseId) {
  return fin(`/expenses/${expenseId}`, { method: 'DELETE' })
}

export function listFinanceInvestments(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/investments?${q}`)
}

export function createFinanceInvestment(body) {
  return fin('/investments', { method: 'POST', body: JSON.stringify(body) })
}

export function listFinanceAssets(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/assets?${q}`)
}

export function createFinanceAsset(body) {
  return fin('/assets', { method: 'POST', body: JSON.stringify(body) })
}

export function listFinanceLiabilities(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/liabilities?${q}`)
}

export function createFinanceLiability(body) {
  return fin('/liabilities', { method: 'POST', body: JSON.stringify(body) })
}

export function listFinanceLoans() {
  return fin('/loans')
}

export function createFinanceLoan(body) {
  return fin('/loans', { method: 'POST', body: JSON.stringify(body) })
}

export function listLoanSchedule(loanId) {
  return fin(`/loans/${loanId}/schedule`)
}

/** Bank vs cash for EMI payout when marked paid. */
export function patchLoanScheduleCredit(loanId, emiNumber, { creditAsCash, financeAccountId }) {
  return fin(`/loans/${loanId}/schedule/${emiNumber}/credit`, {
    method: 'PATCH',
    body: JSON.stringify({
      credit_as_cash: Boolean(creditAsCash),
      finance_account_id: financeAccountId == null ? null : Number(financeAccountId),
    }),
  })
}

export function deleteFinanceLoan(loanId) {
  return fin(`/loans/${loanId}`, { method: 'DELETE' })
}

export function listLoanPayments(loanId) {
  return fin(`/loans/${loanId}/payments`)
}

/**
 * Mark EMI paid. ``opts`` can be ISO date string (legacy) or
 * ``{ paymentDate?, financeAccountId? }`` to credit a bank.
 */
export function payLoanEmi(loanId, emiNumber, opts = {}) {
  const q = new URLSearchParams()
  const o = typeof opts === 'string' ? { paymentDate: opts } : opts
  if (o.paymentDate) q.set('payment_date', o.paymentDate)
  if (o.financeAccountId != null && o.financeAccountId !== '')
    q.set('finance_account_id', String(o.financeAccountId))
  const s = q.toString()
  return fin(`/loans/${loanId}/emi/${emiNumber}/pay${s ? `?${s}` : ''}`, { method: 'POST' })
}

export function createLoanPayment(loanId, body) {
  return fin(`/loans/${loanId}/payments`, { method: 'POST', body: JSON.stringify(body) })
}
