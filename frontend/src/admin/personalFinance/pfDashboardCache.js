/** Client-side SWR-style cache for dashboard bundle (2–5 min TTL). */

const TTL_MS = 3 * 60 * 1000

const memory = new Map()

export function dashboardBundleCacheKey(accountId, year, month) {
  return `${accountId ?? ''}:${year}:${month}`
}

export function readDashboardBundleCache(key) {
  const row = memory.get(key)
  if (!row) return null
  if (Date.now() - row.t > TTL_MS) {
    memory.delete(key)
    return null
  }
  return row.body
}

export function writeDashboardBundleCache(key, body) {
  memory.set(key, { t: Date.now(), body })
}

export function clearDashboardBundleCache() {
  memory.clear()
}
