'use client'

import { useState, useTransition } from 'react'
import { Button, Field, FormMessage, Modal, Textarea } from '@/components/ui'
import type { IncidentAction, TechnicianRecommendation } from '@/lib/itsm-types'
import { moveIncident } from '../actions'
import { AssignChooser } from './assign-client'

/** Secondary actions in the page header: reassign and cancel. The next step owns the primary one. */
export default function HeaderActions({
  incidentId,
  actions,
  reference,
  hasAssignee,
  recommendations,
  strategyLabel,
}: {
  incidentId: string
  actions: IncidentAction[]
  reference: string
  hasAssignee: boolean
  recommendations: TechnicianRecommendation[]
  strategyLabel: string | null
}) {
  const [open, setOpen] = useState<'reassign' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const canReassign = actions.includes('ASSIGN') && hasAssignee
  const canCancel = actions.includes('CANCEL')
  if (!canReassign && !canCancel) return null

  function cancel() {
    setError(null)
    start(async () => {
      const res = await moveIncident(incidentId, 'CANCELLED', { reason })
      if ('error' in res) setError(res.error)
      else setOpen(null)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canReassign && (
        <Button variant="secondary" size="sm" onClick={() => setOpen('reassign')}>
          Reassign
        </Button>
      )}
      {canCancel && (
        <Button variant="ghost" size="sm" onClick={() => setOpen('cancel')}>
          Cancel incident
        </Button>
      )}

      <Modal open={open === 'reassign'} onClose={() => setOpen(null)} title={`Reassign ${reference}`} size="lg">
        <AssignChooser
          incidentId={incidentId}
          recommendations={recommendations}
          strategyLabel={strategyLabel}
          onDone={() => setOpen(null)}
        />
      </Modal>

      <Modal
        open={open === 'cancel'}
        onClose={() => setOpen(null)}
        title={`Cancel ${reference}?`}
        description="The reporter and the assigned technician are told, with your reason."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)} disabled={pending}>
              Keep it open
            </Button>
            <Button variant="danger" pending={pending} pendingLabel="Cancelling…" disabled={!reason.trim()} onClick={cancel}>
              Cancel incident
            </Button>
          </>
        }
      >
        <Field label="Reason" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} autoFocus />
        </Field>
        {error && (
          <div className="mt-3">
            <FormMessage tone="error">{error}</FormMessage>
          </div>
        )}
      </Modal>
    </div>
  )
}
