import { useState } from 'react'

const items = [
  { id: 'low', label: 'Low wallet balance', desc: 'SMS + WhatsApp before morning dispatch cut-off.' },
  { id: 'done', label: 'Delivery completed', desc: 'POD confirmation to customer.' },
  { id: 'recharge', label: 'Recharge received', desc: 'Thank-you + updated balance.' },
  { id: 'vac_end', label: 'Vacation ending', desc: 'Remind 1 day before resume.' },
  { id: 'offers', label: 'New offers / upsell', desc: 'Curd, paneer, ghee promos (opt-in).' },
]

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-[#004080]' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

export default function CustomerNotificationsPage() {
  const [on, setOn] = useState(() =>
    Object.fromEntries(items.map((x) => [x.id, true]))
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Outbound SMS / WhatsApp templates — integrate with telecom provider; log sends in <code className="rounded bg-slate-100 px-1">notifications</code>.
      </p>
      <ul className="max-w-2xl divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">{item.label}</p>
              <p className="mt-0.5 text-sm text-slate-600">{item.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <Toggle checked={on[item.id]} onChange={(v) => setOn((s) => ({ ...s, [item.id]: v }))} />
              <span className="text-xs text-slate-500">{on[item.id] ? 'On' : 'Off'}</span>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="rounded-xl bg-[#004080] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#003366]">
        Save notification rules
      </button>
    </div>
  )
}
