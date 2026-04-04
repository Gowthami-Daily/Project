const STORAGE_KEY = 'pf_login_confetti_day'

/**
 * Marks “first successful login today” for this browser and returns whether
 * confetti should run (false on second+ login the same local calendar day).
 * Call only after a successful Personal Finance login.
 */
export function consumeFirstLoginConfettiForToday() {
  try {
    if (typeof localStorage === 'undefined') return false
    const today = new Date().toDateString()
    const last = localStorage.getItem(STORAGE_KEY)
    if (last === today) return false
    localStorage.setItem(STORAGE_KEY, today)
    return true
  } catch {
    return false
  }
}
