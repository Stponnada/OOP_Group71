import type { ReactNode } from 'react'
import { statusTone, type Tone } from '@/lib/status'

const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-fg-muted',
  attention: 'bg-warning-soft text-warning',
  positive: 'bg-success-soft text-success',
  negative: 'bg-danger-soft text-danger',
}

/** The one chip: 12px, medium, one radius. Colour carries one of four meanings; the label says the rest. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-label font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** Status chip: maps any status string to its tone and prints a readable label. */
export function StatusBadge({ status, label }: { status: string | null | undefined; label?: ReactNode }) {
  const text = label ?? humanizeStatus(status)
  return <Badge tone={statusTone(status)}>{text}</Badge>
}

export function humanizeStatus(status: string | null | undefined) {
  if (!status) return '—'
  const s = status.replace(/[_-]+/g, ' ').toLowerCase().trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
