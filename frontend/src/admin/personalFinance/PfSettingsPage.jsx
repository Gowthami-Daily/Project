import { Link, useOutletContext } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { btnDanger, btnSecondary, cardCls, labelCls } from './pfFormStyles.js'
import { usePfTheme } from './PfThemeContext.jsx'

const CURRENCY_KEY = 'pf_currency_pref'
const DATE_FMT_KEY = 'pf_date_format_pref'

export default function PfSettingsPage() {
  const { onLogout } = useOutletContext() || {}
  const { preference, setPreference, resolved } = usePfTheme()

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-8">
      <PageHeader title="Settings" description="Appearance and preferences" />

      <section className={`${cardCls} max-w-lg`} aria-labelledby="pf-theme-heading">
        <h2 id="pf-theme-heading" className="text-base font-bold text-[var(--pf-text)]">
          Theme
        </h2>
        <p className="mt-1 text-xs text-[var(--pf-text-muted)]">Active: {resolved === 'dark' ? 'Dark' : 'Light'}</p>
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Color theme</legend>
          {[
            { id: 'light', label: 'Light' },
            { id: 'dark', label: 'Dark' },
            { id: 'system', label: 'System default' },
          ].map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[var(--pf-border)] px-3 py-2.5 transition hover:bg-[var(--pf-card-hover)]"
            >
              <input
                type="radio"
                name="pf-theme"
                value={opt.id}
                checked={preference === opt.id}
                onChange={() => setPreference(opt.id)}
                className="h-4 w-4 border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
              />
              <span className="text-sm font-semibold text-[var(--pf-text)]">{opt.label}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className={`${cardCls} max-w-lg`} aria-labelledby="pf-currency-heading">
        <h2 id="pf-currency-heading" className="text-base font-bold text-[var(--pf-text)]">
          Currency
        </h2>
        <p className="mt-1 text-xs text-[var(--pf-text-muted)]">Display symbol for new features (₹ default).</p>
        <label htmlFor="pf-currency" className={`${labelCls} mt-3`}>
          Symbol
        </label>
        <select
          id="pf-currency"
          className="mt-1 w-full rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-input-bg)] px-3 py-2 text-sm text-[var(--pf-text)]"
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

      <section className={`${cardCls} max-w-lg`} aria-labelledby="pf-date-heading">
        <h2 id="pf-date-heading" className="text-base font-bold text-[var(--pf-text)]">
          Date format
        </h2>
        <label htmlFor="pf-datefmt" className={`${labelCls} mt-3`}>
          Locale style
        </label>
        <select
          id="pf-datefmt"
          className="mt-1 w-full rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-input-bg)] px-3 py-2 text-sm text-[var(--pf-text)]"
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

      <section className={`${cardCls} max-w-lg`}>
        <h2 className="text-base font-bold text-[var(--pf-text)]">Data</h2>
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

      <Link to="/personal-finance/more" className="block max-w-lg text-center text-sm font-semibold text-[var(--pf-primary)]">
        ← Back to More
      </Link>
    </div>
  )
}
