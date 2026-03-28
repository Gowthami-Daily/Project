import { useCallback, useEffect, useState } from 'react'
import { getOpexCategories, getOpexExpenses, getOpexSummary, inr, postOpexExpense } from './api.js'

function defaultYm() {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() + 1, input: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
}

export default function OpexPage() {
  const [{ y, m, input }, setYm] = useState(defaultYm)
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [filterCat, setFilterCat] = useState('')
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    category_id: '',
    expense_date: new Date().toISOString().slice(0, 10),
    supplier_staff_name: '',
    amount: '',
    payment_method: 'UPI_BUSINESS',
    proof_url: '',
    notes: '',
  })

  const load = useCallback(() => {
    setError(null)
    const catId = filterCat ? Number(filterCat) : undefined
    return Promise.all([
      getOpexSummary(y, m),
      getOpexCategories(),
      getOpexExpenses({ year: y, month: m, category_id: catId }),
    ])
      .then(([s, c, e]) => {
        setSummary(s)
        setCategories(c)
        setExpenses(e)
      })
      .catch((err) => setError(err.message || 'Failed to load OpEx'))
  }, [y, m, filterCat])

  useEffect(() => {
    load()
  }, [load])

  async function submitExpense(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await postOpexExpense({
        category_id: Number(form.category_id),
        expense_date: form.expense_date,
        supplier_staff_name: form.supplier_staff_name || null,
        amount: Number(form.amount),
        payment_method: form.payment_method || null,
        proof_url: form.proof_url || null,
        notes: form.notes || null,
        created_by_user_id: 1,
      })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500">Month</label>
          <input
            type="month"
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={input}
            onChange={(e) => {
              const v = e.target.value
              const [yy, mm] = v.split('-').map(Number)
              setYm({ y: yy, m: mm, input: v })
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            aria-label="Filter category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]"
          >
            + Add expense
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {summary && (
        <section className="grid gap-4 sm:grid-cols-3" aria-label="OpEx KPIs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Fleet (fuel + maint.)</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-red-600">{inr(summary.fleet_total)}</p>
            <p className="mt-1 text-xs text-slate-500">Module 3 linkage (demo)</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Hygiene &amp; packaging</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-red-600">{inr(summary.hygiene_packaging)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Lab / pasteurization</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-red-600">{inr(summary.lab_pasteurization)}</p>
            <p className="mt-1 text-xs text-slate-500">MTD OpEx total: {inr(summary.opex_mtd_total)}</p>
          </div>
        </section>
      )}

      {showForm && (
        <form
          onSubmit={submitExpense}
          className="grid gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <h3 className="sm:col-span-2 text-lg font-bold text-slate-900">New expense</h3>
          <div>
            <label className="text-xs font-semibold text-slate-500">Category</label>
            <select
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Date</label>
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.expense_date}
              onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Paid to</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.supplier_staff_name}
              onChange={(e) => setForm((f) => ({ ...f, supplier_staff_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Amount (₹)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Payment</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.payment_method}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
            >
              <option value="UPI_BUSINESS">UPI (business)</option>
              <option value="NEFT">NEFT</option>
              <option value="CASH">Cash</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500">Proof URL</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="/proofs/receipt.jpg"
              value={form.proof_url}
              onChange={(e) => setForm((f) => ({ ...f, proof_url: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#004080] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Submit for approval'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-900">Expense ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Supplier / staff</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Proof</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((r) => (
                <tr key={r.expense_id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-slate-600">{r.expense_date}</td>
                  <td className="px-4 py-3">{r.category_name}</td>
                  <td className="px-4 py-3">{r.supplier_staff_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-red-600">−{inr(r.amount)}</td>
                  <td className="px-4 py-3">
                    {r.proof_url ? (
                      <a href={r.proof_url} className="text-xs font-semibold text-[#004080] hover:underline">
                        Open
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.approval_status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {r.approval_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
