import { BellIcon } from '@heroicons/react/24/solid'
import { AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { loadPfNotificationFeed } from './pfNotificationFeed.js'
import PfNotificationPanel from './PfNotificationPanel.jsx'

export default function PfNotificationBell({ onSessionInvalid }) {
  const { tick } = usePfRefresh()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [highCount, setHighCount] = useState(0)
  const [mediumCount, setMediumCount] = useState(0)

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06]"
        aria-label={`Notifications${highCount > 0 ? `, ${highCount} urgent` : mediumCount > 0 ? ', items need attention' : ''}`}
      >
        <BellIcon className="h-[22px] w-[22px]" />
        {highCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
            {highCount > 9 ? '9+' : highCount}
          </span>
        ) : mediumCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 shadow-sm ring-2 ring-[var(--pf-header)]" />
        ) : null}
      </button>

      <AnimatePresence mode="sync">
        {open ? (
          <PfNotificationPanel key="pf-notification-panel" onClose={() => setOpen(false)} items={items} loading={loading} />
        ) : null}
      </AnimatePresence>
    </>
  )
}
