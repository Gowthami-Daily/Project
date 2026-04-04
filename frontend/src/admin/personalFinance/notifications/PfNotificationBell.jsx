import { BellIcon } from '@heroicons/react/24/solid'
import { AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { loadPfNotificationFeed } from './pfNotificationFeed.js'
import PfNotificationPanel from './PfNotificationPanel.jsx'
import { getPfNotifState, subscribePfNotifState } from './pfNotificationUiState.js'

function pfNotificationPortalTarget() {
  if (typeof document === 'undefined') return null
  return document.querySelector('.pf-app') || document.body
}

export default function PfNotificationBell({ onSessionInvalid }) {
  const { tick } = usePfRefresh()
  const [portalEl, setPortalEl] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [highCount, setHighCount] = useState(0)
  const [mediumCount, setMediumCount] = useState(0)
  const [uiTick, setUiTick] = useState(0)
  const [badge, setBadge] = useState({ unreadCount: 0, urgentUnread: false })

  useLayoutEffect(() => {
    setPortalEl(pfNotificationPortalTarget())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadPfNotificationFeed({ onSessionInvalid })
      setItems(data.items)
      setHighCount(data.highCount)
      setMediumCount(data.mediumCount)
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    if (!open) return
    load()
  }, [open, load])

  useEffect(() => subscribePfNotifState(() => setUiTick((n) => n + 1)), [])

  useEffect(() => {
    const ui = getPfNotifState()
    const now = Date.now()
    const dismissed = new Set(ui.dismissed)
    const done = new Set(ui.done)
    const read = new Set(ui.read)
    const snoozeUntil = ui.snoozeUntil || {}
    const active = items.filter((it) => {
      if (dismissed.has(it.id)) return false
      const u = snoozeUntil[it.id]
      if (u && u > now) return false
      if (done.has(it.id)) return false
      return true
    })
    const unread = active.filter((it) => !read.has(it.id))
    const unreadCount = unread.length
    const variantOf = (it) =>
      it.variant ||
      (it.priority === 'high' ? 'danger' : it.priority === 'medium' ? 'warning' : 'info')
    const urgentUnread = unread.some((it) => variantOf(it) === 'danger')
    setBadge({ unreadCount, urgentUnread })
  }, [items, uiTick])

  const label =
    badge.unreadCount > 0
      ? `Notifications, ${badge.unreadCount} unread`
      : highCount > 0
        ? `Notifications, ${highCount} urgent`
        : mediumCount > 0
          ? 'Notifications, items need attention'
          : 'Notifications'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06]"
        aria-label={label}
      >
        <BellIcon className="h-[22px] w-[22px]" />
        {badge.unreadCount > 0 ? (
          <span
            className={`absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm ${
              badge.urgentUnread ? 'bg-red-600' : 'bg-amber-500'
            }`}
          >
            {badge.unreadCount > 9 ? '9+' : badge.unreadCount}
          </span>
        ) : highCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
            {highCount > 9 ? '9+' : highCount}
          </span>
        ) : mediumCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 shadow-sm ring-2 ring-[var(--pf-header)]" />
        ) : null}
      </button>

      {portalEl
        ? createPortal(
            <AnimatePresence mode="sync">
              {open ? (
                <PfNotificationPanel
                  key="pf-notification-panel"
                  onClose={() => setOpen(false)}
                  items={items}
                  loading={loading}
                />
              ) : null}
            </AnimatePresence>,
            portalEl,
          )
        : null}
    </>
  )
}
