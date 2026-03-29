const STORAGE_KEY = 'pf_sidebar_collapsed'

export function readSidebarCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSidebarCollapsed(collapsed) {
  try {
    if (collapsed) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
