import { Headset, LifeBuoy, User, type LucideIcon } from 'lucide-react'
import type { AccessProfile } from '@/lib/access'
import { navSections, canSeeSection, canSeeItem, type NavItem } from '@/lib/nav-items'

type CategoryId = 'me' | 'it-service' | 'service-desk'

export type NavCategory = {
  id: CategoryId
  href: string
  label: string
  description: string
  icon: LucideIcon
  items: NavItem[]
}

const categories: Omit<NavCategory, 'items'>[] = [
  { id: 'me', href: '/dashboard/me', label: 'Me', description: 'Your profile, notifications, and administration tools.', icon: User },
  { id: 'it-service', href: '/dashboard/it-service', label: 'IT Service', description: 'Report IT incidents and track them through to resolution.', icon: Headset },
  { id: 'service-desk', href: '/dashboard/service-desk', label: 'Service Desk', description: 'Work incidents, run the desk and tune how it behaves.', icon: LifeBuoy },
]

function categoryForItem(sectionLabel: string): CategoryId | undefined {
  switch (sectionLabel) {
    case 'Me':
    case 'Administration':
      return 'me'
    case 'IT Service':
      return 'it-service'
    case 'Service Desk':
      return 'service-desk'
  }
}

// Apply the declared section AND item permissions before regrouping. Moving an
// item into a category must never relax its department or access requirements.
export function getVisibleNavCategories(profile: AccessProfile): NavCategory[] {
  const visible = categories.map((category) => ({ ...category, items: [] as NavItem[] }))

  for (const section of navSections) {
    if (section.hidden || section.roadmapOnly || !canSeeSection(profile, section)) continue

    for (const item of section.items) {
      if (item.hidden || !canSeeItem(profile, item, section)) continue
      const categoryId = categoryForItem(section.label)
      visible.find((category) => category.id === categoryId)?.items.push(item)
    }
  }

  return visible.filter((category) => category.items.length > 0)
}

const actionTypes: Record<string, string> = {
  '/profile': 'Account',
  '/notifications': 'Account',
  '/employees': 'Administration',
  '/settings': 'Administration',
  '/issues': 'Administration',
  '/incidents/new': 'Incidents',
  '/incidents': 'Incidents',
  '/incidents/queue': 'Work',
  '/incidents/all': 'Work',
  '/incidents/analytics': 'Insight',
  '/incidents/audit': 'Insight',
  '/incidents/technicians': 'Configuration',
  '/incidents/settings': 'Configuration',
}

// Group only already-authorized items. Single-card groups retain their heading;
// groups with no visible cards are never created.
export function getNavActionGroups(category: NavCategory): { label: string; items: NavItem[] }[] {
  const groups = new Map<string, NavItem[]>()
  for (const item of category.items) {
    const label = actionTypes[item.href] ?? item.label
    const items = groups.get(label) ?? []
    items.push(item)
    groups.set(label, items)
  }
  return Array.from(groups, ([label, items]) => ({ label, items }))
}

// Match the most specific destination first.
export function getActiveNavHref(pathname: string, visible: NavCategory[]): string | undefined {
  if (pathname === '/dashboard') return '/dashboard'

  const matches = visible.flatMap((category) =>
    [category.href, ...category.items.map((item) => item.href)]
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .map((href) => ({ href, categoryHref: category.href }))
  )
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.categoryHref
}
