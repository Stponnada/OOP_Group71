'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import { navSections } from '@/lib/nav-items'

// Nav items (including their Lucide icon component) are only safe to use
// on the client — a raw component reference can't cross the server->client
// prop boundary (Next.js can only serialize plain data across it). So the
// page only sends the serializable bits (href + count) and this client
// component resolves label/icon/description itself from the same
// statically-imported nav-items module.
const navItemByHref = new Map(navSections.flatMap((s) => s.items).map((i) => [i.href, i]))

type CardItem = { href: string; count?: number | null; countSuffix?: string }

type DashboardSection = {
  label: string
  items: CardItem[]
}

export default function DashboardTabs({
  sections,
}: {
  sections: DashboardSection[]
}) {
  const [activeTab, setActiveTab] = useState(() => sections[0]?.label ?? '')
  const activeSection = sections.find((section) => section.label === activeTab) ?? sections[0]
  const baseId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  if (!activeSection) return null

  const activeIndex = sections.indexOf(activeSection)
  const tabId = (i: number) => `${baseId}-tab-${i}`
  const panelId = `${baseId}-panel`

  // Arrow keys move between tabs (WAI-ARIA tabs pattern); only the selected tab is in the Tab order.
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (index + 1) % sections.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + sections.length) % sections.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = sections.length - 1
    if (next < 0) return
    e.preventDefault()
    setActiveTab(sections[next].label)
    tabRefs.current[next]?.focus()
  }

  return (
    <div>
      <div className="scrollbar-hide mb-6 overflow-x-auto overflow-y-hidden border-b border-line">
        <div role="tablist" aria-label="Dashboard sections" className="flex min-w-max items-center gap-1">
          {sections.map((section, i) => {
            const selected = i === activeIndex
            return (
              <button
                key={section.label}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                id={tabId(i)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(section.label)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className={`-mb-px border-b-2 px-3 py-2 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                  selected ? 'border-fg text-fg' : 'border-transparent text-fg-muted hover:text-fg'
                }`}
              >
                {section.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(activeIndex)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {activeSection.items.map((widget) => {
          const item = navItemByHref.get(widget.href)
          if (!item) return null
          const Icon = item.icon
          const showBadge = widget.count != null && widget.count > 0

          return (
            <Link
              key={widget.href}
              href={widget.href}
              className="group flex flex-col gap-3 rounded-md border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sunken text-fg-muted transition-colors group-hover:bg-surface">
                  <Icon className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                </div>
                {showBadge && (
                  <Badge tone="neutral">
                    {widget.countSuffix ? `${widget.count}${widget.countSuffix}` : widget.count}
                  </Badge>
                )}
              </div>
              <div className="flex-1">
                <h2 className="mb-0.5 text-body font-normal text-fg">{item.label}</h2>
                <p className="text-label text-fg-muted">{item.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
