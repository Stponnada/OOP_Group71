import {
  Users,
  Bell,
  User,
  Settings,
  ClipboardList,
  PieChart as PieChartIcon,
  Bug,
  CirclePlus,
  Inbox,
  ListFilter,
  UserCog,
  SlidersHorizontal,
  History,
  type LucideIcon,
} from 'lucide-react'
import type { AccessLevel, AccessProfile, ItsmRoles } from '@/lib/access'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  description: string
  // nav-only toggle (section or individual item) — the route itself
  // still works, it just isn't linked from the sidebar. Nothing here is
  // deleted, just not shown; flip back to unhide.
  hidden: boolean
  // Retired: superseded by another route. Never shown anywhere (cards or
  // Under Progress), regardless of `hidden`.
  retired?: boolean
  // Must be a member (any level) of this department, or a superuser.
  // Omit for universal items usable by every employee.
  department?: string
  // 'admin' with no `department` set means "admin of any department"
  // (site-administration functions like /employees). 'admin' with a
  // `department` set means admin specifically within that department.
  // 'superuser' with no `department` is company-wide; with a `department` it means a superuser
  // role in that department specifically.
  minAccess?: AccessLevel
  // Service-desk role from the ITSM service (`GET /api/v1/me`), checked instead of the HR
  // access level: being Head of IT doesn't make you a technician, a technician profile does.
  itsmRole?: keyof ItsmRoles
}

export type NavSection = {
  label: string
  hidden?: boolean
  // minAccess: sections without this field are visible to everyone.
  minAccess?: AccessLevel
  // Roadmap sections only ever appear (under "Under Progress") to
  // superusers, as a reminder of what's coming — never to anyone else.
  roadmapOnly?: boolean
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    label: 'Me',
    items: [
      { href: '/profile', label: 'Profile', icon: User, description: 'Update your personal details and preferences.', hidden: false },
      { href: '/notifications', label: 'Notifications', icon: Bell, description: 'Review alerts and updates about your incidents.', hidden: false },
    ],
  },
  {
    label: 'IT Service',
    items: [
      { href: '/incidents/new', label: 'Report an incident', icon: CirclePlus, description: 'Tell IT what is broken. It is prioritised and routed to a technician straight away.', hidden: false },
      { href: '/incidents', label: 'My incidents', icon: Inbox, description: 'Follow what you reported, answer questions and confirm fixes.', hidden: false },
    ],
  },
  {
    // Staff only. Each item is gated by the service-desk role it needs, so a technician
    // sees their queue, an admin sees the desk, and an ordinary employee sees none of it.
    label: 'Service Desk',
    items: [
      { href: '/incidents/queue', label: 'My work', icon: ClipboardList, description: 'Incidents assigned to you, and unassigned ones you can take.', hidden: false, itsmRole: 'technician' },
      { href: '/incidents/all', label: 'All incidents', icon: ListFilter, description: 'Every incident, with filters. Assign, reassign and spot duplicates.', hidden: false, itsmRole: 'serviceDeskAdmin' },
      { href: '/incidents/analytics', label: 'Analytics', icon: PieChartIcon, description: 'Volume, SLA compliance, workload and escalations.', hidden: false, itsmRole: 'serviceDeskAdmin' },
      { href: '/incidents/technicians', label: 'Technicians', icon: UserCog, description: 'Who is on the desk: skills, capacity, availability and team leads.', hidden: false, itsmRole: 'serviceDeskAdmin' },
      { href: '/incidents/settings', label: 'Service settings', icon: SlidersHorizontal, description: 'Services, categories, SLA targets and how work is assigned.', hidden: false, itsmRole: 'serviceDeskAdmin' },
      { href: '/incidents/audit', label: 'Audit log', icon: History, description: 'Every change to incidents and service-desk settings, and who made it.', hidden: false, itsmRole: 'serviceDeskAdmin' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/employees', label: 'Employees', icon: Users, description: 'Onboard and manage employees in your department.', hidden: false, minAccess: 'admin' },
      { href: '/issues', label: 'Reported Issues', icon: Bug, description: 'Bugs and problems people have reported with Spotlight.', hidden: false, department: 'Engineering', minAccess: 'superuser' },
      { href: '/settings', label: 'Company Settings', icon: Settings, description: 'Departments and roles.', hidden: false, minAccess: 'superuser' },
    ],
  },
]

// Whether `profile` can see a given item, honoring both the item's own
// `department`/`minAccess` and the section's `minAccess` as a fallback.
export function canSeeItem(profile: AccessProfile, item: NavItem, section: NavSection): boolean {
  if (item.retired) return false
  if (item.itsmRole) return profile.itsm?.[item.itsmRole] === true

  if (item.department && (item.minAccess ?? section.minAccess) === 'superuser') {
    return profile.superuserDepartments.includes(item.department)
  }

  if (item.department) {
    const membership = profile.departments.find((d) => d.name === item.department)
    if (!profile.isSuperuser && !membership) return false
  }

  const requiredLevel = item.minAccess ?? section.minAccess
  if (!requiredLevel || requiredLevel === 'standard') return true
  if (requiredLevel === 'superuser') return profile.isSuperuser
  // requiredLevel === 'admin'
  if (item.department) {
    return profile.isSuperuser || profile.departments.some((d) => d.name === item.department && d.level === 'admin')
  }
  // No department on the item — "admin of any department" (site administration).
  return profile.isSuperuser || profile.departments.some((d) => d.level === 'admin')
}

export function canSeeSection(profile: AccessProfile, section: NavSection): boolean {
  if (section.roadmapOnly) return profile.isSuperuser
  if (!section.minAccess || section.minAccess === 'standard') return true
  if (section.minAccess === 'superuser') return profile.isSuperuser
  return profile.isSuperuser || profile.departments.some((d) => d.level === 'admin')
}
