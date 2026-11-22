'use client'

import { Moon, Sun } from 'lucide-react'
import { applyTheme } from '@/lib/theme'

/** Sidebar shortcut: flips between light and dark. Settings also offers "Match system". */
export default function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={() => applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')}
      className="theme-toggle rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <Moon className="theme-toggle__moon" size={17} strokeWidth={1.75} />
      <Sun className="theme-toggle__sun" size={17} strokeWidth={1.75} />
    </button>
  )
}
