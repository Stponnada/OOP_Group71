'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'spotlight.mariner.dock'

type DockState = {
  /** The chat docked beside the page, or null when Mariner isn't docked. */
  chatId: string | null
  dock: (chatId: string) => void
  undock: () => void
}

const DockContext = createContext<DockState | null>(null)

/**
 * Following a link from a chat opens the page and docks that same conversation beside it, so the
 * user can keep talking to Mariner while they look. Lives in the dashboard shell, which stays
 * mounted across navigation; remembered for the browser tab so a reload keeps it docked.
 */
export function MarinerDockProvider({ children }: { children: ReactNode }) {
  const [chatId, setChatId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) setChatId(saved) // eslint-disable-line react-hooks/set-state-in-effect
    } catch {}
  }, [])

  const dock = useCallback((id: string) => {
    setChatId(id)
    try {
      sessionStorage.setItem(STORAGE_KEY, id)
    } catch {}
  }, [])

  const undock = useCallback(() => {
    setChatId(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [])

  return <DockContext.Provider value={{ chatId, dock, undock }}>{children}</DockContext.Provider>
}

export function useMarinerDock() {
  const value = useContext(DockContext)
  if (!value) throw new Error('useMarinerDock must be used inside MarinerDockProvider')
  return value
}
