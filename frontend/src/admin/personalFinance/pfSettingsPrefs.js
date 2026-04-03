/** Client-side app preferences (Personal Finance). Server APIs will replace over time. */

export const LEGACY_CURRENCY_KEY = 'pf_currency_pref'
export const LEGACY_DATE_FMT_KEY = 'pf_date_format_pref'

const STORAGE_KEY = 'pf_app_settings_v1'

/** @typedef {ReturnType<typeof defaultPrefs>} PfAppPrefs */

export function defaultPrefs() {
  return {
    version: 1,
    profile: {
      displayName: '',
      phone: '',
      photoUrl: '',
      profileKind: 'personal',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      country: 'IN',
    },
    preferences: {
      currency: 'INR',
      numberFormat: 'indian',
      dateFormat: 'locale',
      financialYearStartMonth: 4,
      weekStartsOn: 'monday',
      defaultAccountId: '',
      defaultPaymentMethod: 'bank_transfer',
      defaultInvestmentType: 'mutual_fund',
      defaultCreditCardId: '',
    },
    accountsCards: {
      openingBalanceBehavior: 'zero',
      includeInNetWorth: true,
    },
    loans: {
      defaultInterestMethod: 'FLAT',
      defaultEmiDay: 5,
      gracePeriodDays: 0,
      penaltyPercent: 0,
      compoundFrequency: 'monthly',
    },
    investments: {
      defaultReturnPercent: 10,
      sipReminderDay: 1,
      includeInNetWorth: true,
      defaultPlatform: '',
      allocationTargetsNote: '',
    },
    assets: {
      depreciationVehicle: 15,
      depreciationElectronics: 20,
      depreciationFurniture: 10,
      appreciationProperty: 5,
      appreciationGold: 6,
    },
    notifications: {
      emiReminder: true,
      creditCardDue: true,
      billReminder: true,
      sipReminder: false,
      loanDue: true,
      weeklyEmail: false,
      monthlyReportEmail: false,
      largeExpenseAlert: true,
      lowBalanceAlert: true,
      netWorthDropAlert: true,
      monthlyReportReady: false,
      inAppNotifications: true,
      emailNotifications: false,
      whatsappFuture: false,
      soundOnAction: false,
      lowBalanceThreshold: 5000,
      largeExpenseThreshold: 25000,
    },
    dataBackup: {
      autoBackupWeekly: false,
    },
    importPrefs: {
      bankStatementFormat: 'csv',
    },
    security: {
      appLockPin: '',
      sessionLockMinutes: 60,
    },
    appearance: {
      accent: 'indigo',
      fontSize: 'comfortable',
      compactMode: false,
      chartStyle: 'smooth',
      cardStyle: 'glass',
    },
    advanced: {
      ledgerMode: true,
      doubleEntry: false,
      cashflowMode: true,
      netWorthTracking: true,
      businessMode: false,
      multiProfile: true,
      tagsEnabled: false,
    },
    tags: {
      preset: ['family', 'farm', 'business', 'medical', 'trip', 'tax'],
    },
  }
}

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== 'object') return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const k of Object.keys(patch)) {
    const pv = patch[k]
    const bv = out[k]
    if (pv != null && typeof pv === 'object' && !Array.isArray(pv) && typeof bv === 'object' && bv != null && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv)
    } else {
      out[k] = pv
    }
  }
  return out
}

export function loadPfAppPrefs() {
  const defs = defaultPrefs()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return deepMerge(defs, parsed)
    }
  } catch {
    /* ignore */
  }
  try {
    const cur = localStorage.getItem(LEGACY_CURRENCY_KEY)
    const df = localStorage.getItem(LEGACY_DATE_FMT_KEY)
    if (cur || df) {
      return deepMerge(defs, {
        preferences: {
          currency: cur || defs.preferences.currency,
          dateFormat: df || defs.preferences.dateFormat,
        },
      })
    }
  } catch {
    /* ignore */
  }
  return defs
}

export function savePfAppPrefs(/** @type {Partial<PfAppPrefs>} */ patch) {
  const next = deepMerge(loadPfAppPrefs(), patch)
  next.version = 1
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    if (next.preferences?.currency) {
      localStorage.setItem(LEGACY_CURRENCY_KEY, String(next.preferences.currency))
    }
    if (next.preferences?.dateFormat) {
      localStorage.setItem(LEGACY_DATE_FMT_KEY, String(next.preferences.dateFormat))
    }
  } catch {
    /* ignore */
  }
  return next
}
