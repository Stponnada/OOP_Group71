'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronRight, Home, LogOut, Settings, X } from 'lucide-react'
import type { AccessProfile } from '@/lib/access'
import { getVisibleNavCategories, getActiveNavHref } from '@/lib/nav-categories'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/theme-toggle'
import ReportIssueButton from '@/components/report-issue-button'
import SpotlightLogo from '@/components/spotlight-logo'
import { APP_VERSION, DISPLAY_VERSION } from '@/lib/version'

type SidebarProps = {
  mobileMenuOpen?: boolean
  onClose?: () => void
  accessProfile?: AccessProfile
  employeeName: string
  employeeCode: string
  designation: string | null
  unreadCount?: number
}

const EMPTY_PROFILE: AccessProfile = { isSuperuser: false, departments: [], superuserDepartments: [] }

export default function Sidebar({
  mobileMenuOpen = false,
  onClose = () => {},
  accessProfile = EMPTY_PROFILE,
  employeeName,
  employeeCode,
  designation,
  unreadCount = 0,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const visibleCategories = getVisibleNavCategories(accessProfile)
  const activeHref = getActiveNavHref(pathname, visibleCategories)
  const navigation = [
    { href: '/dashboard', label: 'Home', icon: Home },
    ...visibleCategories,
  ]

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-screen max-w-none shrink-0 flex-col border-r border-gray-100 bg-white shadow-xl transition-transform duration-200 sm:w-[88vw] sm:max-w-sm lg:static lg:z-0 lg:w-72 lg:max-w-none lg:shadow-none ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="flex h-20 items-center px-5">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 rounded-md font-wordmark text-xl font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          aria-label="Spotlight home"
        >
          <SpotlightLogo className="h-8 w-8 shrink-0" />
          Spotlight
          <span
            className="self-end pb-0.5 font-sans text-label font-normal normal-case tracking-normal text-fg-subtle"
            title={`Spotlight ${APP_VERSION}`}
          >
            v{DISPLAY_VERSION}
          </span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 lg:hidden"
          aria-label="Close navigation menu"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <nav aria-label="Main navigation" className="scrollbar-hide flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {navigation.map((item) => {
          const Icon = item.icon
          const active = item.href === activeHref
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                active
                  ? 'bg-sunken font-medium text-fg'
                  : 'text-fg-muted hover:bg-sunken hover:text-fg'
              }`}
            >
              <Icon size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
              {active && <ChevronRight size={16} className="ml-auto shrink-0 text-fg-subtle" aria-hidden="true" />}
            </Link>
          )
        })}
      </nav>

      <div data-mariner-ledge className="m-3 border-t border-gray-100 pt-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <Link
            href="/notifications"
            onClick={onClose}
            className="relative rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
            aria-label="Notifications"
          >
            <Bell size={19} strokeWidth={1.75} />
            {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
          </Link>
          <ThemeToggle />
          <ReportIssueButton />
          <Link
            href="/preferences"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={18} strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
            aria-label="Sign out"
          >
            <LogOut size={18} strokeWidth={1.75} />
          </button>
        </div>
        <Link href="/profile" onClick={onClose} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-gray-50">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100">
            <span className="text-xs font-medium text-gray-600">
              {employeeName.split(' ').map((name) => name[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-800">{employeeName}</p>
            <p className="truncate text-xs text-gray-400">{designation ?? employeeCode}</p>
          </div>
        </Link>
      </div>
    </aside>
  )
}
