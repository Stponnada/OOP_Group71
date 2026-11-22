import { navSections } from '@/lib/nav-items'

// Mariner only offers tools for pages that are live in the menu (lib/nav-items.ts). Unhiding a
// page there switches its tools on.

/** Whether the page at `href` is live in the menu (not roadmap-only, hidden or retired). */
export function moduleLive(href: string): boolean {
  const section = navSections.find((s) => s.items.some((i) => i.href === href))
  if (!section) return false
  const item = section.items.find((i) => i.href === href)!
  return !section.roadmapOnly && !section.hidden && !item.hidden && !item.retired
}

/** `allowed` for a capability on a page: only while that page is live, and `extra` holds. */
export const whenLive =
  <C,>(href: string, extra: (ctx: C) => boolean = () => true) =>
  (ctx: C) =>
    moduleLive(href) && extra(ctx)
