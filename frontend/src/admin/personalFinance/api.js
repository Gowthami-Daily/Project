const BASE = '/api/v1'

const TOKEN_KEY = 'gowthami_pf_access_token'

export function getPfToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/** Read ``active_profile_id`` claim from JWT (client-side, no verification). */
export function readActiveProfileIdFromToken() {
  const t = getPfToken()
  if (!t) return null
  try {
    let b64 = t.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (!b64) return null
    while (b64.length % 4) b64 += '='
    const json = atob(b64)
    const payload = JSON.parse(json)
    const id = payload.active_profile_id
    return id != null && id !== '' ? Number(id) : null
  } catch {
    return null
  }
}

export function setPfToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function authHeaders() {
  const t = getPfToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function parseJson(res) {
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      const j = JSON.parse(text)
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j)
    } catch {
      /* ignore */
    }
    const err = new Error(detail || res.statusText)
    err.status = res.status
    throw err
  }
  return text ? JSON.parse(text) : null
}

export async function pfFetch(path, options = {}) {
  const { headers: extra = {}, ...rest } = options
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...extra,
    },
  })
  return parseJson(res)
}

/** JSON login — stores token client-side; caller should call setPfToken. */
export async function loginPf(email, password) {
  const res = await fetch(`${BASE}/auth/login/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(typeof data.detail === 'string' ? data.detail : 'Login failed')
    err.status = res.status
    throw err
  }
  return data
}

export function listProfiles() {
  return pfFetch('/pf/profiles/mine')
}

export function switchProfile(profileId) {
  return pfFetch('/pf/profiles/switch', {
    method: 'POST',
    body: JSON.stringify({ profile_id: profileId }),
  })
}

export function getDashboardSummary() {
  return pfFetch('/pf/dashboard/summary')
}

export function getIncomeVsExpense(year) {
  const q = year != null ? `?year=${encodeURIComponent(year)}` : ''
  return pfFetch(`/pf/dashboard/income-vs-expense${q}`)
}

export function getExpenseByCategory(start, end) {
  const p = new URLSearchParams()
  if (start) p.set('start_date', start)
  if (end) p.set('end_date', end)
  const s = p.toString()
  return pfFetch(`/pf/dashboard/expense-category${s ? `?${s}` : ''}`)
}

export function getNetworthGrowth(year) {
  const q = year != null ? `?year=${encodeURIComponent(year)}` : ''
  return pfFetch(`/pf/dashboard/networth-growth${q}`)
}

export function getInvestmentAllocation() {
  return pfFetch('/pf/dashboard/investment-allocation')
}
