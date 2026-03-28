import { useCallback, useEffect, useState } from 'react'
import { getCenters, getQaSummary, getQaTests, postQaTest } from './api.js'

function localISODate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function TogglePair({ label, value, onChange, passLabel = 'Pass', failLabel = 'Fail' }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-semibold transition ${
            value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          {passLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-semibold transition ${
            !value ? 'border-red-500 bg-red-50 text-red-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          {failLabel}
        </button>
      </div>
    </div>
  )
}

export default function LabPage() {
  const [date, setDate] = useState(localISODate)
  const [centerId, setCenterId] = useState('')
  const [centers, setCenters] = useState([])
  const [summary, setSummary] = useState(null)
  const [tests, setTests] = useState([])
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [batchId, setBatchId] = useState('')
  const [formCenter, setFormCenter] = useState('')
  const [cob, setCob] = useState(true)
  const [alcohol, setAlcohol] = useState(true)
  const [organoleptic, setOrganoleptic] = useState(true)
  const [ureaPct, setUreaPct] = useState('')
  const [sugar, setSugar] = useState(false)
  const [salt, setSalt] = useState(false)
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [c, s, t] = await Promise.all([
        getCenters(),
        getQaSummary({ date, center_id: centerId || undefined }),
        getQaTests({ date, center_id: centerId || undefined }),
      ])
      setCenters(c)
      setSummary(s)
      setTests(t)
    } catch (e) {
      setError(e.message || 'Failed to load lab data')
    }
  }, [date, centerId])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await postQaTest({
        batch_id: batchId || null,
        collection_center_id: formCenter ? Number(formCenter) : null,
        cob_test_passed: cob,
        alcohol_test_passed: alcohol,
        organoleptic_normal: organoleptic,
        urea_percentage: ureaPct === '' ? null : Number(ureaPct),
        sugar_detected: sugar,
        salt_detected: salt,
        starch_detected: false,
        detergent_detected: false,
        lab_notes: notes || null,
      })
      setBatchId('')
      setNotes('')
      setUreaPct('')
      await load()
    } catch (err) {
      setError(err.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const adulterationColor =
    summary && summary.adulteration_index_value < 0.08
      ? 'text-emerald-600'
      : summary && summary.adulteration_index_value < 0.15
        ? 'text-amber-600'
        : 'text-red-600'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500">Collection center</label>
          <select
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
          >
            <option value="">All centers</option>
            {centers.map((c) => (
              <option key={c.center_id} value={c.center_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500">Date</label>
          <input
            type="date"
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error} — ensure uvicorn is running with ASGI on port 8000.
        </div>
      )}

      {summary && (
        <section className="grid gap-4 sm:grid-cols-3" aria-label="QA KPIs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Samples tested today</p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#004080]">
              {summary.samples_tested}{' '}
              <span className="text-lg font-semibold text-slate-400">/ {summary.samples_planned}</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Rejected batches</p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-red-600">{summary.rejected_batches}</p>
            <p className="mt-1 text-sm text-slate-500">(~{summary.estimated_loss_liters} L loss est.)</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Avg. adulteration signal (urea proxy)</p>
            <p className={`mt-2 font-mono text-2xl font-bold tabular-nums ${adulterationColor}`}>
              {summary.adulteration_index_label}
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold text-slate-900">Recent lab test log</h3>
            <p className="text-xs text-slate-500">COB / Alcohol / Organoleptic panel + adulteration flags</p>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sample</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Panel</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tests.map((t) => (
                  <tr key={t.test_id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">#{t.test_id}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{t.batch_id ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {new Date(t.tested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.test_panel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          t.final_result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {t.final_result}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" className="text-xs font-semibold text-[#004080] hover:underline">
                        View report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
        >
          <h3 className="text-lg font-bold text-slate-900">Log lab test result</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Sample / batch ID</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                placeholder="e.g. F1005"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Center</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formCenter}
                onChange={(e) => setFormCenter(e.target.value)}
              >
                <option value="">—</option>
                {centers.map((c) => (
                  <option key={c.center_id} value={c.center_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <TogglePair label="COB test (clot on boiling)" value={cob} onChange={setCob} />
          <TogglePair label="Alcohol test" value={alcohol} onChange={setAlcohol} />
          <TogglePair label="Organoleptic (smell / appearance)" value={organoleptic} onChange={setOrganoleptic} passLabel="Normal" failLabel="Abnormal" />

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-800">Adulteration panel</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Urea % (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  value={ureaPct}
                  onChange={(e) => setUreaPct(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col justify-end">
                <TogglePair label="Added sugar" value={!sugar} onChange={(v) => setSugar(!v)} passLabel="Not detect" failLabel="Detect" />
              </div>
              <div className="sm:col-span-2">
                <TogglePair label="Added salt" value={!salt} onChange={(v) => setSalt(!v)} passLabel="Not detect" failLabel="Detect" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Lab notes</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <p className="text-xs text-slate-500">Optional file upload can be added when storage is wired.</p>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#004080] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#003366] disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit test result'}
          </button>
        </form>
      </div>
    </div>
  )
}
