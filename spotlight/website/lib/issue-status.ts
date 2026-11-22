// ── Issues people report with Spotlight itself: the shapes shared by the browser and server.
//    Filing and notifying live in lib/issues.ts. ─────────────────────────────────────────────

export const ISSUE_STATUSES = ['open', 'in_progress', 'fixed', 'wont_fix'] as const
export type IssueStatus = (typeof ISSUE_STATUSES)[number]

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  fixed: 'Fixed',
  wont_fix: "Won't fix",
}

export const isIssueStatus = (s: unknown): s is IssueStatus => ISSUE_STATUSES.includes(s as IssueStatus)

export const DESCRIPTION_MAX = 4000

/** Keeps only an in-app path (no origin, no query secrets beyond what the page shows), capped. */
export function cleanPagePath(path: unknown): string | null {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null
  return path.slice(0, 500)
}
