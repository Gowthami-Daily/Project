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

/** Current user (requires valid JWT). */
export function fetchPfMe() {
  return pfFetch('/auth/me')
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

/**
 * @param {string|undefined} financeAccountId
 * @param {{ periodYear?: number, periodMonth?: number }} [opts] — calendar month for income/expense/recent tx (omit = year-to-date)
 */
/**
 * @param {{ periodYear?: number, periodMonth?: number, full?: boolean, recentLimit?: number }} [opts]
 * When opts.full + period: same payload as GET /bundle (single-call dashboard).
 */
export function getDashboardSummary(financeAccountId, opts = {}) {
  let path = withFinanceAccountId('/pf/dashboard/summary', financeAccountId)
  const y = opts.periodYear
  const m = opts.periodMonth
  const parts = []
  if (y != null && m != null) {
    parts.push(`period_year=${encodeURIComponent(String(y))}`, `period_month=${encodeURIComponent(String(m))}`)
  }
  if (opts.full && y != null && m != null) {
    parts.push('full=true', `recent_limit=${encodeURIComponent(String(opts.recentLimit ?? 15))}`)
  } else if (opts.recentLimit != null && y != null && m != null) {
    parts.push(`recent_limit=${encodeURIComponent(String(opts.recentLimit))}`)
  }
  if (parts.length) {
    const sep = path.includes('?') ? '&' : '?'
    path += sep + parts.join('&')
  }
  return pfFetch(path)
}

/**
 * Single round-trip: summary, accounts, charts, cashflow, loans, upcoming EMIs.
 * Requires periodYear + periodMonth (same as month-scoped summary).
 */
/**
 * @param {string|undefined} financeAccountId
 * @param {number} periodYear
 * @param {number} periodMonth
 * @param {{ recentLimit?: number }} [opts] — default 12 for smaller payload / faster JSON
 */
export function getDashboardBundle(financeAccountId, periodYear, periodMonth, opts = {}) {
  const q = new URLSearchParams({
    period_year: String(periodYear),
    period_month: String(periodMonth),
    recent_limit: String(opts.recentLimit ?? 12),
  })
  if (financeAccountId != null && financeAccountId !== '') {
    const id = Number(financeAccountId)
    if (id && !Number.isNaN(id)) q.set('account_id', String(id))
  }
  return pfFetch(`/pf/dashboard/bundle?${q.toString()}`)
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

/** Calendar month expense buckets, cash/bank split, pending EMIs (receivable). Omit year/month = current month. */
export function getCashflowMonthSummary(year, month) {
  const q = new URLSearchParams()
  if (year != null && month != null) {
    q.set('year', String(year))
    q.set('month', String(month))
  }
  const s = q.toString()
  return pfFetch(`/pf/dashboard/cashflow-month${s ? `?${s}` : ''}`)
}

export function getExpenseAnalytics(startDate, endDate) {
  const p = new URLSearchParams()
  if (startDate) p.set('start_date', startDate)
  if (endDate) p.set('end_date', endDate)
  const s = p.toString()
  return pfFetch(`/pf/reports/expense-analytics${s ? `?${s}` : ''}`)
}

/** Full analytics dashboard payload (KPIs, trends, breakdowns, monthly series). */
export function getReportsSummary(params) {
  const { from, to, accountId, expenseCategoryId, person, expenseAccountType } = params || {}
  const q = new URLSearchParams()
  q.set('from', String(from))
  q.set('to', String(to))
  if (accountId != null && String(accountId).trim() !== '') {
    const id = Number(accountId)
    if (id && !Number.isNaN(id)) q.set('account_id', String(id))
  }
  if (expenseCategoryId != null && String(expenseCategoryId).trim() !== '') {
    const cid = Number(expenseCategoryId)
    if (cid && !Number.isNaN(cid)) q.set('expense_category_id', String(cid))
  }
  if (person && String(person).trim()) q.set('person', String(person).trim())
  if (expenseAccountType != null && String(expenseAccountType).trim() !== '') {
    q.set('expense_account_type', String(expenseAccountType).trim())
  }
  return pfFetch(`/pf/reports/summary?${q}`)
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

/** Date-range daily statement: ``fromDate`` / ``toDate`` as YYYY-MM-DD (inclusive). */
export function getDailyLedger(fromDate, toDate, financeAccountId) {
  const q = new URLSearchParams({
    from_date: String(fromDate),
    to_date: String(toDate),
  })
  if (financeAccountId != null && financeAccountId !== '') {
    const id = Number(financeAccountId)
    if (id && !Number.isNaN(id)) q.set('account_id', String(id))
  }
  return pfFetch(`/pf/reports/daily?${q}`)
}

/** @param {{ month?: string, type?: 'daily'|'monthly', year?: number, accountId?: string|number, expenseCategoryId?: string|number, incomeCategoryId?: string|number, cardId?: string|number }} p */
function pfAnalyticsQuery(p = {}) {
  const q = new URLSearchParams()
  if (p.month) q.set('month', String(p.month))
  if (p.type) q.set('type', String(p.type))
  if (p.year != null && p.year !== '') q.set('year', String(p.year))
  if (p.accountId != null && String(p.accountId).trim() !== '') {
    const id = Number(p.accountId)
    if (id && !Number.isNaN(id)) q.set('account_id', String(id))
  }
  if (p.expenseCategoryId != null && String(p.expenseCategoryId).trim() !== '') {
    const id = Number(p.expenseCategoryId)
    if (id && !Number.isNaN(id)) q.set('expense_category_id', String(id))
  }
  if (p.incomeCategoryId != null && String(p.incomeCategoryId).trim() !== '') {
    const id = Number(p.incomeCategoryId)
    if (id && !Number.isNaN(id)) q.set('income_category_id', String(id))
  }
  if (p.cardId != null && String(p.cardId).trim() !== '') {
    const id = Number(p.cardId)
    if (id && !Number.isNaN(id)) q.set('card_id', String(id))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** Modular PF analytics hub (TASK 6). ``module`` slug: expenses, income, accounts, movements, credit-cards, … */
export function getPfAnalyticsSummary(module, params) {
  return pfFetch(`/pf/analytics/${encodeURIComponent(module)}/summary${pfAnalyticsQuery(params)}`)
}

export function getPfAnalyticsTrend(module, params) {
  return pfFetch(`/pf/analytics/${encodeURIComponent(module)}/trend${pfAnalyticsQuery(params)}`)
}

export function getPfAnalyticsDistribution(module, params) {
  return pfFetch(`/pf/analytics/${encodeURIComponent(module)}/distribution${pfAnalyticsQuery(params)}`)
}

export function getPfAnalyticsTable(module, params) {
  return pfFetch(`/pf/analytics/${encodeURIComponent(module)}/table${pfAnalyticsQuery(params)}`)
}

export function getPfAnalyticsInsights(module, params) {
  return pfFetch(`/pf/analytics/${encodeURIComponent(module)}/insights${pfAnalyticsQuery(params)}`)
}

/** @param {Record<string, string|number|undefined|null>} o */
function pfQuery(o) {
  const q = new URLSearchParams()
  Object.entries(o).forEach(([k, v]) => {
    if (v != null && v !== '') q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** @param {{ fyStart: number, year: number, month: number, regime?: string, type?: string }} p */
export function getPfTaxSummary(p) {
  return pfFetch(
    `/pf/tax/summary${pfQuery({
      fy_start: p.fyStart,
      year: p.year,
      month: p.month,
      regime: p.regime ?? 'old',
      type: p.type ?? 'daily',
    })}`,
  )
}

export function getPfTaxTrend(p) {
  return pfFetch(
    `/pf/tax/trend${pfQuery({
      fy_start: p.fyStart,
      year: p.year,
      month: p.month,
      type: p.type ?? 'daily',
    })}`,
  )
}

export function getPfTaxDistribution(p) {
  return pfFetch(`/pf/tax/distribution${pfQuery({ fy_start: p.fyStart, regime: p.regime ?? 'old' })}`)
}

export function getPfTaxTable(p) {
  return pfFetch(
    `/pf/tax/table${pfQuery({
      fy_start: p.fyStart,
      year: p.year,
      month: p.month,
      regime: p.regime ?? 'old',
      type: p.type ?? 'daily',
    })}`,
  )
}

export function getPfTaxInsights(p) {
  return pfFetch(`/pf/tax/insights${pfQuery({ fy_start: p.fyStart, regime: p.regime ?? 'old' })}`)
}

export function getPfTaxCalculation(p) {
  return pfFetch(`/pf/tax/tax-calculation${pfQuery({ fy_start: p.fyStart, regime: p.regime ?? 'old' })}`)
}

/** @param {{ month: string, type?: string, expenseCategoryId?: string|number }} p — month YYYY-MM */
export function getPfBudgetSummary(p) {
  return pfFetch(
    `/pf/budget/summary${pfQuery({
      month: p.month,
      type: p.type ?? 'daily',
      expense_category_id: p.expenseCategoryId,
    })}`,
  )
}

export function getPfBudgetTrend(p) {
  return pfFetch(
    `/pf/budget/trend${pfQuery({
      month: p.month,
      type: p.type ?? 'daily',
      expense_category_id: p.expenseCategoryId,
    })}`,
  )
}

export function getPfBudgetDistribution(p) {
  return pfFetch(`/pf/budget/distribution${pfQuery({ month: p.month, expense_category_id: p.expenseCategoryId })}`)
}

export function getPfBudgetTable(p) {
  return pfFetch(
    `/pf/budget/table${pfQuery({
      month: p.month,
      type: p.type ?? 'daily',
      expense_category_id: p.expenseCategoryId,
    })}`,
  )
}

export function getPfBudgetInsights(p) {
  return pfFetch(`/pf/budget/insights${pfQuery({ month: p.month, expense_category_id: p.expenseCategoryId })}`)
}

export function listPfBudgets() {
  return pfFetch('/pf/budget/budgets')
}

/**
 * Create a category budget (FinanceParticipant).
 * @param {{ name?: string, expenseCategoryId?: number, categoryLabel?: string, monthlyBudget: number, startDate: string, endDate?: string|null }} body
 */
export function createPfBudget(body) {
  return pfFetch('/pf/budget/budgets', {
    method: 'POST',
    body: JSON.stringify({
      name: body.name?.trim() || null,
      expense_category_id: body.expenseCategoryId ?? null,
      category_label: body.categoryLabel?.trim() || null,
      monthly_budget: body.monthlyBudget,
      start_date: body.startDate,
      end_date: body.endDate || null,
    }),
  })
}

/** @param {{ year: number, type?: string }} p */
export function getPfFinancialHealthTrend(p) {
  return pfFetch(`/pf/financial-health/trend${pfQuery({ year: p.year, type: p.type ?? 'monthly' })}`)
}

export function getPfFinancialHealthSummary() {
  return pfFetch('/pf/financial-health/summary')
}

export function getPfFinancialHealthTable(year) {
  return pfFetch(`/pf/financial-health/table${pfQuery({ year })}`)
}

export function getPfFinancialHealthInsights() {
  return pfFetch('/pf/financial-health/insights')
}

export function postPfFinancialHealthRecalculate() {
  return pfFetch('/pf/financial-health/recalculate', { method: 'POST', body: JSON.stringify({}) })
}

const fin = (path, opts) => pfFetch(`/pf/finance${path}`, opts)

export function listFinanceAccounts(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/accounts?${q}`)
}

export function createFinanceAccount(body) {
  return fin('/accounts', { method: 'POST', body: JSON.stringify(body) })
}

/** @param {Record<string, unknown>} body — balance, account_type, account_name, include_in_networth, include_in_liquid */
export function patchFinanceAccount(accountId, body) {
  return fin(`/accounts/${accountId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function patchFinanceAccountBalance(accountId, body) {
  return patchFinanceAccount(accountId, body)
}

export function deleteFinanceAccount(accountId) {
  return fin(`/accounts/${accountId}`, { method: 'DELETE' })
}

/** @param {FormData} formData — multipart: from_account_id, to_account_id, amount, transfer_date, transfer_method, optional reference_number, notes, attachment */
export function postAccountTransfer(formData) {
  return fin('/accounts/transfer', { method: 'POST', body: formData })
}

/** @param {Record<string, unknown>} body — AccountMovementCreate JSON */
export function postAccountMovement(body) {
  return fin('/accounts/movements', { method: 'POST', body: JSON.stringify(body) })
}

/** @returns {Promise<{ items: unknown[], total: number }>} — total from X-Total-Count when present */
export async function listAccountTransferHistory(params = {}) {
  const q = new URLSearchParams({
    skip: String(params.skip ?? 0),
    limit: String(params.limit ?? 10),
  })
  const res = await fetch(`${BASE}/pf/finance/accounts/movements?${q}`, {
    headers: { ...authHeaders() },
  })
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
  const raw = text ? JSON.parse(text) : []
  const items = Array.isArray(raw) ? raw : []
  const th = res.headers.get('X-Total-Count')
  const totalParsed = th != null ? Number(th) : NaN
  const total = Number.isFinite(totalParsed) ? totalParsed : items.length
  return { items, total }
}

/** @param {{ year?: number, month?: number, start_date?: string, end_date?: string }} params */
export function getAccountMovementsSummary(params = {}) {
  const q = new URLSearchParams()
  if (params.year != null && params.month != null) {
    q.set('year', String(params.year))
    q.set('month', String(params.month))
  }
  if (params.start_date) q.set('start_date', String(params.start_date))
  if (params.end_date) q.set('end_date', String(params.end_date))
  const s = q.toString()
  return fin(`/accounts/movements/summary${s ? `?${s}` : ''}`)
}

export function getAccountStatement(accountId, params = {}) {
  const q = new URLSearchParams({
    skip: String(params.skip ?? 0),
    limit: String(params.limit ?? 200),
  })
  if (params.start_date) q.set('start_date', String(params.start_date))
  if (params.end_date) q.set('end_date', String(params.end_date))
  return fin(`/accounts/${accountId}/statement?${q}`)
}

export function getAccountsBalanceSummary() {
  return fin('/accounts/balance-summary')
}

export function listFinanceIncome(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  if (params.dateFrom) q.set('date_from', String(params.dateFrom))
  if (params.dateTo) q.set('date_to', String(params.dateTo))
  if (params.accountId != null && params.accountId !== '') q.set('account_id', String(params.accountId))
  if (params.category) q.set('category', String(params.category))
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
  if (params.dateFrom) q.set('date_from', String(params.dateFrom))
  if (params.dateTo) q.set('date_to', String(params.dateTo))
  if (params.accountId != null && params.accountId !== '') q.set('account_id', String(params.accountId))
  if (params.category) q.set('category', String(params.category))
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

/** Registered credit cards (statement / liability flow). */
export function listCreditCards(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/credit-cards?${q}`)
}

export function createCreditCard(body) {
  return fin('/credit-cards', { method: 'POST', body: JSON.stringify(body) })
}

export function updateCreditCard(cardId, body) {
  return fin(`/credit-cards/${cardId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteCreditCard(cardId) {
  return fin(`/credit-cards/${cardId}`, { method: 'DELETE' })
}

export function getCreditCardDashboardSummary(periodYear, periodMonth) {
  const q = new URLSearchParams({
    period_year: String(periodYear),
    period_month: String(periodMonth),
  })
  return fin(`/credit-cards/dashboard-summary?${q}`)
}

export function listCreditCardTransactions(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 500) })
  if (params.cardId != null && params.cardId !== '') q.set('card_id', String(params.cardId))
  if (params.categoryId != null && params.categoryId !== '') q.set('category_id', String(params.categoryId))
  if (params.dateFrom) q.set('date_from', String(params.dateFrom))
  if (params.dateTo) q.set('date_to', String(params.dateTo))
  if (params.status) q.set('status', String(params.status))
  if (params.unbilledOnly) q.set('unbilled_only', 'true')
  return fin(`/credit-cards/transactions?${q}`)
}

export function createCreditCardStandaloneTransaction(body) {
  return fin('/credit-cards/transactions', { method: 'POST', body: JSON.stringify(body) })
}

export function patchCreditCardTransaction(txId, body) {
  return fin(`/credit-cards/transactions/${txId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteCreditCardTransaction(txId) {
  return fin(`/credit-cards/transactions/${txId}`, { method: 'DELETE' })
}

export function assignCreditCardTransactionToBill(txId, billId) {
  return fin(`/credit-cards/transactions/${txId}/assign-bill`, {
    method: 'POST',
    body: JSON.stringify({ bill_id: billId }),
  })
}

export function listCreditCardBills(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  if (params.cardId != null && params.cardId !== '') q.set('card_id', String(params.cardId))
  return fin(`/credit-cards/bills?${q}`)
}

export function generateCreditCardBill(body) {
  return fin('/credit-cards/generate-bill', { method: 'POST', body: JSON.stringify(body) })
}

export function payCreditCardBill(body) {
  return fin('/credit-cards/pay-bill', { method: 'POST', body: JSON.stringify(body) })
}

/** Dry-run statement totals before POST generate-bill. */
export function getCreditCardBillPreview(params) {
  const q = new URLSearchParams({
    card_id: String(params.cardId),
    bill_start_date: String(params.billStartDate),
    bill_end_date: String(params.billEndDate),
  })
  return fin(`/credit-cards/bill-preview?${q}`)
}

export function getCreditCardBillStatement(billId) {
  return fin(`/credit-cards/bills/${encodeURIComponent(billId)}/statement`)
}

export function markCreditCardBillOverdue(billId, lateFee = 500) {
  const q = new URLSearchParams({ late_fee: String(lateFee) })
  return fin(`/credit-cards/bills/${encodeURIComponent(billId)}/mark-overdue?${q}`, {
    method: 'POST',
  })
}

export function getCreditCardOutstandingTrend(periodYear, periodMonth, months = 12) {
  const q = new URLSearchParams({
    period_year: String(periodYear),
    period_month: String(periodMonth),
    months: String(months),
  })
  return fin(`/credit-cards/analytics/outstanding-trend?${q}`)
}

export function getCreditCardInterestTrend(periodYear, periodMonth, months = 12) {
  const q = new URLSearchParams({
    period_year: String(periodYear),
    period_month: String(periodMonth),
    months: String(months),
  })
  return fin(`/credit-cards/analytics/interest-trend?${q}`)
}

export function getCreditCardOutstanding() {
  return fin('/credit-cards/outstanding')
}

export function getCreditCardYearlySpend() {
  return fin('/credit-cards/analytics/yearly-spend')
}

export function getCreditCardMonthlySpend(cardId, year, categoryId) {
  const q = new URLSearchParams({
    card_id: String(cardId),
    year: String(year),
  })
  if (categoryId != null && categoryId !== '') q.set('category_id', String(categoryId))
  return fin(`/credit-cards/analytics/monthly-spend?${q}`)
}

export function getCreditCardSpendByCategory(year) {
  const q = new URLSearchParams({ year: String(year) })
  return fin(`/credit-cards/analytics/spend-by-category?${q}`)
}

export function getCreditCardBilledVsPaid(periodYear, periodMonth, months = 12) {
  const q = new URLSearchParams({
    period_year: String(periodYear),
    period_month: String(periodMonth),
    months: String(months),
  })
  return fin(`/credit-cards/analytics/billed-vs-paid?${q}`)
}

export function getCreditCardCardUtilization() {
  return fin('/credit-cards/analytics/card-utilization')
}

export function listFinanceInvestments(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/investments?${q}`)
}

export function createFinanceInvestment(body) {
  return fin('/investments', { method: 'POST', body: JSON.stringify(body) })
}

export function updateFinanceInvestment(investmentId, body) {
  return fin(`/investments/${investmentId}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function deleteFinanceInvestment(investmentId) {
  return fin(`/investments/${investmentId}`, { method: 'DELETE' })
}

export function getInvestmentMonthlyFlow(year) {
  const q = new URLSearchParams({ year: String(year) })
  return fin(`/investments/monthly-flow?${q}`)
}

export function getInvestmentLedger(investmentId) {
  return fin(`/investments/${investmentId}/ledger`)
}

export function createInvestmentTransaction(investmentId, body) {
  return fin(`/investments/${investmentId}/transactions`, { method: 'POST', body: JSON.stringify(body) })
}

export function deleteInvestmentTransaction(investmentId, transactionId) {
  return fin(`/investments/${investmentId}/transactions/${transactionId}`, { method: 'DELETE' })
}

export function getAssetsSummary() {
  return fin('/assets/summary')
}

export function listFinanceAssets(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 500) })
  if (params.asset_type && params.asset_type !== 'ALL') q.set('asset_type', String(params.asset_type))
  if (params.location && String(params.location).trim()) q.set('location', String(params.location).trim())
  if (params.search && String(params.search).trim()) q.set('search', String(params.search).trim())
  return fin(`/assets?${q}`)
}

export function getFinanceAsset(assetId) {
  return fin(`/assets/${assetId}`)
}

export function createFinanceAsset(body) {
  return fin('/assets', { method: 'POST', body: JSON.stringify(body) })
}

export function patchFinanceAsset(assetId, body) {
  return fin(`/assets/${assetId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteFinanceAsset(assetId) {
  return fin(`/assets/${assetId}`, { method: 'DELETE' })
}

export function listChitFunds(params = {}) {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 200) })
  return fin(`/chit-funds?${q}`)
}

export function createChitFund(body) {
  return fin('/chit-funds', { method: 'POST', body: JSON.stringify(body) })
}

export function patchChitFund(chitId, body) {
  return fin(`/chit-funds/${chitId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteChitFund(chitId) {
  return fin(`/chit-funds/${chitId}`, { method: 'DELETE' })
}

export function postChitFundContribution(chitId, body) {
  return fin(`/chit-funds/${chitId}/contributions`, { method: 'POST', body: JSON.stringify(body) })
}

export function postChitFundDividend(chitId, body) {
  return fin(`/chit-funds/${chitId}/dividend`, { method: 'POST', body: JSON.stringify(body) })
}

export function postChitFundForemanCommission(chitId, body) {
  return fin(`/chit-funds/${chitId}/foreman-commission`, { method: 'POST', body: JSON.stringify(body) })
}

export function listFinanceLiabilities(params = {}) {
  const q = new URLSearchParams({
    skip: String(params.skip ?? 0),
    limit: String(params.limit ?? 500),
  })
  if (params.liability_type && params.liability_type !== 'ALL')
    q.set('liability_type', String(params.liability_type))
  if (params.status && params.status !== 'ALL') q.set('status', String(params.status))
  if (params.due_this_month === true) q.set('due_this_month', 'true')
  if (params.search && String(params.search).trim()) q.set('search', String(params.search).trim())
  return fin(`/liabilities?${q}`)
}

export function getLiabilitiesSummary() {
  return fin('/liabilities/summary')
}

export function getFinanceLiability(liabilityId) {
  return fin(`/liabilities/${liabilityId}`)
}

export function createFinanceLiability(body) {
  return fin('/liabilities', { method: 'POST', body: JSON.stringify(body) })
}

export function listLiabilitySchedule(liabilityId) {
  return fin(`/liabilities/${liabilityId}/schedule`)
}

export function patchLiabilityScheduleCredit(liabilityId, emiNumber, { creditAsCash, financeAccountId }) {
  return fin(`/liabilities/${liabilityId}/schedule/${emiNumber}/credit`, {
    method: 'PATCH',
    body: JSON.stringify({
      credit_as_cash: Boolean(creditAsCash),
      finance_account_id: financeAccountId == null ? null : Number(financeAccountId),
    }),
  })
}

export function payLiabilityEmi(liabilityId, emiNumber, params = {}) {
  const q = new URLSearchParams()
  if (params.paymentDate) q.set('payment_date', String(params.paymentDate))
  if (params.financeAccountId != null) q.set('finance_account_id', String(params.financeAccountId))
  const s = q.toString()
  return fin(`/liabilities/${liabilityId}/emi/${emiNumber}/pay${s ? `?${s}` : ''}`, { method: 'POST' })
}

export function listPendingLiabilityEmis() {
  return fin('/liabilities/pending-emi')
}

export function patchFinanceLiability(liabilityId, body) {
  return fin(`/liabilities/${liabilityId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteFinanceLiability(liabilityId) {
  return fin(`/liabilities/${liabilityId}`, { method: 'DELETE' })
}

export function listLiabilityPayments(liabilityId) {
  return fin(`/liabilities/${liabilityId}/payments`)
}

export function createLiabilityPayment(liabilityId, body) {
  return fin(`/liabilities/${liabilityId}/payments`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function closeFinanceLiability(liabilityId) {
  return fin(`/liabilities/${liabilityId}/close`, { method: 'POST' })
}

/** Extra principal for borrowed liabilities without an EMI schedule; credits the given bank account. */
export function addLiabilityPrincipalAmount(liabilityId, body) {
  return fin(`/liabilities/${liabilityId}/add-amount`, {
    method: 'POST',
    body: JSON.stringify({
      amount: Number(body.amount),
      disbursement_date: body.disbursement_date,
      finance_account_id: Number(body.finance_account_id),
      notes: body.notes?.trim() || null,
    }),
  })
}

export function listFinanceLoans(params = {}) {
  const q = new URLSearchParams()
  if (params.loan_type && params.loan_type !== 'ALL') q.set('loan_type', String(params.loan_type))
  if (params.status && params.status !== 'ALL') q.set('status', String(params.status))
  if (params.search && String(params.search).trim()) q.set('search', String(params.search).trim())
  const s = q.toString()
  return fin(`/loans${s ? `?${s}` : ''}`)
}

export function listPendingLoanEmis() {
  return fin('/loans/pending-emi')
}

export function payLoanEmiJson(body) {
  return fin('/loans/emi/pay', { method: 'POST', body: JSON.stringify(body) })
}

export function getFinanceLoansSummary() {
  return fin('/loans/summary')
}

export function createFinanceLoan(body) {
  return fin('/loans', { method: 'POST', body: JSON.stringify(body) })
}

export function patchFinanceLoan(loanId, body) {
  return fin(`/loans/${loanId}`, { method: 'PATCH', body: JSON.stringify(body) })
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

/** Extra principal for loans without an EMI schedule; debits the given bank account. */
export function addLoanPrincipalAmount(loanId, body) {
  return fin(`/loans/${loanId}/add-amount`, {
    method: 'POST',
    body: JSON.stringify({
      amount: Number(body.amount),
      disbursement_date: body.disbursement_date,
      finance_account_id: Number(body.finance_account_id),
      notes: body.notes?.trim() || null,
    }),
  })
}

/** Mark loan closed when no outstanding balance (manual or EMI). */
export function closeFinanceLoan(loanId) {
  return fin(`/loans/${loanId}/close`, { method: 'POST' })
}

/** Parse RFC 5987 / quoted filename from Content-Disposition. */
export function parseContentDispositionFilename(cd) {
  if (!cd || typeof cd !== 'string') return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"(.*)"$/, '$1'))
    } catch {
      return star[1].trim()
    }
  }
  const m = /filename="([^"]+)"/i.exec(cd)
  return m ? m[1] : null
}

/** Authenticated GET returning a Blob (PDF/XLSX). Path must start with /pf/... */
export async function pfFetchBlob(pathWithQuery) {
  const t = getPfToken()
  const res = await fetch(`${BASE}${pathWithQuery}`, {
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  })
  if (!res.ok) {
    let detail = await res.text()
    try {
      const j = JSON.parse(detail)
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j)
    } catch {
      /* leave as text */
    }
    const err = new Error(detail || res.statusText)
    err.status = res.status
    throw err
  }
  const blob = await res.blob()
  const filename = parseContentDispositionFilename(res.headers.get('Content-Disposition'))
  return { blob, filename }
}

export function triggerDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
