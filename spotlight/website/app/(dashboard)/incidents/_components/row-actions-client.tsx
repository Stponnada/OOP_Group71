'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { assignTo, takeIncident } from '../actions'

/** "Take" on an unassigned row: assigns it to the signed-in technician and opens it. */
export function TakeButton({ incidentId }: { incidentId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-label text-danger">{error}</span>}
      <Button
        size="sm"
        variant="secondary"
        pending={pending}
        pendingLabel="Taking…"
        onClick={() =>
          start(async () => {
            const res = await takeIncident(incidentId)
            if ('error' in res) setError(res.error)
            else router.push(`/incidents/${incidentId}`)
          })
        }
      >
        Take
      </Button>
    </span>
  )
}

/** "Auto-assign" on an unassigned row: lets the configured strategy pick the technician. */
export function AutoAssignButton({ incidentId }: { incidentId: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-label text-danger">{error}</span>}
      <Button
        size="sm"
        variant="secondary"
        pending={pending}
        pendingLabel="Assigning…"
        onClick={() =>
          start(async () => {
            const res = await assignTo(incidentId, null)
            if ('error' in res) setError(res.error)
          })
        }
      >
        Auto-assign
      </Button>
    </span>
  )
}
