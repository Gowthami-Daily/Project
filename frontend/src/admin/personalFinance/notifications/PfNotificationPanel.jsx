import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePfUniversalAdd } from '../globalAdd/PfUniversalAddContext.jsx'
import { formatInr } from '../pfFormat.js'
import {
  dismissPfNotif,
  getPfNotifState,
  markPfNotifDone,
  markPfNotifRead,
  snoozePfNotif,
  subscribePfNotifState,
} from './pfNotificationUiState.js'
import './pfNotifications.css'

/** @typedef {'all' | 'due' | 'alerts' | 'payments' | 'system'} NotifTab */

const TABS = [
  { id: /** @type {const} */ ('all'), label: 'All' },
  { id: /** @type {const} */ ('due'), label: 'Due' },
  { id: /** @type {const} */ ('alerts'), label: 'Alerts' },
  { id: /** @type {const} */ ('payments'), label: 'Payments' },
  { id: /** @type {const} */ ('system'), label: 'System' },
]

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {import('./pfNotificationFeed.js').PfNotifItem[]} props.items
 * @param {boolean} props.loading
 */
export default function PfNotificationPanel({ onClose, items, loading }) {
  const navigate = useNavigate()
  const { openWithEntry } = usePfUniversalAdd()
  const [tab, setTab] = useState(/** @type {NotifTab} */ ('all'))
  const [tick, setTick] = useState(0)
  const [ui, setUi] = useState(() => getPfNotifState())

  useEffect(() => subscribePfNotifState(() => setTick((n) => n + 1)), [])

  useEffect(() => {
    setUi(getPfNotifState())
  }, [tick, items])

  const inferFilterTabs = useCallback((it) => {
    const k = it.kind
    /** @type {('due' | 'alerts' | 'payments' | 'system')[]} */
    const tabs = []
    if (k === 'liability_emi' || k === 'loan_emi' || k === 'cc_bill') tabs.push('due')
    if (k === 'liability_emi' || k === 'cc_bill') tabs.push('payments')
    if (k === 'low_balance' || k === 'net_worth' || k === 'large_expense') tabs.push('alerts')
    if (k === 'sip' || k === 'monthly_report') tabs.push('system')
    return tabs.length ? tabs : ['due']
  }, [])

  const normalize = useCallback(
    (it) => {
      const variant =
        it.variant ||
        (it.priority === 'high' ? 'danger' : it.priority === 'medium' ? 'warning' : 'info')
      const filterTabs =
        it.filterTabs && it.filterTabs.length ? it.filterTabs : inferFilterTabs(it)
      const actions =
        it.actions && it.actions.length
          ? it.actions
          : [{ id: 'view', label: 'View', navigate: it.link }]
      return { ...it, variant, filterTabs, actions, daysUntilDue: it.daysUntilDue ?? null }
    },
    [inferFilterTabs],
  )

  const matchesTab = useCallback(
    (it, t) => {
      if (t === 'all') return true
      return it.filterTabs.includes(t)
    },
    [],
  )

  const timeBucket = useCallback((it) => {
    const d = it.daysUntilDue
    if (d != null && d <= 0) return 'today'
    if (it.kind === 'low_balance' || it.kind === 'net_worth' || it.kind === 'large_expense') {
      return 'today'
    }
    if (d != null && d >= 1 && d <= 14) return 'upcoming'
    return 'earlier'
  }, [])

  const { activeItems, completedItems, filteredEmpty, visibleCount } = useMemo(() => {
    const now = Date.now()
    const norm = items.map(normalize)
    const dismissed = new Set(ui.dismissed)
    const done = new Set(ui.done)
    const snoozeUntil = ui.snoozeUntil || {}

    const visible = norm.filter((it) => {
      if (dismissed.has(it.id)) return false
      const until = snoozeUntil[it.id]
      if (until && until > now) return false
      if (done.has(it.id)) return false
      return true
    })

    const completed = norm.filter((it) => done.has(it.id) && !dismissed.has(it.id))

    const filtered = visible.filter((it) => matchesTab(it, tab))
    const completedFiltered = completed.filter((it) => matchesTab(it, tab))
    const filteredEmpty =
      visible.length > 0 && filtered.length === 0 && completedFiltered.length === 0

    return {
      activeItems: filtered,
      completedItems: completedFiltered,
      filteredEmpty,
      visibleCount: visible.length,
    }
  }, [items, normalize, ui.dismissed, ui.done, ui.snoozeUntil, tab, matchesTab])

  const grouped = useMemo(() => {
    /** @type {Record<string, typeof activeItems>} */
    const g = { today: [], upcoming: [], earlier: [] }
    for (const it of activeItems) {
      const b = timeBucket(it)
      g[b].push(it)
    }
    return g
  }, [activeItems, timeBucket])

  function go(href) {
    onClose()
    navigate(href)
  }

  function onCardActivate(it) {
    markPfNotifRead(it.id)
    setTick((n) => n + 1)
  }

  const sectionVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.035, delayChildren: 0.02 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, x: 14 },
    show: { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
  }

  return (
    <motion.div
      key="pf-notif-layer"
      className="fixed inset-0 z-[200] flex justify-end"
      style={{ pointerEvents: 'auto' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <button
        type="button"
        aria-label="Close notifications"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] md:bg-black/30"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '104%' }}
        animate={{ x: 0 }}
        exit={{ x: '104%' }}
        transition={{ type: 'tween', duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
        className="pf-notif-panel relative z-[1] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col border-l border-[var(--pf-border)] bg-[var(--pf-bg)] text-[var(--pf-text)] shadow-[-12px_0_40px_rgba(0,0,0,0.12)] dark:shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
      >
        <header className="sticky top-0 z-10 shrink-0 border-b border-[var(--pf-border)] bg-[var(--pf-bg)]/95 px-4 py-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--pf-text)]">Notifications</h2>
              <p className="text-xs text-[var(--pf-text-muted)]">Dues, alerts, and quick actions</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--pf-text-muted)] transition hover:bg-[var(--pf-card-hover)]"
              aria-label="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`pf-notif-tab shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  tab === t.id
                    ? 'bg-[var(--pf-primary)] text-white shadow-sm'
                    : 'bg-[var(--pf-card)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--pf-border)] border-t-[var(--pf-primary)]"
                aria-hidden
              />
              <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
            </div>
          ) : items.length === 0 ? (
            <EmptyCaughtUp />
          ) : visibleCount === 0 ? (
            <p className="flex flex-1 items-center px-2 py-12 text-center text-sm text-[var(--pf-text-muted)]">
              No active notifications. Items may be dismissed, snoozed, or marked done — check the
              Completed section after you mark items, or refresh from the bell.
            </p>
          ) : filteredEmpty ? (
            <p className="flex flex-1 items-center px-2 py-12 text-center text-sm text-[var(--pf-text-muted)]">
              Nothing in this filter. Try another tab or clear completed items.
            </p>
          ) : (
            <>
              <NotifSection
                title="Today"
                items={grouped.today}
                sectionVariants={sectionVariants}
                itemVariants={itemVariants}
                ui={ui}
                onClose={onClose}
                go={go}
                openWithEntry={openWithEntry}
                onCardActivate={onCardActivate}
                setTick={setTick}
              />
              <NotifSection
                title="Upcoming"
                items={grouped.upcoming}
                sectionVariants={sectionVariants}
                itemVariants={itemVariants}
                ui={ui}
                onClose={onClose}
                go={go}
                openWithEntry={openWithEntry}
                onCardActivate={onCardActivate}
                setTick={setTick}
              />
              <NotifSection
                title="Earlier"
                items={grouped.earlier}
                sectionVariants={sectionVariants}
                itemVariants={itemVariants}
                ui={ui}
                onClose={onClose}
                go={go}
                openWithEntry={openWithEntry}
                onCardActivate={onCardActivate}
                setTick={setTick}
              />
              <NotifSection
                title="Completed"
                items={completedItems}
                sectionVariants={sectionVariants}
                itemVariants={itemVariants}
                ui={ui}
                onClose={onClose}
                go={go}
                openWithEntry={openWithEntry}
                onCardActivate={onCardActivate}
                setTick={setTick}
                completed
              />
            </>
          )}
        </div>
      </motion.aside>
    </motion.div>
  )
}

function EmptyCaughtUp() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--pf-card)] text-[var(--pf-primary)] ring-1 ring-[var(--pf-border)]"
        aria-hidden
      >
        <CheckCircleIcon className="h-10 w-10 opacity-90" />
      </div>
      <div>
        <p className="text-base font-semibold text-[var(--pf-text)]">You&apos;re all caught up</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--pf-text-muted)]">
          EMI due dates, card bills, and balance alerts will show up here when there&apos;s something
          to act on.
        </p>
      </div>
    </div>
  )
}

/**
 * @param {object} p
 * @param {string} p.title
 * @param {import('./pfNotificationFeed.js').PfNotifItem[]} p.items
 * @param {object} p.sectionVariants
 * @param {object} p.itemVariants
 * @param {ReturnType<typeof getPfNotifState>} p.ui
 * @param {() => void} p.onClose
 * @param {(href: string) => void} p.go
 * @param {(id: string) => void} p.openWithEntry
 * @param {(it: import('./pfNotificationFeed.js').PfNotifItem) => void} p.onCardActivate
 * @param {React.Dispatch<React.SetStateAction<number>>} p.setTick
 * @param {boolean} [p.completed]
 */
function NotifSection({
  title,
  items,
  sectionVariants,
  itemVariants,
  ui,
  onClose,
  go,
  openWithEntry,
  onCardActivate,
  setTick,
  completed = false,
}) {
  if (!items.length) return null
  const readSet = new Set(ui.read)

  return (
    <div className="mb-5">
      <h3 className="pf-notif-section-title mb-2 px-1 text-[11px] font-bold uppercase text-[var(--pf-text-muted)]">
        {title}
      </h3>
      <motion.ul
        className="space-y-2"
        variants={sectionVariants}
        initial="hidden"
        animate="show"
      >
        {items.map((it) => (
          <motion.li key={it.id} variants={itemVariants} layout>
            <NotifCard
              it={it}
              isRead={readSet.has(it.id)}
              completed={completed}
              onClose={onClose}
              go={go}
              openWithEntry={openWithEntry}
              onCardActivate={onCardActivate}
              setTick={setTick}
            />
          </motion.li>
        ))}
      </motion.ul>
    </div>
  )
}

/**
 * @param {object} p
 * @param {import('./pfNotificationFeed.js').PfNotifItem} p.it
 * @param {boolean} p.isRead
 * @param {boolean} p.completed
 */
function NotifCard({ it, isRead, completed, onClose, go, openWithEntry, onCardActivate, setTick }) {
  const variant = completed ? 'success' : it.variant || 'info'
  const strip =
    variant === 'danger'
      ? 'pf-notif-danger'
      : variant === 'warning'
        ? 'pf-notif-warning'
        : variant === 'success'
          ? 'pf-notif-success'
          : 'pf-notif-info'

  const Icon =
    variant === 'danger'
      ? ExclamationCircleIcon
      : variant === 'warning'
        ? ExclamationTriangleIcon
        : variant === 'success'
          ? CheckCircleIcon
          : InformationCircleIcon

  const iconColor =
    variant === 'danger'
      ? 'text-red-500'
      : variant === 'warning'
        ? 'text-amber-500'
        : variant === 'success'
          ? 'text-emerald-500'
          : 'text-sky-500'

  function runAction(act) {
    onCardActivate(it)
    if (act.openEntry) {
      onClose()
      openWithEntry(act.openEntry)
      return
    }
    if (act.navigate) go(act.navigate)
  }

  return (
    <article
      className={`pf-notif-item group relative flex w-full flex-col overflow-hidden rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card)] text-left shadow-sm sm:flex-row ${strip} ${
        !isRead && !completed ? 'pf-notif-item--unread' : ''
      } ${isRead && !completed ? 'pf-notif-item--read' : ''} `}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 gap-3 px-3 py-3 text-left"
        onClick={() => {
          onCardActivate(it)
          go(it.link)
        }}
      >
        <div className="relative shrink-0 pt-0.5">
          <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
          {!isRead && !completed ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--pf-primary)] ring-2 ring-[var(--pf-card)]"
              aria-label="Unread"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold leading-snug text-[var(--pf-text)]">{it.title}</span>
            {it.amount != null && Number.isFinite(it.amount) ? (
              <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--pf-text)]">
                {formatInr(it.amount)}
              </span>
            ) : null}
          </div>
          {it.subtitle ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--pf-text-muted)]">{it.subtitle}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {it.statusBadge ? (
              <span className="rounded-md bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)] dark:bg-white/[0.06]">
                {it.statusBadge}
              </span>
            ) : null}
            {completed ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden />
                Done
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {!completed ? (
        <div
          className="flex flex-col justify-center gap-1 border-t border-[var(--pf-border)] bg-[var(--pf-bg)]/40 px-2 py-2 sm:border-l sm:border-t-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            {(it.actions || []).map((act) => (
              <button
                key={act.id}
                type="button"
                className="whitespace-nowrap rounded-lg bg-[var(--pf-card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--pf-text)] ring-1 ring-[var(--pf-border)] transition hover:bg-[var(--pf-card-hover)]"
                onClick={() => runAction(act)}
              >
                {act.label}
              </button>
            ))}
          </div>
          <div className="mt-1 flex flex-col gap-1 border-t border-[var(--pf-border)] pt-1">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]"
              onClick={() => {
                markPfNotifDone(it.id)
                setTick((n) => n + 1)
              }}
            >
              Mark done
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]"
              onClick={() => {
                snoozePfNotif(it.id, 24)
                setTick((n) => n + 1)
              }}
            >
              Snooze 24h
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[10px] font-medium text-red-600/90 hover:bg-red-500/10 dark:text-red-400"
              onClick={() => {
                dismissPfNotif(it.id)
                setTick((n) => n + 1)
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end border-t border-[var(--pf-border)] px-2 py-1 sm:border-l sm:border-t-0">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)]"
            aria-label="Remove from completed"
            onClick={() => {
              dismissPfNotif(it.id)
              setTick((n) => n + 1)
            }}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </article>
  )
}
