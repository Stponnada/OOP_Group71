// The colour theme, kept in this browser (app/layout.tsx applies it before first paint).
// 'system' follows the device. The sidebar toggle and the Settings page both use these, and
// announce changes so the other stays in step.

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'spotlight-theme'
export const THEME_EVENT = 'spotlight-theme-change'

export function readTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT))
}
