import {
  ArrowDownTrayIcon,
  BellAlertIcon,
  BuildingLibraryIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CubeIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  TagIcon,
  UserCircleIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import {
  fetchPfMe,
  listCreditCards,
  listFinanceAccounts,
  listPfExpenseCategories,
  listPfIncomeCategories,
  listProfiles,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from './api.js'
import { AppButton } from './pfDesignSystem/index.js'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfSelectCompact,
} from './pfFormStyles.js'
import { usePfToast } from './notifications/pfToastContext.jsx'
import { defaultPrefs, loadPfAppPrefs, savePfAppPrefs } from './pfSettingsPrefs.js'
import { usePfTheme } from './PfThemeContext.jsx'

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: UserCircleIcon },
  { id: 'preferences', label: 'Preferences', icon: Cog6ToothIcon },
  { id: 'accounts-cards', label: 'Accounts & cards', icon: WalletIcon },
  { id: 'categories', label: 'Categories', icon: TagIcon },
  { id: 'loans', label: 'Loans & interest', icon: BuildingLibraryIcon },
  { id: 'investments', label: 'Investments', icon: CurrencyDollarIcon },
  { id: 'assets', label: 'Assets', icon: CubeIcon },
  { id: 'notifications', label: 'Notifications', icon: BellAlertIcon },
  { id: 'data', label: 'Data & backup', icon: CircleStackIcon },
  { id: 'import', label: 'Import', icon: ArrowDownTrayIcon },
  { id: 'security', label: 'Security', icon: ShieldCheckIcon },
  { id: 'appearance', label: 'Appearance', icon: PaintBrushIcon },
  { id: 'advanced', label: 'Advanced', icon: GlobeAltIcon },
]

function SectionCard({ title, description, children }) {
  return (
    <section className={`${cardCls} space-y-4 p-5 sm:p-6`}>
      <div>
        <h2 className="text-lg font-bold text-[var(--pf-text)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--pf-text-muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      {label ? <label className={labelCls}>{label}</label> : null}
      {children}
      {hint ? <p className="text-xs text-[var(--pf-text-muted)]">{hint}</p> : null}
    </div>
  )
}

export default function PfSettingsPage() {
  const { onLogout, onSessionInvalid } = useOutletContext() || {}
  const toast = usePfToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') || 'profile'
  const { preference, setPreference, resolved } = usePfTheme()

  const [prefs, setPrefs] = useState(() => loadPfAppPrefs())
  const [me, setMe] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [accounts, setAccounts] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [expenseCats, setExpenseCats] = useState([])
  const [incomeCats, setIncomeCats] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [exportBusy, setExportBusy] = useState('')

  const patchPrefs = useCallback((partial) => {
    const next = savePfAppPrefs(partial)
    setPrefs(next)
  }, [])

  const goSection = (id) => {
    setSearchParams({ section: id })
  }

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true)
    try {
      const u = await fetchPfMe()
      setMe(u)
    } catch {
      setMe(null)
    }
    try {
      const [p0, a0, c0, ex, inc] = await Promise.all([
        listProfiles().catch(() => []),
        listFinanceAccounts({ limit: 500 }).catch(() => []),
        listCreditCards({ limit: 200 }).catch(() => []),
        listPfExpenseCategories().catch(() => []),
        listPfIncomeCategories().catch(() => []),
      ])
      setProfiles(Array.isArray(p0) ? p0 : [])
      setAccounts(Array.isArray(a0) ? a0 : [])
      setCreditCards(Array.isArray(c0) ? c0 : [])
      setExpenseCats(Array.isArray(ex) ? ex : [])
      setIncomeCats(Array.isArray(inc) ? inc : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      }
    } finally {
      setLoadingMeta(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  async function runExport(key, path) {
    setExportBusy(key)
    try {
      const { blob, filename } = await pfFetchBlob(path)
      const name = filename || `${key}.xlsx`
      triggerDownloadBlob(blob, name)
      toast.success('File exported', name)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        toast.error('Something went wrong', e.message || 'Export failed')
      }
    } finally {
      setExportBusy('')
    }
  }

  const activeSection = useMemo(() => SECTIONS.find((s) => s.id === section)?.id || 'profile', [section])

  const sidebarBtn = (s) => {
    const Icon = s.icon
    const active = activeSection === s.id
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => goSection(s.id)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
          active
            ? 'bg-[var(--pf-primary)] text-white shadow-md'
            : 'text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]'
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'opacity-80'}`} aria-hidden />
        {s.label}
      </button>
    )
  }

  const content = (() => {
    switch (activeSection) {
      case 'profile':
        return (
          <>
            <SectionCard
              title="Profile"
              description="Identity for this workspace. Some fields sync to your login when available."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display name">
                  <input
                    className={inputCls}
                    value={prefs.profile.displayName}
                    onChange={(e) => patchPrefs({ profile: { ...prefs.profile, displayName: e.target.value } })}
                    placeholder={me?.name || 'Your name'}
                  />
                </Field>
                <Field label="Email" hint="From your account (read-only).">
                  <input className={`${inputCls} opacity-80`} readOnly value={me?.email || '—'} />
                </Field>
                <Field label="Phone">
                  <input
                    className={inputCls}
                    value={prefs.profile.phone}
                    onChange={(e) => patchPrefs({ profile: { ...prefs.profile, phone: e.target.value } })}
                    placeholder="+91 …"
                  />
                </Field>
                <Field label="Profile photo URL" hint="Paste an image URL (optional).">
                  <input
                    className={inputCls}
                    value={prefs.profile.photoUrl}
                    onChange={(e) => patchPrefs({ profile: { ...prefs.profile, photoUrl: e.target.value } })}
                    placeholder="https://…"
                  />
                </Field>
                <Field label="Default profile type">
                  <select
                    className={inputCls}
                    value={prefs.profile.profileKind}
                    onChange={(e) => patchPrefs({ profile: { ...prefs.profile, profileKind: e.target.value } })}
                  >
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                  </select>
                </Field>
                <Field label="Timezone">
                  <input
                    className={inputCls}
                    value={prefs.profile.timezone}
                    onChange={(e) => patchPrefs({ profile: { ...prefs.profile, timezone: e.target.value } })}
                  />
                </Field>
                <Field label="Country (ISO)">
                  <input
                    className={inputCls}
                    maxLength={2}
                    value={prefs.profile.country}
                    onChange={(e) => patchPrefs({ profile: { ...prefs.profile, country: e.target.value.toUpperCase() } })}
                  />
                </Field>
              </div>
              <div>
                <p className={labelCls}>Switch finance profile</p>
                <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
                  Profiles separate books (e.g. personal vs farm). Use the profile switcher in the app header when available.
                </p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--pf-text)]">
                  {loadingMeta ? (
                    <li className="text-[var(--pf-text-muted)]">Loading…</li>
                  ) : profiles.length ? (
                    profiles.map((p) => (
                      <li key={p.profile_id}>
                        <span className="font-medium">{p.profile_name ?? `Profile #${p.profile_id}`}</span>
                        <span className="text-[var(--pf-text-muted)]"> · id {p.profile_id}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-[var(--pf-text-muted)]">No profiles returned.</li>
                  )}
                </ul>
              </div>
            </SectionCard>
          </>
        )
      case 'preferences':
        return (
          <SectionCard
            title="Preferences"
            description="Formatting and defaults applied across Personal Finance."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Currency">
                <select
                  className={inputCls}
                  value={prefs.preferences.currency}
                  onChange={(e) => patchPrefs({ preferences: { ...prefs.preferences, currency: e.target.value } })}
                >
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                </select>
              </Field>
              <Field label="Number format">
                <select
                  className={inputCls}
                  value={prefs.preferences.numberFormat}
                  onChange={(e) => patchPrefs({ preferences: { ...prefs.preferences, numberFormat: e.target.value } })}
                >
                  <option value="indian">Indian (1,00,000)</option>
                  <option value="intl">International (100,000)</option>
                </select>
              </Field>
              <Field label="Date format">
                <select
                  className={inputCls}
                  value={prefs.preferences.dateFormat}
                  onChange={(e) => patchPrefs({ preferences: { ...prefs.preferences, dateFormat: e.target.value } })}
                >
                  <option value="locale">System locale</option>
                  <option value="iso">YYYY-MM-DD</option>
                  <option value="in">DD/MM/YYYY</option>
                </select>
              </Field>
              <Field label="Financial year starts">
                <select
                  className={inputCls}
                  value={String(prefs.preferences.financialYearStartMonth)}
                  onChange={(e) =>
                    patchPrefs({
                      preferences: {
                        ...prefs.preferences,
                        financialYearStartMonth: Number(e.target.value),
                      },
                    })
                  }
                >
                  <option value="1">January</option>
                  <option value="4">April (India)</option>
                  <option value="7">July</option>
                </select>
              </Field>
              <Field label="Week starts on">
                <select
                  className={inputCls}
                  value={prefs.preferences.weekStartsOn}
                  onChange={(e) => patchPrefs({ preferences: { ...prefs.preferences, weekStartsOn: e.target.value } })}
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </Field>
              <Field label="Default bank / cash account" hint="Suggested pre-selection on forms (client-side).">
                <select
                  className={inputCls}
                  value={prefs.preferences.defaultAccountId}
                  onChange={(e) => patchPrefs({ preferences: { ...prefs.preferences, defaultAccountId: e.target.value } })}
                >
                  <option value="">None</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.account_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default payment method">
                <select
                  className={inputCls}
                  value={prefs.preferences.defaultPaymentMethod}
                  onChange={(e) =>
                    patchPrefs({ preferences: { ...prefs.preferences, defaultPaymentMethod: e.target.value } })
                  }
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit card</option>
                </select>
              </Field>
              <Field label="Default investment type">
                <select
                  className={inputCls}
                  value={prefs.preferences.defaultInvestmentType}
                  onChange={(e) =>
                    patchPrefs({ preferences: { ...prefs.preferences, defaultInvestmentType: e.target.value } })
                  }
                >
                  <option value="mutual_fund">Mutual fund</option>
                  <option value="stock">Stock</option>
                  <option value="fd">Fixed deposit</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Default credit card" hint="Optional quick-select on card forms.">
                <select
                  className={inputCls}
                  value={prefs.preferences.defaultCreditCardId}
                  onChange={(e) =>
                    patchPrefs({ preferences: { ...prefs.preferences, defaultCreditCardId: e.target.value } })
                  }
                >
                  <option value="">None</option>
                  {creditCards.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.card_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card-hover)]/40 px-4 py-3 text-xs text-[var(--pf-text-muted)]">
              These defaults are stored in your browser and will be consumed by future form flows. Existing pages may not all
              honor every field yet.
            </p>
          </SectionCard>
        )
      case 'accounts-cards': {
        const ac = prefs.accountsCards || defaultPrefs().accountsCards
        return (
          <SectionCard
            title="Accounts & cards"
            description="How new accounts behave and how they roll into net worth."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opening balance default" hint="When adding a new account.">
                <select
                  className={inputCls}
                  value={ac.openingBalanceBehavior}
                  onChange={(e) =>
                    patchPrefs({ accountsCards: { ...ac, openingBalanceBehavior: e.target.value } })
                  }
                >
                  <option value="zero">Start at zero</option>
                  <option value="ask">Ask every time</option>
                  <option value="last">Copy from similar account</option>
                </select>
              </Field>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--pf-border)]"
                checked={ac.includeInNetWorth}
                onChange={(e) => patchPrefs({ accountsCards: { ...ac, includeInNetWorth: e.target.checked } })}
              />
              <span className="text-sm font-medium text-[var(--pf-text)]">Include all accounts in net worth by default</span>
            </label>
            <p className="text-xs text-[var(--pf-text-muted)]">
              Bank, cash, wallet, and credit lines each have types in your ledger. Fine-tune per account on the Accounts
              page.
            </p>
          </SectionCard>
        )
      }
      case 'categories':
        return (
          <>
            <SectionCard
              title="Categories"
              description="Workspace master categories power expenses, income, and many reports."
            >
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                <strong>Add / edit / delete</strong> for master categories is controlled server-side today (seed data &
                database). This panel lists what the API returns; full CRUD can be added as an admin API next.
              </p>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Expense categories</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {expenseCats.length ? (
                      expenseCats.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--pf-border)] px-3 py-1 text-xs font-semibold"
                        >
                          {c.color ? (
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                          ) : null}
                          {c.icon ? <span className="opacity-70">{c.icon}</span> : null}
                          {c.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--pf-text-muted)]">{loadingMeta ? 'Loading…' : 'None'}</span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Income categories</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {incomeCats.length ? (
                      incomeCats.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--pf-border)] px-3 py-1 text-xs font-semibold"
                        >
                          {c.color ? (
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                          ) : null}
                          {c.icon ? <span className="opacity-70">{c.icon}</span> : null}
                          {c.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--pf-text-muted)]">{loadingMeta ? 'Loading…' : 'None'}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={`${cardCls} border border-dashed p-4`}>
                  <h4 className="font-bold text-[var(--pf-text)]">Investment categories</h4>
                  <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
                    Map investment fees and charges using expense categories, or extend the schema with dedicated
                    investment tags later.
                  </p>
                </div>
                <div className={`${cardCls} border border-dashed p-4`}>
                  <h4 className="font-bold text-[var(--pf-text)]">Asset categories</h4>
                  <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
                    Fixed assets use typed enums (house, gold, vehicle). No separate category list is required yet.
                  </p>
                </div>
              </div>
            </SectionCard>
          </>
        )
      case 'loans': {
        const L = prefs.loans || defaultPrefs().loans
        return (
          <SectionCard title="Loans & interest" description="Defaults for new loans you originate or record.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default interest method">
                <select
                  className={inputCls}
                  value={L.defaultInterestMethod}
                  onChange={(e) => patchPrefs({ loans: { ...L, defaultInterestMethod: e.target.value } })}
                >
                  <option value="FLAT">Flat</option>
                  <option value="REDUCING">Reducing balance</option>
                  <option value="SIMPLE">Simple</option>
                </select>
              </Field>
              <Field label="Default EMI day (1–28)">
                <input
                  type="number"
                  min={1}
                  max={28}
                  className={inputCls}
                  value={L.defaultEmiDay}
                  onChange={(e) => patchPrefs({ loans: { ...L, defaultEmiDay: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Grace period (days)">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={L.gracePeriodDays}
                  onChange={(e) => patchPrefs({ loans: { ...L, gracePeriodDays: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Penalty % (annual, indicative)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={L.penaltyPercent}
                  onChange={(e) => patchPrefs({ loans: { ...L, penaltyPercent: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Compound frequency">
                <select
                  className={inputCls}
                  value={L.compoundFrequency}
                  onChange={(e) => patchPrefs({ loans: { ...L, compoundFrequency: e.target.value } })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
            </div>
          </SectionCard>
        )
      }
      case 'investments': {
        const I = prefs.investments || defaultPrefs().investments
        return (
          <SectionCard title="Investments" description="Planning defaults and net-worth behaviour.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Assumed default return % (planning)">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputCls}
                  value={I.defaultReturnPercent}
                  onChange={(e) => patchPrefs({ investments: { ...I, defaultReturnPercent: Number(e.target.value) } })}
                />
              </Field>
              <Field label="SIP reminder day">
                <input
                  type="number"
                  min={1}
                  max={28}
                  className={inputCls}
                  value={I.sipReminderDay}
                  onChange={(e) => patchPrefs({ investments: { ...I, sipReminderDay: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Default platform / broker" hint="Free text (Groww, Zerodha, …).">
                <input
                  className={inputCls}
                  value={I.defaultPlatform}
                  onChange={(e) => patchPrefs({ investments: { ...I, defaultPlatform: e.target.value } })}
                />
              </Field>
              <Field label="Allocation target notes" hint="Optional targets (e.g. 60/30/10).">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={I.allocationTargetsNote}
                  onChange={(e) => patchPrefs({ investments: { ...I, allocationTargetsNote: e.target.value } })}
                />
              </Field>
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--pf-border)]"
                checked={I.includeInNetWorth}
                onChange={(e) => patchPrefs({ investments: { ...I, includeInNetWorth: e.target.checked } })}
              />
              <span className="text-sm font-medium text-[var(--pf-text)]">Include investments in net worth snapshot</span>
            </label>
          </SectionCard>
        )
      }
      case 'assets': {
        const A = prefs.assets || defaultPrefs().assets
        return (
          <SectionCard
            title="Assets"
            description="Reference defaults for depreciation / appreciation hints (aligned with your ledger logic)."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vehicle depreciation % / yr">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={A.depreciationVehicle}
                  onChange={(e) => patchPrefs({ assets: { ...A, depreciationVehicle: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Electronics depreciation % / yr">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={A.depreciationElectronics}
                  onChange={(e) => patchPrefs({ assets: { ...A, depreciationElectronics: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Furniture depreciation % / yr">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={A.depreciationFurniture}
                  onChange={(e) => patchPrefs({ assets: { ...A, depreciationFurniture: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Property appreciation % / yr (planning)">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputCls}
                  value={A.appreciationProperty}
                  onChange={(e) => patchPrefs({ assets: { ...A, appreciationProperty: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Gold appreciation % / yr (planning)">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputCls}
                  value={A.appreciationGold}
                  onChange={(e) => patchPrefs({ assets: { ...A, appreciationGold: Number(e.target.value) } })}
                />
              </Field>
            </div>
          </SectionCard>
        )
      }
      case 'notifications': {
        const N = prefs.notifications || defaultPrefs().notifications
        const row = (key, label, hint) => (
          <label
            key={key}
            className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-[var(--pf-border)] px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--pf-text)]">{label}</span>
              {hint ? <span className="mt-0.5 block text-xs text-[var(--pf-text-muted)]">{hint}</span> : null}
            </span>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--pf-border)]"
              checked={!!N[key]}
              onChange={(e) => patchPrefs({ notifications: { ...N, [key]: e.target.checked } })}
            />
          </label>
        )
        return (
          <div className="space-y-6">
            <SectionCard
              title="Reminders"
              description="What we watch for in the notification bell and future email / push delivery."
            >
              <div className="space-y-2">
                {row('emiReminder', 'EMI due reminders', 'Borrowed liabilities with upcoming installments')}
                {row('creditCardDue', 'Credit card due reminders', 'Open statements and due dates')}
                {row('loanDue', 'Loan EMI reminders', 'Money you lent — expected repayments')}
                {row('sipReminder', 'SIP reminders', `Monthly nudge on day ${prefs.investments?.sipReminderDay || 1}`)}
                {row('billReminder', 'Bill reminders', 'General payable / bill-style alerts in the feed')}
              </div>
            </SectionCard>
            <SectionCard title="Alerts" description="Threshold-based nudges in the notification panel.">
              <div className="space-y-2">
                {row('largeExpenseAlert', 'Large expense alert', 'Flags the biggest expense this month vs your threshold')}
                <Field label="Large expense threshold (₹)">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className={inputCls}
                    value={N.largeExpenseThreshold ?? 25000}
                    onChange={(e) =>
                      patchPrefs({
                        notifications: { ...N, largeExpenseThreshold: Number(e.target.value) || 0 },
                      })
                    }
                  />
                </Field>
                {row('lowBalanceAlert', 'Low balance alert', 'Any liquid account below the threshold')}
                <Field label="Low balance threshold (₹)">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    className={inputCls}
                    value={N.lowBalanceThreshold ?? 5000}
                    onChange={(e) =>
                      patchPrefs({
                        notifications: { ...N, lowBalanceThreshold: Number(e.target.value) || 0 },
                      })
                    }
                  />
                </Field>
                {row('netWorthDropAlert', 'Net worth drop alert', 'When the book NW series dips vs the prior point')}
              </div>
            </SectionCard>
            <SectionCard title="Reports" description="Longer-form summaries (email when connected).">
              <div className="space-y-2">
                {row('weeklyEmail', 'Weekly summary email', 'Planned delivery')}
                {row('monthlyReportEmail', 'Monthly report email', 'Planned delivery')}
                {row(
                  'monthlyReportReady',
                  'Monthly report in-app prompt',
                  'Show a gentle nudge when a new month starts (bell feed)',
                )}
              </div>
            </SectionCard>
            <SectionCard title="Delivery & UX" description="How notifications reach you in this app.">
              <div className="space-y-2">
                {row('inAppNotifications', 'In-app notifications', 'Bell icon and side panel')}
                {row('emailNotifications', 'Email notifications', 'Requires SMTP / provider setup later')}
                {row('whatsappFuture', 'WhatsApp (future)', 'Placeholder — not active')}
                {row('soundOnAction', 'Subtle sound on success', 'Tiny chime when saves / exports succeed')}
              </div>
            </SectionCard>
          </div>
        )
      }
      case 'data':
        return (
          <SectionCard title="Data & backup" description="Exports use your active finance profile and auth session.">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <AppButton
                type="button"
                variant="secondary"
                disabled={!!exportBusy}
                onClick={() => runExport('expenses', '/pf/export/expenses/excel')}
              >
                {exportBusy === 'expenses' ? '…' : 'Expenses (Excel)'}
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                disabled={!!exportBusy}
                onClick={() => runExport('income', '/pf/export/income/excel')}
              >
                {exportBusy === 'income' ? '…' : 'Income (Excel)'}
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                disabled={!!exportBusy}
                onClick={() => runExport('investments', '/pf/export/investments/excel')}
              >
                {exportBusy === 'investments' ? '…' : 'Investments (Excel)'}
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                disabled={!!exportBusy}
                onClick={() => runExport('assets', '/pf/export/assets/excel')}
              >
                {exportBusy === 'assets' ? '…' : 'Fixed assets (Excel)'}
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                disabled={!!exportBusy}
                onClick={() => runExport('liabilities', '/pf/export/liabilities/excel')}
              >
                {exportBusy === 'liabilities' ? '…' : 'Liabilities (Excel)'}
              </AppButton>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--pf-border)] px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={prefs.dataBackup.autoBackupWeekly}
                  onChange={(e) => patchPrefs({ dataBackup: { ...prefs.dataBackup, autoBackupWeekly: e.target.checked } })}
                />
                <span className="text-sm text-[var(--pf-text)]">Auto backup weekly (local reminder)</span>
              </label>
            </div>
            <p className="text-xs text-[var(--pf-text-muted)]">
              Cloud backup (Drive / Dropbox) needs OAuth integration — planned. For now use scheduled exports and store
              files safely.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled className={`${btnSecondary} opacity-50`}>
                Backup to Google Drive
              </button>
              <button type="button" disabled className={`${btnSecondary} opacity-50`}>
                Backup to Dropbox
              </button>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-sm font-bold text-red-800 dark:text-red-200">Delete all data</p>
              <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
                Not available from the browser for safety. Use database / admin tools with a full backup first.
              </p>
            </div>
            <Link to="/personal-finance/reports" className={`${btnSecondary} inline-flex justify-center no-underline`}>
              Open reports hub
            </Link>
          </SectionCard>
        )
      case 'import':
        return (
          <SectionCard title="Import" description="Bring data in from files and statements.">
            <p className="text-sm text-[var(--pf-text-muted)]">
              Bulk import pipelines (CSV / Excel / bank PDF) are being lined up with your ledger validators. Use exports
              + manual entry until import wizards ship.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Preferred bank statement format (planner)">
                <select
                  className={inputCls}
                  value={prefs.importPrefs.bankStatementFormat}
                  onChange={(e) => patchPrefs({ importPrefs: { ...prefs.importPrefs, bankStatementFormat: e.target.value } })}
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel</option>
                  <option value="mt940">MT940</option>
                </select>
              </Field>
            </div>
            <button type="button" disabled className={`${btnPrimary} opacity-50`}>
              Upload file (coming soon)
            </button>
          </SectionCard>
        )
      case 'security': {
        const S = prefs.security || defaultPrefs().security
        return (
          <SectionCard title="Security" description="Session and device posture.">
            <Field label="App lock PIN (stored locally only)" hint="Optional 4–6 digits; not synced to server.">
              <input
                type="password"
                className={inputCls}
                autoComplete="new-password"
                value={S.appLockPin}
                onChange={(e) => patchPrefs({ security: { ...S, appLockPin: e.target.value.replace(/\D/g, '').slice(0, 6) } })}
                placeholder="••••"
              />
            </Field>
            <Field label="Lock session after (minutes, UI hint only)">
              <input
                type="number"
                min={5}
                className={inputCls}
                value={S.sessionLockMinutes}
                onChange={(e) => patchPrefs({ security: { ...S, sessionLockMinutes: Number(e.target.value) } })}
              />
            </Field>
            <div className="rounded-xl border border-[var(--pf-border)] p-4 text-sm text-[var(--pf-text-muted)]">
              <p>
                <strong className="text-[var(--pf-text)]">Two-factor auth</strong> and password changes are handled by your
                platform login. Ask your administrator if you need 2FA enforced.
              </p>
              <p className="mt-2">Login history is not exposed in this build.</p>
            </div>
            <button type="button" onClick={onLogout} className={btnDanger}>
              Log out of this device
            </button>
          </SectionCard>
        )
      }
      case 'appearance': {
        const Ap = prefs.appearance || defaultPrefs().appearance
        return (
          <>
            <SectionCard title="Appearance" description="Look and feel across Personal Finance.">
              <div>
                <p className={labelCls}>Theme</p>
                <p className="mb-3 text-xs text-[var(--pf-text-muted)]">
                  Active mode: {resolved === 'dark' ? 'Dark' : 'Light'}
                </p>
                <fieldset className="space-y-2">
                  {['light', 'dark', 'system'].map((opt) => (
                    <label
                      key={opt}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--pf-border)] px-3 py-2.5"
                    >
                      <input
                        type="radio"
                        name="pf-theme-settings"
                        checked={preference === opt}
                        onChange={() => setPreference(opt)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm capitalize text-[var(--pf-text)]">{opt}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Accent (saved for future theming)">
                  <select
                    className={inputCls}
                    value={Ap.accent}
                    onChange={(e) => patchPrefs({ appearance: { ...Ap, accent: e.target.value } })}
                  >
                    <option value="indigo">Indigo</option>
                    <option value="emerald">Emerald</option>
                    <option value="rose">Rose</option>
                    <option value="amber">Amber</option>
                  </select>
                </Field>
                <Field label="Font size">
                  <select
                    className={inputCls}
                    value={Ap.fontSize}
                    onChange={(e) => patchPrefs({ appearance: { ...Ap, fontSize: e.target.value } })}
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="large">Large</option>
                  </select>
                </Field>
                <Field label="Chart style">
                  <select
                    className={inputCls}
                    value={Ap.chartStyle}
                    onChange={(e) => patchPrefs({ appearance: { ...Ap, chartStyle: e.target.value } })}
                  >
                    <option value="smooth">Smooth</option>
                    <option value="sharp">Sharp / stepped</option>
                  </select>
                </Field>
                <Field label="Card style">
                  <select
                    className={inputCls}
                    value={Ap.cardStyle}
                    onChange={(e) => patchPrefs({ appearance: { ...Ap, cardStyle: e.target.value } })}
                  >
                    <option value="glass">Glass</option>
                    <option value="solid">Solid</option>
                  </select>
                </Field>
              </div>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--pf-border)]"
                  checked={Ap.compactMode}
                  onChange={(e) => patchPrefs({ appearance: { ...Ap, compactMode: e.target.checked } })}
                />
                <span className="text-sm font-medium text-[var(--pf-text)]">Compact mode (denser tables)</span>
              </label>
            </SectionCard>
          </>
        )
      }
      case 'advanced': {
        const Ad = prefs.advanced || defaultPrefs().advanced
        const tg = prefs.tags || defaultPrefs().tags
        const toggle = (k) => (
          <label
            key={k}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--pf-border)] px-4 py-3"
          >
            <span className="text-sm font-medium capitalize text-[var(--pf-text)]">{k.replace(/([A-Z])/g, ' $1')}</span>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--pf-border)]"
              checked={!!Ad[k]}
              onChange={(e) => patchPrefs({ advanced: { ...Ad, [k]: e.target.checked } })}
            />
          </label>
        )
        return (
          <SectionCard
            title="Advanced"
            description="Power-user modes. Toggles are stored locally until backend feature flags exist."
          >
            <div className="space-y-2">
              {toggle('ledgerMode')}
              {toggle('doubleEntry')}
              {toggle('cashflowMode')}
              {toggle('netWorthTracking')}
              {toggle('businessMode')}
              {toggle('multiProfile')}
              {toggle('tagsEnabled')}
            </div>
            <div>
              <p className={labelCls}>Suggested tags (reports &amp; filters)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(tg.preset || []).map((t) => (
                  <span key={t} className="rounded-full border border-[var(--pf-border)] px-3 py-1 text-xs font-semibold">
                    #{t}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--pf-text-muted)]">
                Tagging UX on transactions is next; enabling &ldquo;Tags&rdquo; here flags your profile for future report
                filters.
              </p>
            </div>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                if (window.confirm('Reset local Personal Finance preferences to defaults?')) {
                  try {
                    localStorage.removeItem('pf_app_settings_v1')
                  } catch {
                    /* ignore */
                  }
                  setPrefs(loadPfAppPrefs())
                }
              }}
            >
              Reset preferences to defaults
            </button>
          </SectionCard>
        )
      }
      default:
        return null
    }
  })()

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <PageHeader
        title="Settings"
        description="System control panel for your Personal Finance workspace — profile, defaults, categories, data, and safety."
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:w-64 lg:shrink-0 xl:w-72">
          <div className={`${cardCls} p-3 lg:sticky lg:top-4`}>
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--pf-text-muted)]">
              Navigate
            </p>
            <nav className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
              {SECTIONS.map(sidebarBtn)}
            </nav>
          </div>
          <div className="mt-3 lg:hidden">
            <label htmlFor="pf-settings-mobile-nav" className={labelCls}>
              Jump to section
            </label>
            <select
              id="pf-settings-mobile-nav"
              className={`${pfSelectCompact} mt-1 w-full`}
              value={activeSection}
              onChange={(e) => goSection(e.target.value)}
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">{content}</main>
      </div>

      <Link
        to="/personal-finance/more"
        className="inline-flex text-sm font-semibold text-[var(--pf-primary)] hover:underline"
      >
        ← Back to More
      </Link>
    </div>
  )
}
