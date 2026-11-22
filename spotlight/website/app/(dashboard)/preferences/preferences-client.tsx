'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { Panel } from '@/components/ui'
import { usePreferences } from '@/components/preferences-context'
import { THEME_EVENT, applyTheme, readTheme, type ThemeChoice } from '@/lib/theme'

const THEMES: { id: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'Match system', icon: Monitor },
]

export default function PreferencesClient() {
  const { hideMascot, setHideMascot } = usePreferences()
  const [theme, setTheme] = useState<ThemeChoice | null>(null)

  // The theme lives in this browser; read it after hydration and follow the sidebar toggle.
  useEffect(() => {
    const sync = () => setTheme(readTheme())
    sync()
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  return (
    <div className="max-w-2xl space-y-6">
      <Panel title="Appearance" description="Saved in this browser.">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {THEMES.map(({ id, label, icon: Icon }) => {
            const selected = theme === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => applyTheme(id)}
                className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  selected ? 'border-fg bg-sunken text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel title="Mariner" description="Saved on your account, on every device.">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p id="hide-mascot-label" className="text-body text-fg">
              Hide Mariner mascot
            </p>
            <p className="mt-0.5 text-body text-fg-muted">Takes the turtle off the message box. Mariner still answers as usual.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hideMascot}
            aria-labelledby="hide-mascot-label"
            onClick={() => setHideMascot(!hideMascot)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              hideMascot ? 'bg-action' : 'bg-line-strong'
            }`}
          >
            <span
              className={`absolute left-0 top-0.5 size-5 rounded-full shadow transition-transform ${
                hideMascot ? 'translate-x-[1.375rem] bg-action-fg' : 'translate-x-0.5 bg-white'
              }`}
            />
          </button>
        </div>
      </Panel>
    </div>
  )
}
