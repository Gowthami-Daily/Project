import { useState } from 'react'

const defaults = [
  { id: 'dispatch_sms', label: 'Dispatch confirmation SMS', desc: 'Send when vehicle leaves hub for morning route.', on: true },
  { id: 'low_wallet', label: 'Low wallet alerts', desc: 'SMS + WhatsApp when balance drops below threshold.', on: true },
  { id: 'vacation', label: 'Vacation / pause confirmations', desc: 'In-app and SMS when customer pauses subscription.', on: true },
  { id: 'qa_fail', label: 'QA lab failures', desc: 'Notify hub manager when a batch fails organoleptic or adulteration tests.', on: true },
  { id: 'farmer_pay', label: 'Farmer payout remittance', desc: 'SMS to farmer when bank transfer is initiated.', on: false },
  { id: 'route_delay', label: 'Route delay escalation', desc: 'Alert ops if agent is idle beyond SLA.', on: true },
  { id: 'tank_temp', label: 'Tank temperature breach', desc: 'Push to maintenance group when temp exceeds 4°C.', on: true },
  { id: 'digest', label: 'Daily executive digest', desc: 'Email summary at 6:00 PM with KPIs.', on: false },
]

function Toggle({ checked, onChange, id }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-[#004080]' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`}
      />
    </button>
  )
}

export default function Notifications() {
  const [items, setItems] = useState(defaults)

  function setOn(id, on) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, on } : x)))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
        <p className="mt-1 text-sm text-slate-600">
          Channel preferences for automated messages (SMS, WhatsApp, email, in-app).
        </p>
      </div>

      <ul className="max-w-2xl divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{item.label}</p>
              <p className="mt-0.5 text-sm text-slate-600">{item.desc}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
              <Toggle id={item.id} checked={item.on} onChange={(v) => setOn(item.id, v)} />
              <span className="text-xs font-medium text-slate-500">{item.on ? 'On' : 'Off'}</span>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="rounded-xl bg-[#004080] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
      >
        Save notification settings
      </button>
    </div>
  )
}
