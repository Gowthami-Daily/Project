/** Build query string for income/expense Excel export from the same filter presets as list pages. */
export function buildIncomeExpenseExportQuery(dateFilter, customStart, customEnd) {
  const t = new Date().toISOString().slice(0, 10)
  const params = new URLSearchParams()
  if (dateFilter === 'all') return ''
  if (dateFilter === 'today') {
    params.set('start_date', t)
    params.set('end_date', t)
  } else if (dateFilter === 'month') {
    const y = t.slice(0, 4)
    const m = t.slice(5, 7)
    const last = new Date(Number(y), Number(m), 0).getDate()
    params.set('start_date', `${y}-${m}-01`)
    params.set('end_date', `${y}-${m}-${String(last).padStart(2, '0')}`)
  } else if (dateFilter === 'week') {
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - 6)
    params.set('start_date', start.toISOString().slice(0, 10))
    params.set('end_date', t)
  } else if (dateFilter === 'custom' && customStart && customEnd) {
    params.set('start_date', customStart)
    params.set('end_date', customEnd)
  } else {
    return ''
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}
