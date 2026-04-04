const STORAGE_KEY = 'pf-notif-state-v1'
const EVT = 'pf-notif-state-updated'

/** @returns {{ read: string[], dismissed: string[], done: string[], snoozeUntil: Record<string, number> }} */
export function getPfNotifState() {
  if (typeof window === 'undefined') {
    return { read: [], dismissed: [], done: [], snoozeUntil: {} }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { read: [], dismissed: [], done: [], snoozeUntil: {} }
    const j = JSON.parse(raw)
    return {
      read: Array.isArray(j.read) ? j.read : [],
      dismissed: Array.isArray(j.dismissed) ? j.dismissed : [],
      done: Array.isArray(j.done) ? j.done : [],
      snoozeUntil: j.snoozeUntil && typeof j.snoozeUntil === 'object' ? j.snoozeUntil : {},
    }
  } catch {
    return { read: [], dismissed: [], done: [], snoozeUntil: {} }
  }
}

function persist(state) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent(EVT))
}

/** @param {(s: ReturnType<typeof getPfNotifState>) => ReturnType<typeof getPfNotifState>} fn */
export function patchPfNotifState(fn) {
  const prev = getPfNotifState()
  const next = fn(prev)
  persist(next)
}

export function markPfNotifRead(id) {
  patchPfNotifState((s) => {
    if (s.read.includes(id)) return s
    return { ...s, read: [...s.read, id] }
  })
}

export function markPfNotifUnread(id) {
  patchPfNotifState((s) => ({ ...s, read: s.read.filter((x) => x !== id) }))
}

export function dismissPfNotif(id) {
  patchPfNotifState((s) => ({
    ...s,
    dismissed: s.dismissed.includes(id) ? s.dismissed : [...s.dismissed, id],
    done: s.done.filter((x) => x !== id),
  }))
}

export function markPfNotifDone(id) {
  patchPfNotifState((s) => ({
    ...s,
    done: s.done.includes(id) ? s.done : [...s.done, id],
    read: s.read.includes(id) ? s.read : [...s.read, id],
  }))
}

/** @param {number} [hours] */
export function snoozePfNotif(id, hours = 24) {
  const until = Date.now() + hours * 3600000
  patchPfNotifState((s) => ({
    ...s,
    snoozeUntil: { ...s.snoozeUntil, [id]: until },
  }))
}

export function clearPfNotifSnooze(id) {
  patchPfNotifState((s) => {
    const snoozeUntil = { ...s.snoozeUntil }
    delete snoozeUntil[id]
    return { ...s, snoozeUntil }
  })
}

export function subscribePfNotifState(cb) {
  if (typeof window === 'undefined') return () => {}
  const h = () => cb()
  window.addEventListener(EVT, h)
  return () => window.removeEventListener(EVT, h)
}
