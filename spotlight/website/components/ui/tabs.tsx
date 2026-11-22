'use client'

import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

type Tab = {
  id: string
  label: ReactNode
  /** Optional count shown after the label, e.g. "My requests (3)". */
  count?: number
  content: ReactNode
}

const TabsContext = createContext<{ select: (id: string) => void } | null>(null)

/** Lets content inside a tab switch tabs, e.g. a form showing the list after it submits. */
export function useTabs() {
  return useContext(TabsContext)
}

/**
 * Accessible tabs (WAI-ARIA tabs pattern): arrow keys, Home and End move between tabs, only the
 * selected tab is in the Tab order. Inactive panels are hidden, not unmounted, so a half-filled
 * form keeps its values when you switch away and back. The selected tab is mirrored in the URL
 * (`?tab=<id>`) without a server round trip, so a reload or a shared link opens the same tab.
 */
export function Tabs({ tabs, defaultId, label, syncUrl = true }: { tabs: Tab[]; defaultId?: string; label: string; syncUrl?: boolean }) {
  const baseId = useId()
  const [selected, setSelected] = useState(defaultId ?? tabs[0]?.id)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Read ?tab= once on mount (the server render uses the default). Only once: a data refresh
  // passes new `tabs`, and re-reading then could undo a switch made since (e.g. after submitting).
  const tabIds = useRef(tabs.map((t) => t.id))
  useEffect(() => {
    if (!syncUrl) return
    const fromUrl = new URLSearchParams(window.location.search).get('tab')
    if (fromUrl && tabIds.current.includes(fromUrl)) setSelected(fromUrl)
  }, [syncUrl])

  function select(id: string, focus = false) {
    setSelected(id)
    if (syncUrl) {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', id)
      window.history.replaceState(window.history.state, '', url)
    }
    if (focus) refs.current[id]?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next === null) return
    e.preventDefault()
    select(tabs[next].id, true)
  }

  return (
    <TabsContext.Provider value={{ select: (id) => select(id) }}>
      <div>
        <div role="tablist" aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((tab, i) => {
            const isSelected = tab.id === selected
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  refs.current[tab.id] = el
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => select(tab.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  isSelected ? 'border-fg text-fg' : 'border-transparent text-fg-muted hover:text-fg'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && <span className="ml-1.5 font-normal text-fg-subtle">{tab.count}</span>}
              </button>
            )
          })}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            hidden={tab.id !== selected}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </TabsContext.Provider>
  )
}
