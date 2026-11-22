'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { savePreferences } from '@/app/(dashboard)/preferences/actions'

type Preferences = {
  /** Hide the turtle that sits on Mariner's message box. */
  hideMascot: boolean
  /** `save: false` when it's already saved (e.g. Mariner changed it on the server). */
  setHideMascot: (hide: boolean, options?: { save?: boolean }) => void
}

const PreferencesContext = createContext<Preferences>({ hideMascot: false, setHideMascot: () => {} })

/**
 * Personal preferences saved on the person's account (auth metadata), so they follow them to every
 * device. Changes apply at once here and are saved in the background.
 */
export function PreferencesProvider({ initial, children }: { initial: { hideMascot: boolean }; children: ReactNode }) {
  const [hideMascot, setHide] = useState(initial.hideMascot)
  const setHideMascot = useCallback((hide: boolean, options?: { save?: boolean }) => {
    setHide(hide)
    if (options?.save !== false) void savePreferences({ hideMascot: hide })
  }, [])
  return <PreferencesContext.Provider value={{ hideMascot, setHideMascot }}>{children}</PreferencesContext.Provider>
}

export const usePreferences = () => useContext(PreferencesContext)
