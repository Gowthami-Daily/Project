import { Link, useOutletContext } from 'react-router-dom'
import { btnDanger, btnSecondary, cardCls, labelCls } from './pfFormStyles.js'
import { usePfTheme } from './PfThemeContext.jsx'

const CURRENCY_KEY = 'pf_currency_pref'
const DATE_FMT_KEY = 'pf_date_format_pref'

export default function PfSettingsPage() {
  const { onLogout } = useOutletContext() || {}
  const { preference, setPreference, resolved } = usePfTheme()

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Appearance and preferences</p>
      </div>

      <section className={cardCls} aria-labelledby="pf-theme-heading">
        <h2 id="pf-theme-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
          Theme
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Active: {resolved === 'dark' ? 'Dark' : 'Light'}</p>
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Color theme</legend>
          {[
            { id: 'light', label: 'Light' },
            { id: 'dark', label: 'Dark' },
            { id: 'system', label: 'System default' },
          ].map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-slate-200/80 px-3 py-2.5 transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/50"
            >
              <input
                type="radio"
                name="pf-theme"
                value={opt.id}
                checked={preference === opt.id}
                onChange={() => setPreference(opt.id)}
                className="h-4 w-4 border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
              />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{opt.label}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className={cardCls} aria-labelledby="pf-currency-heading">
        <h2 id="pf-currency-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
          Currency
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Display symbol for new features (₹ default).</p>
        <label htmlFor="pf-currency" className={`${labelCls} mt-3`}>
          Symbol
        </label>
        <select
          id="pf-currency"
          className="mt-1 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          defaultValue={typeof localStorage !== 'undefined' ? localStorage.getItem(CURRENCY_KEY) || 'INR' : 'INR'}
          onChange={(e) => {
            try {
              localStorage.setItem(CURRENCY_KEY, e.target.value)
            } catch {
              /* ignore */
            }
          }}
        >
          <option value="INR">₹ Indian rupee (INR)</option>
          <option value="USD">$ US dollar (USD)</option>
        </select>
      </section>

      <section className={cardCls} aria-labelledby="pf-date-heading">
        <h2 id="pf-date-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
          Date format
        </h2>
        <label htmlFor="pf-datefmt" className={`${labelCls} mt-3`}>
          Locale style
        </label>
        <select
          id="pf-datefmt"
          className="mt-1 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          defaultValue={typeof localStorage !== 'undefined' ? localStorage.getItem(DATE_FMT_KEY) || 'locale' : 'locale'}
          onChange={(e) => {
            try {
              localStorage.setItem(DATE_FMT_KEY, e.target.value)
            } catch {
              /* ignore */
            }
          }}
        >
          <option value="locale">System locale</option>
          <option value="iso">YYYY-MM-DD</option>
          <option value="in">DD/MM/YYYY</option>
        </select>
      </section>

      <section className={cardCls}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Data</h2>
        <div className="mt-4 flex flex-col gap-3">
          <Link
            to="/personal-finance/reports"
            className={`${btnSecondary} justify-center text-center no-underline`}
          >
            Export data
          </Link>
          <button type="button" disabled className={`${btnSecondary} cursor-not-allowed opacity-50`} title="Coming soon">
            Backup to Google Drive
          </button>
        </div>
      </section>

      <button type="button" onClick={onLogout} className={`${btnDanger} w-full`}>
        Logout
      </button>

      <Link to="/personal-finance/more" className="block text-center text-sm font-semibold text-[#1E3A8A] dark:text-blue-400">
        ← Back to More
      </Link>
    </div>
  )
}
