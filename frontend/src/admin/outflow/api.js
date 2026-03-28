const BASE = '/fastapi/outflow'

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

export function getCrmSummary() {
  return fetch(`${BASE}/crm/summary`).then(parseJson)
}

export function getCrmTriggers() {
  return fetch(`${BASE}/crm/triggers`).then(parseJson)
}

export function patchCrmTrigger(triggerKey, body) {
  return fetch(`${BASE}/crm/triggers/${encodeURIComponent(triggerKey)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseJson)
}

export function postBroadcast(message) {
  return fetch(`${BASE}/crm/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }).then(parseJson)
}

export function getCrateKpis(params) {
  const q = new URLSearchParams()
  if (params?.route_code) q.set('route_code', params.route_code)
  const s = q.toString()
  return fetch(`${BASE}/crates/kpis${s ? `?${s}` : ''}`).then(parseJson)
}

export function getCrateDispatchLog(params) {
  const q = new URLSearchParams()
  if (params?.dispatch_date) q.set('dispatch_date', params.dispatch_date)
  if (params?.route_code) q.set('route_code', params.route_code)
  const s = q.toString()
  return fetch(`${BASE}/crates/dispatch-log${s ? `?${s}` : ''}`).then(parseJson)
}

export function patchCrateDispatch(dispatchId, body) {
  return fetch(`${BASE}/crates/dispatch/${dispatchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseJson)
}

export function getFleetKpis(params) {
  const q = new URLSearchParams()
  if (params?.year != null) q.set('year', String(params.year))
  if (params?.month != null) q.set('month', String(params.month))
  if (params?.vehicle_type) q.set('vehicle_type', params.vehicle_type)
  const s = q.toString()
  return fetch(`${BASE}/fleet/kpis${s ? `?${s}` : ''}`).then(parseJson)
}

export function getFleetAgentRanking() {
  return fetch(`${BASE}/fleet/agents/ranking`).then(parseJson)
}

export function getFleetReplay(params) {
  const q = new URLSearchParams()
  if (params?.route_code) q.set('route_code', params.route_code)
  if (params?.replay_date) q.set('replay_date', params.replay_date)
  const s = q.toString()
  return fetch(`${BASE}/fleet/replay${s ? `?${s}` : ''}`).then(parseJson)
}

export function getPauses(params) {
  const q = new URLSearchParams()
  if (params?.ref_date) q.set('ref_date', params.ref_date)
  if (params?.on_date) q.set('on_date', params.on_date)
  if (params?.search) q.set('search', params.search)
  const s = q.toString()
  return fetch(`${BASE}/exceptions/pauses${s ? `?${s}` : ''}`).then(parseJson)
}

export function getMicroOrders(params) {
  const q = new URLSearchParams()
  if (params?.fulfillment_date) q.set('fulfillment_date', params.fulfillment_date)
  if (params?.search) q.set('search', params.search)
  const s = q.toString()
  return fetch(`${BASE}/exceptions/micro-orders${s ? `?${s}` : ''}`).then(parseJson)
}
