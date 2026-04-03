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
 * @typedef {{ id: string, title: string, subtitle?: string, priority: PfNotifPriority, link: string, kind: string }} PfNotifItem
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
      })
    }
  }

  items.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2, info: 3 }
    return rank[a.priority] - rank[b.priority]
  })

  const highCount = items.filter((i) => i.priority === 'high').length
  const mediumCount = items.filter((i) => i.priority === 'medium').length

  return { items, highCount, mediumCount }
}
