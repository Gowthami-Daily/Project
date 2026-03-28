const input =
  'mt-1.5 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20'
const label = 'block text-xs font-bold uppercase tracking-wide text-slate-500'

export default function SystemConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">System configuration</h3>
        <p className="mt-1 text-sm text-slate-600">
          Localization, fiscal calendar, retention, and integration placeholders.
        </p>
      </div>

      <form
        className="max-w-2xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="tz">
              Time zone
            </label>
            <select id="tz" name="timezone" className={input} defaultValue="Asia/Kolkata">
              <option value="Asia/Kolkata">Asia / Kolkata (IST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="currency">
              Currency
            </label>
            <select id="currency" name="currency" className={input} defaultValue="INR">
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="fiscal">
              Fiscal year start
            </label>
            <input id="fiscal" type="date" name="fiscalStart" defaultValue="2026-04-01" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="locale">
              Locale & number format
            </label>
            <select id="locale" name="locale" className={input} defaultValue="en-IN">
              <option value="en-IN">English (India)</option>
              <option value="te-IN">Telugu (India)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="retention">
              Audit log retention (days)
            </label>
            <input id="retention" type="number" name="retention" min={30} defaultValue={365} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="cutoff">
              Morning dispatch cut-off (local time)
            </label>
            <input id="cutoff" type="time" name="cutoff" defaultValue="05:30" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="webhook">
              Outbound webhook URL (optional)
            </label>
            <input
              id="webhook"
              type="url"
              name="webhook"
              placeholder="https://api.example.com/hooks/gowthami"
              className={`${input} max-w-full font-mono text-xs sm:text-sm`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="apiKey">
              API key (masked)
            </label>
            <input
              id="apiKey"
              type="password"
              name="apiKey"
              autoComplete="off"
              placeholder="••••••••••••"
              className={`${input} max-w-full font-mono`}
            />
            <p className="mt-1 text-xs text-slate-500">Rotate keys from your cloud console; never commit secrets.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">
          <button
            type="submit"
            className="rounded-xl bg-[#004080] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
          >
            Save configuration
          </button>
          <button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Reset to defaults
          </button>
        </div>
      </form>
    </div>
  )
}
