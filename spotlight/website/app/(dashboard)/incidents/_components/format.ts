import type { IncidentStatus, Impact, Priority, Urgency } from '@/lib/itsm-types'

const TZ = 'Asia/Kolkata'

export function when(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}

export function day(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ })
}

/** 95 -> "1h 35m", 3000 -> "2d 2h". */
export function duration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—'
  const m = Math.round(Math.abs(minutes))
  if (m < 60) return `${m}m`
  if (m < 60 * 24) return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`
  const d = Math.floor(m / (60 * 24))
  const h = Math.floor((m % (60 * 24)) / 60)
  return `${d}d${h ? ` ${h}h` : ''}`
}

/** "in 2h 10m" or "4h ago", relative to now. */
export function relative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const minutes = (new Date(iso).getTime() - now) / 60000
  return minutes >= 0 ? `in ${duration(minutes)}` : `${duration(minutes)} ago`
}

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  NEW: 'New',
  CLASSIFIED: 'Waiting for a technician',
  ASSIGNED: 'Assigned',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  VERIFIED: 'Fix confirmed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: 'P1 Critical',
  P2: 'P2 High',
  P3: 'P3 Medium',
  P4: 'P4 Low',
}

export const IMPACT_LABEL: Record<Impact, string> = {
  MINIMAL: 'Minimal: one person, workaround exists',
  MINOR: 'Minor: a few people',
  MAJOR: 'Major: a team or department',
  EXTENSIVE: 'Extensive: the whole company or customers',
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  LOW: 'Low: can wait',
  MEDIUM: 'Medium: slowing work down',
  HIGH: 'High: work is blocked',
  CRITICAL: 'Critical: business stopped',
}

export const OPEN_STATUSES: IncidentStatus[] = ['NEW', 'CLASSIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED']

export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const s = value.replace(/_/g, ' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
