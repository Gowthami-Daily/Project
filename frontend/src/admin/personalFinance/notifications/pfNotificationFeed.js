import {
  getNetworthGrowth,
  listCreditCardBills,
  listFinanceAccounts,
  listFinanceExpenses,
  listPendingLiabilityEmis,
  listPendingLoanEmis,
  setPfToken,
} from '../api.js'
import { formatInr } from '../pfFormat.js'
import { loadPfAppPrefs } from '../pfSettingsPrefs.js'

/**
 * @typedef {'high' | 'medium' | 'low' | 'info'} PfNotifPriority
 * @typedef {'danger' | 'warning' | 'info' | 'success'} PfNotifVariant
 * @typedef {'due' | 'alerts' | 'payments' | 'system'} PfNotifFilterTab
 * @typedef {{ id: string, label: string, navigate?: string, openEntry?: string }} PfNotifAction
 * @typedef {{
 *   id: string,
 *   title: string,
 *   subtitle?: string,
 *   priority: PfNotifPriority,
 *   link: string,
 *   kind: string,
 *   variant: PfNotifVariant,
 *   filterTabs: PfNotifFilterTab[],
 *   amount?: number,
 *   daysUntilDue: number | null,
 *   statusBadge?: string,
 *   actions: PfNotifAction[],
 * }} PfNotifItem
 */

function daysFromToday(isoDate) {
  if (!isoDate) return null
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const t = new Date()
  t.setHours(12, 0, 0, 0)
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}

function dueLabel(days) {
  if (days == null) return 'Due'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

/** @param {number | null} days */
function dueItemVariant(days) {
  if (days == null) return 'info'
  if (days <= 0) return 'danger'
  return 'info'
}

/** @param {number | null} days */
function statusBadgeFromDays(days) {
  if (days == null) return undefined
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  if (days === 1) return 'Tomorrow'
  if (days <= 7) return `In ${days} days`
  return undefined
}

/**
 * @param {string} kind
 * @param {string} link
 * @param {string} [loanSettlement]
 */
function buildPayActions(kind, link, loanSettlement) {
  const u = link || '/personal-finance'
  /** @type {{ id: string, label: string, navigate?: string, openEntry?: string }[]} */
  const actions = []
  if (kind === 'liability_emi') {
    actions.push({ id: 'pay', label: 'Pay', openEntry: 'emi' }, { id: 'view', label: 'View', navigate: u })
  } else if (kind === 'loan_emi') {
    if (String(loanSettlement || '').toUpperCase() === 'PAYMENT') {
      actions.push({ id: 'pay', label: 'Pay now', openEntry: 'emi' })
    } else {
      actions.push({ id: 'schedule', label: 'Schedule', navigate: u })
    }
    actions.push({ id: 'view', label: 'View', navigate: u })
  } else if (kind === 'cc_bill') {
    actions.push({ id: 'pay', label: 'Pay', openEntry: 'cc_pay' }, { id: 'view', label: 'View', navigate: u })
  }
  return actions
}

/**
 * @param {string} kind
 * @param {string} [loanSettlement]
 */
function filterTabsForKind(kind, loanSettlement) {
  /** @type {('due' | 'alerts' | 'payments' | 'system')[]} */
  const tabs = []
  if (kind === 'liability_emi' || kind === 'loan_emi' || kind === 'cc_bill') tabs.push('due')
  if (kind === 'liability_emi' || kind === 'cc_bill') tabs.push('payments')
  if (kind === 'loan_emi' && String(loanSettlement || '').toUpperCase() === 'PAYMENT') tabs.push('payments')
  if (kind === 'low_balance' || kind === 'net_worth' || kind === 'large_expense') tabs.push('alerts')
  if (kind === 'sip' || kind === 'monthly_report') tabs.push('system')
  return tabs
}

/** @param {any[]} items */
function sortNotifItems(items) {
  const variantRank = { danger: 0, warning: 1, info: 2, success: 3 }
  const pr = { high: 0, medium: 1, low: 2, info: 3 }
  const tier = (it) => {
    const d = it.daysUntilDue
    if (d != null && d < 0) return 0
    if (d === 0) return 1
    if (it.kind === 'low_balance') return 2
    if (d != null && d >= 1 && d <= 3) return 3
    if (d != null && d >= 4 && d <= 14) return 4
    if (d != null && d > 14) return 5
    if (it.kind === 'net_worth' || it.kind === 'large_expense') return 6
    return 7
  }
  return [...items].sort((a, b) => {
    const ta = tier(a)
    const tb = tier(b)
    if (ta !== tb) return ta - tb
    const ad = a.daysUntilDue
    const bd = b.daysUntilDue
    if (ad != null && bd != null && ad !== bd) return ad - bd
    if (ad != null && bd == null) return -1
    if (ad == null && bd != null) return 1
    const p = pr[a.priority] - pr[b.priority]
    if (p !== 0) return p
    return variantRank[a.variant] - variantRank[b.variant]
  })
}

/**
 * @param {{ onSessionInvalid?: () => void }} ctx
 * @returns {Promise<{ items: PfNotifItem[], highCount: number, mediumCount: number }>}
 */
export async function loadPfNotificationFeed(ctx = {}) {
  const { onSessionInvalid } = ctx
  const prefs = loadPfAppPrefs()
  const n = prefs.notifications || {}
  if (n.inAppNotifications === false) {
    return { items: [], highCount: 0, mediumCount: 0 }
  }

  /** @type {PfNotifItem[]} */
  const items = []

  const y = new Date().getFullYear()

  const fetches = []

  if (n.emiReminder !== false) {
    fetches.push(listPendingLiabilityEmis().catch(() => []))
  } else {
    fetches.push(Promise.resolve([]))
  }

  if (n.loanDue !== false) {
    fetches.push(listPendingLoanEmis().catch(() => []))
  } else {
    fetches.push(Promise.resolve([]))
  }

  if (n.creditCardDue !== false || n.billReminder !== false) {
    fetches.push(listCreditCardBills({ limit: 120 }).catch(() => []))
  } else {
    fetches.push(Promise.resolve([]))
  }

  if (n.lowBalanceAlert !== false) {
    fetches.push(listFinanceAccounts().catch(() => []))
  } else {
    fetches.push(Promise.resolve([]))
  }

  if (n.netWorthDropAlert !== false) {
    fetches.push(getNetworthGrowth(y, undefined).catch(() => []))
  } else {
    fetches.push(Promise.resolve([]))
  }

  if (n.largeExpenseAlert !== false) {
    const d = new Date()
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const start = `${yy}-${mm}-01`
    const end = `${yy}-${mm}-${dd}`
    fetches.push(listFinanceExpenses({ dateFrom: start, dateTo: end, limit: 200 }).catch(() => []))
  } else {
    fetches.push(Promise.resolve([]))
  }

  let liabEmis, loanEmis, bills, accounts, nwSeries, expenseRows
  try {
    ;[liabEmis, loanEmis, bills, accounts, nwSeries, expenseRows] = await Promise.all(fetches)
  } catch (e) {
    if (e.status === 401) {
      setPfToken(null)
      onSessionInvalid?.()
    }
    return { items: [], highCount: 0, mediumCount: 0 }
  }

  if (n.emiReminder !== false) {
    for (const row of Array.isArray(liabEmis) ? liabEmis : []) {
      const days = daysFromToday(row.due_date)
      const overdue = days != null && days < 0
      const soon = days != null && days >= 0 && days <= 3
      items.push({
        id: `liab-emi-${row.schedule_id}`,
        title: `${row.liability_name} — EMI #${row.emi_number}`,
        subtitle: `${formatInr(row.emi_amount)} · ${dueLabel(days)}`,
        priority: overdue ? 'high' : soon ? 'medium' : 'low',
        link: '/personal-finance/liabilities',
        kind: 'liability_emi',
        variant: dueItemVariant(days),
        filterTabs: filterTabsForKind('liability_emi'),
        amount: Number(row.emi_amount),
        daysUntilDue: days,
        statusBadge: statusBadgeFromDays(days),
        actions: buildPayActions('liability_emi', '/personal-finance/liabilities'),
      })
    }
  }

  if (n.loanDue !== false) {
    for (const row of Array.isArray(loanEmis) ? loanEmis : []) {
      const days = daysFromToday(row.due_date)
      const overdue = days != null && days < 0
      const soon = days != null && days >= 0 && days <= 3
      const settlement = String(row.emi_settlement || 'RECEIPT').toUpperCase()
      const verb = settlement === 'PAYMENT' ? 'Pay' : 'Expect'
      items.push({
        id: `loan-emi-${row.schedule_id}`,
        title: `${verb} — ${row.borrower_name} · EMI #${row.emi_number}`,
        subtitle: `${formatInr(row.emi_amount)} · ${dueLabel(days)}`,
        priority: overdue ? 'high' : soon ? 'medium' : 'low',
        link: '/personal-finance/loans',
        kind: 'loan_emi',
        variant: dueItemVariant(days),
        filterTabs: filterTabsForKind('loan_emi', settlement),
        amount: Number(row.emi_amount),
        daysUntilDue: days,
        statusBadge: statusBadgeFromDays(days),
        actions: buildPayActions('loan_emi', '/personal-finance/loans', settlement),
      })
    }
  }

  if (n.creditCardDue !== false || n.billReminder !== false) {
    for (const b of Array.isArray(bills) ? bills : []) {
      const st = String(b.status || '').toUpperCase()
      if (st === 'PAID') continue
      const days = daysFromToday(b.due_date)
      const overdue = days != null && days < 0
      const soon = days != null && days >= 0 && days <= 5
      const rem = b.remaining != null ? b.remaining : Number(b.total_amount) - Number(b.amount_paid || 0)
      items.push({
        id: `cc-bill-${b.id}`,
        title: `Credit card bill #${b.id}`,
        subtitle: `${formatInr(rem)} · ${dueLabel(days)}`,
        priority: overdue ? 'high' : soon ? 'medium' : 'low',
        link: '/personal-finance/credit-cards',
        kind: 'cc_bill',
        variant: dueItemVariant(days),
        filterTabs: filterTabsForKind('cc_bill'),
        amount: rem,
        daysUntilDue: days,
        statusBadge: statusBadgeFromDays(days),
        actions: buildPayActions('cc_bill', '/personal-finance/credit-cards'),
      })
    }
  }

  if (n.lowBalanceAlert !== false) {
    const threshold = Number(n.lowBalanceThreshold)
    const lim = Number.isFinite(threshold) && threshold > 0 ? threshold : 5000
    for (const a of Array.isArray(accounts) ? accounts : []) {
      const bal = Number(a.balance)
      if (!Number.isFinite(bal) || bal >= lim) continue
      items.push({
        id: `low-bal-${a.id}`,
        title: `Low balance — ${a.account_name}`,
        subtitle: `${formatInr(bal)} (under ${formatInr(lim)})`,
        priority: 'medium',
        link: '/personal-finance/accounts',
        kind: 'low_balance',
        variant: 'warning',
        filterTabs: filterTabsForKind('low_balance'),
        amount: bal,
        daysUntilDue: null,
        statusBadge: 'Below threshold',
        actions: [
          { id: 'transfer', label: 'Transfer', openEntry: 'transfer' },
          { id: 'view', label: 'View', navigate: '/personal-finance/accounts' },
        ],
      })
    }
  }

  if (n.netWorthDropAlert !== false && Array.isArray(nwSeries) && nwSeries.length >= 2) {
    const last = nwSeries[nwSeries.length - 1]
    const prev = nwSeries[nwSeries.length - 2]
    const nw = Number(last?.net_worth)
    const pw = Number(prev?.net_worth)
    if (Number.isFinite(nw) && Number.isFinite(pw) && pw > 0 && nw < pw) {
      const pct = ((nw - pw) / pw) * 100
      items.push({
        id: 'nw-drop-ytd',
        title: 'Net worth decreased vs prior month in series',
        subtitle: `${formatInr(pw)} → ${formatInr(nw)} (${pct.toFixed(1)}%)`,
        priority: pct <= -3 ? 'high' : 'medium',
        link: '/personal-finance/reports',
        kind: 'net_worth',
        variant: pct <= -3 ? 'danger' : 'warning',
        filterTabs: filterTabsForKind('net_worth'),
        daysUntilDue: null,
        statusBadge: 'Trend',
        actions: [{ id: 'view', label: 'View', navigate: '/personal-finance/reports' }],
      })
    }
  }

  if (n.largeExpenseAlert !== false) {
    const thr = Number(n.largeExpenseThreshold)
    const lim = Number.isFinite(thr) && thr > 0 ? thr : 25000
    let best = null
    for (const r of Array.isArray(expenseRows) ? expenseRows : []) {
      const a = Number(r.amount)
      if (!Number.isFinite(a) || a < lim) continue
      if (!best || a > best.amount) best = { r, amount: a }
    }
    if (best) {
      const cat = best.r.category || best.r.expense_category_name || 'Expense'
      items.push({
        id: `large-exp-${best.r.id}`,
        title: 'Large expense this month',
        subtitle: `${formatInr(best.amount)} · ${cat}`,
        priority: 'medium',
        link: '/personal-finance/expenses',
        kind: 'large_expense',
        variant: 'warning',
        filterTabs: filterTabsForKind('large_expense'),
        amount: best.amount,
        daysUntilDue: null,
        statusBadge: 'This month',
        actions: [{ id: 'view', label: 'View', navigate: '/personal-finance/expenses' }],
      })
    }
  }

  if (n.sipReminder) {
    const day = Number(prefs.investments?.sipReminderDay)
    const todayD = new Date().getDate()
    if (Number.isFinite(day) && day > 0 && todayD === day) {
      items.push({
        id: 'sip-reminder',
        title: 'SIP reminder',
        subtitle: 'Review monthly investments',
        priority: 'info',
        link: '/personal-finance/investments',
        kind: 'sip',
        variant: 'info',
        filterTabs: filterTabsForKind('sip'),
        daysUntilDue: null,
        actions: [{ id: 'view', label: 'View', navigate: '/personal-finance/investments' }],
      })
    }
  }

  if (n.monthlyReportReady !== false) {
    const d = new Date()
    if (d.getDate() <= 3) {
      items.push({
        id: 'monthly-report-nudge',
        title: 'Monthly financial report',
        subtitle: 'Review income, expenses, and net worth trends',
        priority: 'info',
        link: '/personal-finance/reports',
        kind: 'monthly_report',
        variant: 'info',
        filterTabs: filterTabsForKind('monthly_report'),
        daysUntilDue: null,
        actions: [{ id: 'view', label: 'View', navigate: '/personal-finance/reports' }],
      })
    }
  }

  const sorted = sortNotifItems(items)
  items.length = 0
  items.push(...sorted)

  const highCount = items.filter((i) => i.priority === 'high').length
  const mediumCount = items.filter((i) => i.priority === 'medium').length

  return { items, highCount, mediumCount }
}
