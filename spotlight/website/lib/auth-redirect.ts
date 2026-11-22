export function getAuthRedirectPath(next: string | null | undefined, recovery = false): string {
  if (recovery) return '/auth/update-password'
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  // URL parsing also catches backslash variants of protocol-relative URLs.
  const base = 'https://spotlight.invalid'
  const target = new URL(next, base)
  return target.origin === base ? `${target.pathname}${target.search}` : '/dashboard'
}
