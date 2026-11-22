// Every status in Spotlight maps to one of four meanings. Colour says which;
// the badge's text says the exact state. Keep this the only status→colour map.

export type Tone = 'neutral' | 'attention' | 'positive' | 'negative'

const ATTENTION = [
  'pending',
  'pending_approval',
  'awaiting',
  'submitted',
  'in_review',
  'reviewing',
  'under_review',
  'onboarding',
  'requested',
  'missing_bill',
  'partially_paid',
  'on_hold',
  'transfer_pending',
  'in_progress',
  'shortlisted',
  'interview_scheduled',
  'interviewed',
  'offer_extended',
  'paused',
]

const POSITIVE = [
  'approved',
  'accepted',
  'completed',
  'complete',
  'delivered',
  'received',
  'paid',
  'published',
  'open',
  'active',
  'signed_in',
  'done',
  'hired',
  'transferred',
  'reimbursed',
  'in_stock',
  'transfer_confirmed',
  'ready_for_collection',
  'collected',
]

const NEGATIVE = [
  'rejected',
  'declined',
  'cancelled',
  'canceled',
  'failed',
  'overdue',
  'deactivated',
  'inactive',
  'blocked',
  'out_of_stock',
  'flagged',
  'not_completed',
]

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return 'neutral'
  const s = status.toLowerCase().replace(/[\s-]+/g, '_')
  if (NEGATIVE.includes(s)) return 'negative'
  if (ATTENTION.includes(s)) return 'attention'
  if (POSITIVE.includes(s)) return 'positive'
  return 'neutral'
}
