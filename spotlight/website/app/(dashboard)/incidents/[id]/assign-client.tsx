'use client'

import { useState, useTransition } from 'react'
import { Badge, Button, FormMessage } from '@/components/ui'
import type { TechnicianRecommendation } from '@/lib/itsm-types'
import { assignTo } from '../actions'

/**
 * Every technician ranked for this incident, with the reasons. The person assigning sees the
 * trade-off (skills, load, experience) and which strategies agree, then picks; or lets the
 * configured strategy pick.
 */
export function AssignChooser({
  incidentId,
  recommendations,
  strategyLabel,
  onDone,
}: {
  incidentId: string
  recommendations: TechnicianRecommendation[]
  strategyLabel: string | null
  onDone?: () => void
}) {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function assign(technicianId: string | null) {
    setError(null)
    setBusy(technicianId ?? 'auto')
    start(async () => {
      const res = await assignTo(incidentId, technicianId)
      setBusy(null)
      if ('error' in res) setError(res.error)
      else onDone?.()
    })
  }

  const best = recommendations.find((r) => (r.score ?? 0) > 0)

  return (
    <div className="space-y-3">
      {recommendations.length === 0 ? (
        <p className="text-body text-fg-muted">
          No technician to suggest. Suggestions never include the person who reported the incident; add more people under
          Service Desk → Technicians.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {recommendations.map((r) => {
            const full = (r.activeIncidents ?? 0) >= (r.maxActiveIncidents ?? 1)
            const usable = r.isAvailable !== false && !full
            return (
              <li key={r.employeeId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">{r.displayName}</span>
                    {best && r.employeeId === best.employeeId && <Badge tone="positive">Best match</Badge>}
                    {r.isAvailable === false ? (
                      <Badge tone="negative">Away</Badge>
                    ) : full ? (
                      <Badge tone="attention">Full</Badge>
                    ) : null}
                    {(r.pickedBy ?? []).map((s) => (
                      <Badge key={s}>{s} picks</Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-label text-fg-muted">{(r.reasons ?? []).join(' · ')}</p>
                  <div className="mt-2 flex items-center gap-2" aria-hidden="true">
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-sunken">
                      <div className="h-full rounded-full bg-action" style={{ width: `${Math.min(100, r.score ?? 0)}%` }} />
                    </div>
                    <span className="text-label text-fg-muted">{Math.round(r.score ?? 0)} / 100</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!usable || pending}
                  pending={busy === r.employeeId}
                  pendingLabel="Assigning…"
                  onClick={() => r.employeeId && assign(r.employeeId)}
                  aria-label={`Assign to ${r.displayName}`}
                >
                  Assign
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {strategyLabel && recommendations.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-label text-fg-muted">Or let the {strategyLabel.toLowerCase()} strategy decide.</p>
          <Button size="sm" variant="ghost" disabled={pending} pending={busy === 'auto'} pendingLabel="Assigning…" onClick={() => assign(null)}>
            Auto-assign
          </Button>
        </div>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  )
}
