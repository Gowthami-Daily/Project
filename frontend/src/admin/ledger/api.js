import { fastapiUrl } from '../../lib/fastapiBase.js'

const BASE = fastapiUrl('/ledger')

async function parseJson(res) {
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      const j = JSON.parse(text)
      detail = j.detail ?? JSON.stringify(j)
    } catch {
      /* ignore */
    }
    throw new Error(detail || res.statusText)
  }
  return text ? JSON.parse(text) : null
}

export function inr(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function getPL(year, month) {
  const q = new URLSearchParams()
  if (year != null) q.set('year', String(year))
  if (month != null) q.set('month', String(month))
  const s = q.toString()
  return fetch(`${BASE}/pl/mtd${s ? `?${s}` : ''}`).then(parseJson)
}

export function getWalletSummary() {
  return fetch(`${BASE}/wallets/summary`).then(parseJson)
}

export function getWalletTopups() {
  return fetch(`${BASE}/wallets/topups`).then(parseJson)
}

export function patchTopup(id, body) {
  return fetch(`${BASE}/wallets/topups/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseJson)
}

export function getOpexSummary(year, month) {
  const q = new URLSearchParams()
  if (year != null) q.set('year', String(year))
  if (month != null) q.set('month', String(month))
  const s = q.toString()
  return fetch(`${BASE}/opex/summary${s ? `?${s}` : ''}`).then(parseJson)
}

export function getOpexCategories() {
  return fetch(`${BASE}/opex/categories`).then(parseJson)
}

export function getOpexExpenses(params) {
  const q = new URLSearchParams()
  if (params?.year != null) q.set('year', String(params.year))
  if (params?.month != null) q.set('month', String(params.month))
  if (params?.category_id != null) q.set('category_id', String(params.category_id))
  const s = q.toString()
  return fetch(`${BASE}/opex/expenses${s ? `?${s}` : ''}`).then(parseJson)
}

export function postOpexExpense(body) {
  return fetch(`${BASE}/opex/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseJson)
}

export function getScalingAnalytics() {
  return fetch(`${BASE}/analytics/scaling`).then(parseJson)
}
