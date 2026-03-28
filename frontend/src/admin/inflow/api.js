const BASE = '/fastapi/inflow'

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

export function getCenters() {
  return fetch(`${BASE}/centers`).then(parseJson)
}

export function getQaSummary(params) {
  const q = new URLSearchParams()
  if (params?.date) q.set('date', params.date)
  if (params?.center_id != null && params.center_id !== '') q.set('center_id', String(params.center_id))
  const s = q.toString()
  return fetch(`${BASE}/qa/summary${s ? `?${s}` : ''}`).then(parseJson)
}

export function getQaTests(params) {
  const q = new URLSearchParams()
  if (params?.date) q.set('date', params.date)
  if (params?.center_id != null && params.center_id !== '') q.set('center_id', String(params.center_id))
  const s = q.toString()
  return fetch(`${BASE}/qa/tests${s ? `?${s}` : ''}`).then(parseJson)
}

export function postQaTest(body) {
  return fetch(`${BASE}/qa/tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseJson)
}

export function getCenterAnalytics() {
  return fetch(`${BASE}/centers/analytics`).then(parseJson)
}

export function getTanks() {
  return fetch(`${BASE}/inventory/tanks`).then(parseJson)
}

export function getTankTransactions(limit = 50) {
  return fetch(`${BASE}/inventory/transactions?limit=${limit}`).then(parseJson)
}
