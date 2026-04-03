import { PlusIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect } from 'react'
import { usePfUniversalAdd } from './PfUniversalAddContext.jsx'

function isTextInputTarget(el) {
  if (!el || !(el instanceof Element)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return Boolean(el.closest('[contenteditable="true"]'))
}

/**
 * Floating global add control + universal entry modal. Mount inside Personal Finance shell (logged-in only).
 */
export default function PfGlobalAdd() {
  const { openPicker, isOpen } = usePfUniversalAdd()

  const openModal = useCallback(() => openPicker(), [openPicker])

  useEffect(() => {
    const onKey = (e) => {
      if (isOpen) return
      if (e.defaultPrevented) return
      const t = e.target
      if (isTextInputTarget(t)) return
      const metaK = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)
      if (metaK) {
        e.preventDefault()
        openModal()
        return
      }
      if (e.key === 'a' || e.key === 'A') {
        if (e.altKey || e.ctrlKey || e.metaKey) return
        e.preventDefault()
        openModal()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isOpen, openModal])

  return (
    <button
      type="button"
      onClick={openModal}
      title="Add new entry — shortcut A or Ctrl+K"
      aria-label="Add new entry"
      className="pf-global-add-fab fixed z-[55] hidden items-center gap-2 rounded-full border border-[var(--pf-border)] bg-[var(--pf-primary)] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[var(--pf-primary-hover)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--pf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pf-bg)] active:scale-[0.98] md:bottom-8 md:right-8 md:flex"
    >
      <PlusIcon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Add</span>
    </button>
  )
}
