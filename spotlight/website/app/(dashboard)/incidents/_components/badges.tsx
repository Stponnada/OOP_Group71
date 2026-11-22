import { Badge } from '@/components/ui'
import type { IncidentStatus, Priority, SlaRisk, SlaStatus } from '@/lib/itsm-types'
import { STATUS_LABEL } from './format'

// Four meanings only (neutral, attention, positive, negative). The label says the exact state.

const STATUS_TONE: Record<IncidentStatus, 'neutral' | 'attention' | 'positive' | 'negative'> = {
  NEW: 'attention',
  CLASSIFIED: 'attention',
  ASSIGNED: 'neutral',
  ACKNOWLEDGED: 'neutral',
  IN_PROGRESS: 'neutral',
  RESOLVED: 'attention',
  VERIFIED: 'positive',
  CLOSED: 'positive',
  CANCELLED: 'neutral',
}

export function IncidentStatusBadge({ status }: { status?: IncidentStatus | null }) {
  if (!status) return null
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

export function PriorityBadge({ priority }: { priority?: Priority | null }) {
  if (!priority) return null
  const tone = priority === 'P1' ? 'negative' : priority === 'P2' ? 'attention' : 'neutral'
  return <Badge tone={tone}>{priority}</Badge>
}

/** SLA state for the resolution clock; risk is the forecast while the clock still runs. */
export function SlaBadge({ status, risk }: { status?: SlaStatus | null; risk?: SlaRisk | null }) {
  if (status === 'BREACHED') return <Badge tone="negative">Breached</Badge>
  if (status === 'MET') return <Badge tone="positive">Met</Badge>
  if (risk === 'HIGH') return <Badge tone="negative">At risk</Badge>
  if (status === 'WARNING' || risk === 'MEDIUM') return <Badge tone="attention">Due soon</Badge>
  if (status === 'ON_TRACK') return <Badge tone="neutral">On track</Badge>
  return null
}
