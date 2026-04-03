import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import UniversalEntryModal from './UniversalEntryModal.jsx'

const Ctx = createContext(null)

/**
 * Single UniversalEntryModal for the PF shell — opened from bottom nav (+), desktop FAB, and shortcuts.
 */
export function PfUniversalAddProvider({ children, onSessionInvalid }) {
  const [open, setOpen] = useState(false)
  const [bootToEntryId, setBootToEntryId] = useState(null)

  const openPicker = useCallback(() => {
    setBootToEntryId(null)
    setOpen(true)
  }, [])

  const openWithEntry = useCallback((entryId) => {
    setBootToEntryId(entryId ?? null)
    setOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setOpen(false)
    setBootToEntryId(null)
  }, [])

  const value = useMemo(
    () => ({
      openPicker,
      openWithEntry,
      closeModal,
      isOpen: open,
    }),
    [openPicker, openWithEntry, closeModal, open],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <UniversalEntryModal
        open={open}
        onClose={closeModal}
        onSessionInvalid={onSessionInvalid}
        bootToEntryId={bootToEntryId}
      />
    </Ctx.Provider>
  )
}

export function usePfUniversalAdd() {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePfUniversalAdd must be used within PfUniversalAddProvider')
  return c
}
