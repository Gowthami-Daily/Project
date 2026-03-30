import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createCreditCard,
  createCreditCardStandaloneTransaction,
  generateCreditCardBill,
  getCreditCardDashboardSummary,
  getCreditCardOutstanding,
  listCreditCardBills,
  listCreditCardTransactions,
  listCreditCards,
  listFinanceAccounts,
  listPfExpenseCategories,
  payCreditCardBill,
  setPfToken,
} from '../api.js'
import { btnPrimary, cardCls, inputCls, labelCls, pfTable, pfTableWrap, pfTd, pfTh, pfTrHover } from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cards', label: 'Cards' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'bills', label: 'Bills & pay' },
]

export default function PfCreditCardsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cards, setCards] = useState([])
  const [accounts, setAccounts] = useState([])
  const [outstanding, setOutstanding] = useState(null)
  const [dash, setDash] = useState(null)
  const [tx, setTx] = useState([])
  const [bills, setBills] = useState([])

  const [cardName, setCardName] = useState('')
  const [bankName, setBankName] = useState('')
  const [cardLimit, setCardLimit] = useState('')
  const [billStart, setBillStart] = useState('')
  const [billEnd, setBillEnd] = useState('')
  const [genCardId, setGenCardId] = useState('')
  const [payBillId, setPayBillId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payFromAcc, setPayFromAcc] = useState('')
  const [payRef, setPayRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [categories, setCategories] = useState([])
  const [txCardId, setTxCardId] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txDate, setTxDate] = useState(() => todayISODate())
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')

  const period = useMemo(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  }, [tick])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [c, a, o, txR, billR, dsum, cats] = await Promise.all([
        listCreditCards(),
        listFinanceAccounts(),
        getCreditCardOutstanding(),
        listCreditCardTransactions({ limit: 100 }),
        listCreditCardBills({ limit: 100 }),
        getCreditCardDashboardSummary(period.y, period.m),
        listPfExpenseCategories(),
      ])
      setCards(Array.isArray(c) ? c : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setAccounts(Array.isArray(a) ? a : [])
      setOutstanding(o && typeof o === 'object' ? o : null)
      setTx(Array.isArray(txR) ? txR : [])
      setBills(Array.isArray(billR) ? billR : [])
      setDash(dsum && typeof dsum === 'object' ? dsum : null)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Could not load credit cards')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid, period.m, period.y])

  useEffect(() => {
    load()
  }, [load, tick])

  async function handleAddCard(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createCreditCard({
        card_name: cardName.trim(),
        bank_name: bankName.trim() || null,
        card_limit: Number(cardLimit) || 0,
        billing_cycle_start: 1,
        due_days: 15,
        closing_day: closingDay === '' ? null : Number(closingDay),
        due_day: dueDay === '' ? null : Number(dueDay),
      })
      setCardName('')
      setBankName('')
      setCardLimit('')
      setClosingDay('')
      setDueDay('')
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save card')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerateBill(e) {
    e.preventDefault()
    if (!genCardId || !billStart || !billEnd) {
      setError('Select card and statement date range.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await generateCreditCardBill({
        card_id: Number(genCardId),
        bill_start_date: billStart,
        bill_end_date: billEnd,
      })
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not generate bill')
    } finally {
      setBusy(false)
    }
  }

  async function handlePayBill(e) {
    e.preventDefault()
    if (!payBillId || !payAmount || !payFromAcc) {
      setError('Bill, amount, and bank account required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await payCreditCardBill({
        bill_id: Number(payBillId),
        amount: Number(payAmount),
        payment_date: todayISODate(),
        from_account_id: Number(payFromAcc),
        reference_number: payRef.trim() || null,
      })
      setPayAmount('')
      setPayRef('')
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleManualSwipe(e) {
    e.preventDefault()
    if (!txCardId || !txAmount) {
      setError('Select a card and enter an amount.')
      return
    }
    const cat = categories.find((x) => String(x.id) === txCategoryId)
    setBusy(true)
    setError('')
    try {
      await createCreditCardStandaloneTransaction({
        card_id: Number(txCardId),
        amount: Number(txAmount),
        transaction_date: txDate,
        expense_category_id: txCategoryId === '' ? null : Number(txCategoryId),
        category: cat?.name || 'general',
        description: txDesc.trim() || null,
        paid_by: null,
      })
      setTxAmount('')
      setTxDesc('')
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not add swipe')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Credit cards</h1>
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">
          Swipes post as expenses without debiting your bank until you pay the statement; statements create liabilities.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? 'bg-[var(--pf-primary)] text-white'
                : 'border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {loading && !cards.length ? (
        <div className="animate-pulse rounded-2xl bg-slate-200/60 p-8 dark:bg-slate-700/40">Loading…</div>
      ) : null}

      {tab === 'overview' && dash ? (
        <div className={`${cardCls} space-y-4 p-4 sm:p-5`}>
          <h2 className="text-base font-bold text-[var(--pf-text)]">Summary ({period.y}-{String(period.m).padStart(2, '0')})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total limit', dash.total_credit_limit],
              ['Used', dash.used_limit],
              ['Available', dash.available_limit],
              ['Unbilled', dash.unbilled_charges],
              ['Billed outstanding', dash.billed_outstanding],
              ['Due this month', dash.due_this_month],
              ['Due this week', dash.due_this_week],
              ['Overdue', dash.overdue_amount],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">{k}</p>
                <p className="mt-1 text-lg font-bold text-[var(--pf-text)]">{formatInr(v)}</p>
              </div>
            ))}
          </div>
          {outstanding ? (
            <p className="text-sm text-[var(--pf-text-muted)]">
              Outstanding (API): unbilled {formatInr(outstanding.unbilled_charges)} + billed{' '}
              {formatInr(outstanding.billed_outstanding)} = {formatInr(outstanding.total)}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'cards' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleAddCard} className={`${cardCls} space-y-3 p-4 sm:p-5`}>
            <h2 className="text-base font-bold text-[var(--pf-text)]">Add credit card</h2>
            <div>
              <label className={labelCls}>Card name</label>
              <input className={inputCls} value={cardName} onChange={(e) => setCardName(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Bank (optional)</label>
              <input className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Credit limit (₹)</label>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={cardLimit}
                onChange={(e) => setCardLimit(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Statement closing day (1–31)</label>
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  max="31"
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div>
                <label className={labelCls}>Payment due day (1–31)</label>
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Saving…' : 'Save card'}
            </button>
          </form>
          <div className={`${cardCls} p-4 sm:p-5`}>
            <h2 className="text-base font-bold text-[var(--pf-text)]">Your cards</h2>
            {cards.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {cards.map((c) => (
                  <li key={c.id} className="rounded-lg border border-[var(--pf-border)] px-3 py-2">
                    <span className="font-semibold text-[var(--pf-text)]">{c.card_name}</span>
                    {c.bank_name ? <span className="text-[var(--pf-text-muted)]"> · {c.bank_name}</span> : null}
                    <div className="text-[var(--pf-text-muted)]">Limit {formatInr(c.card_limit)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--pf-text-muted)]">No cards yet — add one on the left.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'transactions' ? (
        <div className={`${cardCls} p-0`}>
          <div className="border-b border-[var(--pf-border)] px-4 py-3">
            <h2 className="text-base font-bold text-[var(--pf-text)]">Transactions</h2>
            <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
              Add a swipe, UPI on credit, or any charge manually — creates an expense and unbilled line (no bank debit until you pay the statement).
            </p>
          </div>
          <form onSubmit={handleManualSwipe} className="space-y-3 border-b border-[var(--pf-border)] px-4 py-4 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelCls}>Card</label>
                <select
                  className={inputCls}
                  value={txCardId}
                  onChange={(e) => setTxCardId(e.target.value)}
                  required
                >
                  <option value="">— Select —</option>
                  {cards.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.card_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Amount (₹)</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input className={inputCls} type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={txCategoryId} onChange={(e) => setTxCategoryId(e.target.value)}>
                  <option value="">— General —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Description (optional)</label>
              <input className={inputCls} value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="e.g. Amazon, fuel" />
            </div>
            <button type="submit" disabled={busy || !cards.length} className={btnPrimary}>
              {busy ? 'Saving…' : 'Add transaction'}
            </button>
          </form>
          <div className="border-b border-[var(--pf-border)] px-4 py-2">
            <h3 className="text-sm font-semibold text-[var(--pf-text)]">Recent swipes</h3>
          </div>
          <div className={pfTableWrap}>
            <table className={pfTable}>
              <thead>
                <tr>
                  <th className={pfTh}>Date</th>
                  <th className={pfTh}>Card</th>
                  <th className={pfTh}>Expense #</th>
                  <th className={pfTh}>Bill</th>
                  <th className={`${pfTh} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {tx.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={pfTd}>{r.transaction_date}</td>
                    <td className={pfTd}>{cards.find((c) => c.id === r.card_id)?.card_name ?? r.card_id}</td>
                    <td className={pfTd}>{r.expense_id ?? '—'}</td>
                    <td className={pfTd}>{r.bill_id ?? '—'}</td>
                    <td className={`${pfTd} text-right font-medium`}>{formatInr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tx.length ? <p className="p-4 text-sm text-[var(--pf-text-muted)]">No transactions yet.</p> : null}
          </div>
        </div>
      ) : null}

      {tab === 'bills' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleGenerateBill} className={`${cardCls} space-y-3 p-4 sm:p-5`}>
            <h2 className="text-base font-bold text-[var(--pf-text)]">Generate statement</h2>
            <p className="text-xs text-[var(--pf-text-muted)]">
              Packs unbilled charges between dates into one bill and books a liability for the total.
            </p>
            <div>
              <label className={labelCls}>Card</label>
              <select className={inputCls} value={genCardId} onChange={(e) => setGenCardId(e.target.value)} required>
                <option value="">— Select —</option>
                {cards.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.card_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Statement from</label>
                <input className={inputCls} type="date" value={billStart} onChange={(e) => setBillStart(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Statement to</label>
                <input className={inputCls} type="date" value={billEnd} onChange={(e) => setBillEnd(e.target.value)} required />
              </div>
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>
              Generate bill
            </button>
          </form>

          <form onSubmit={handlePayBill} className={`${cardCls} space-y-3 p-4 sm:p-5`}>
            <h2 className="text-base font-bold text-[var(--pf-text)]">Pay statement from bank</h2>
            <div>
              <label className={labelCls}>Bill</label>
              <select className={inputCls} value={payBillId} onChange={(e) => setPayBillId(e.target.value)} required>
                <option value="">— Select —</option>
                {bills
                  .filter((b) => b.status !== 'PAID')
                  .map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      #{b.id} · due {b.due_date} · rem {formatInr(b.remaining ?? b.total_amount - b.amount_paid)}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount (₹)</label>
              <input
                className={inputCls}
                type="number"
                step="0.01"
                min="0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>From account</label>
              <select className={inputCls} value={payFromAcc} onChange={(e) => setPayFromAcc(e.target.value)} required>
                <option value="">— Select —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Reference (optional)</label>
              <input className={inputCls} value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>
              Record payment
            </button>
          </form>

          <div className={`${cardCls} lg:col-span-2 p-0`}>
            <div className="border-b border-[var(--pf-border)] px-4 py-3">
              <h2 className="text-base font-bold text-[var(--pf-text)]">All bills</h2>
            </div>
            <div className={pfTableWrap}>
              <table className={pfTable}>
                <thead>
                  <tr>
                    <th className={pfTh}>ID</th>
                    <th className={pfTh}>Card</th>
                    <th className={pfTh}>Period</th>
                    <th className={pfTh}>Due</th>
                    <th className={pfTh}>Status</th>
                    <th className={`${pfTh} text-right`}>Total</th>
                    <th className={`${pfTh} text-right`}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className={pfTrHover}>
                      <td className={pfTd}>{b.id}</td>
                      <td className={pfTd}>{cards.find((c) => c.id === b.card_id)?.card_name ?? b.card_id}</td>
                      <td className={pfTd}>
                        {b.bill_start_date} → {b.bill_end_date}
                      </td>
                      <td className={pfTd}>{b.due_date}</td>
                      <td className={pfTd}>{b.status}</td>
                      <td className={`${pfTd} text-right`}>{formatInr(b.total_amount)}</td>
                      <td className={`${pfTd} text-right font-medium`}>
                        {formatInr(b.remaining != null ? b.remaining : Number(b.total_amount) - Number(b.amount_paid))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!bills.length ? <p className="p-4 text-sm text-[var(--pf-text-muted)]">No bills yet.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
