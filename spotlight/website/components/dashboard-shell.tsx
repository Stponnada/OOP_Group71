'use client'

import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/sidebar'
import type { AccessProfile } from '@/lib/access'
import { AssistantProvider } from '@/components/assistant/assistant-context'
import { MarinerDockProvider } from '@/components/assistant/mariner-dock-context'
import { MarinerDockPanel } from '@/app/(dashboard)/dashboard/home-chat'
import { PreferencesProvider } from '@/components/preferences-context'

type DashboardShellProps = {
  children: React.ReactNode
  employeeName: string
  employeeCode: string
  designation: string | null
  unreadCount: number
  accessProfile: AccessProfile
  hideMascot: boolean
}

export default function DashboardShell({
  children,
  employeeName,
  employeeCode,
  designation,
  unreadCount,
  accessProfile,
  hideMascot,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    // The provider stays so forms that register with it (employee invite) keep working. Mariner
    // lives on the home page; it docks beside other pages only after following a link from a chat.
    <PreferencesProvider initial={{ hideMascot }}>
    <AssistantProvider>
      <MarinerDockProvider>
      <div className="flex h-screen overflow-hidden bg-ground">
        <div
          className={`fixed inset-0 z-40 bg-gray-900/35 transition-opacity duration-200 lg:hidden ${
            mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        <Sidebar
          mobileMenuOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          accessProfile={accessProfile}
          employeeName={employeeName}
          employeeCode={employeeCode}
          designation={designation}
          unreadCount={unreadCount}
        />

        <div className="app-main relative flex min-w-0 flex-1 flex-col overflow-hidden bg-ground">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="absolute left-4 top-4 z-30 rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-sm transition-colors hover:text-gray-700 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <main className="flex-1 overflow-y-auto p-4 pt-16 sm:px-6 sm:pb-6 lg:pt-6">
            {children}
          </main>
        </div>

        <MarinerDockPanel />
      </div>
      </MarinerDockProvider>
    </AssistantProvider>
    </PreferencesProvider>
  )
}
