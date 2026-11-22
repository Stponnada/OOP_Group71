'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Badge, Button, ConfirmDialog, FormMessage, Panel } from '@/components/ui'
import type { IncidentLink, Suggestions } from '@/lib/itsm-types'
import { linkIncidents } from '../actions'
import { STATUS_LABEL } from '../_components/format'

const RELATION_LABEL: Record<string, string> = {
  DUPLICATE: 'Duplicate',
  RELATED: 'Related',
  PARENT: 'Parent',
  CHILD: 'Duplicate of this',
}

/** Linked incidents, plus the service's duplicate and prior-fix suggestions for staff. */
export default function Related({
  incidentId,
  reference,
  canLink,
  canOpenOthers,
  links,
  suggestions,
}: {
  incidentId: string
  reference: string
  canLink: boolean
  /** Reporters can't open other people's incidents, so they see the links as text. */
  canOpenOthers: boolean
  links: IncidentLink[]
  suggestions: Suggestions | null
}) {
  const [confirm, setConfirm] = useState<{ id: string; ref: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const linked = new Set(links.map((l) => l.incidentId))
  const candidates = [...(suggestions?.duplicates ?? []), ...(suggestions?.related ?? [])].filter(
    (s) => s.incidentId && !linked.has(s.incidentId),
  )
  const fixes = suggestions?.priorResolutions ?? []
  if (links.length === 0 && candidates.length === 0 && fixes.length === 0) return null

  function link(relatedId: string, relation: 'DUPLICATE' | 'RELATED', cancelAsDuplicate: boolean) {
    setError(null)
    start(async () => {
      const res = await linkIncidents(incidentId, relatedId, relation, cancelAsDuplicate)
      if ('error' in res) setError(res.error)
      setConfirm(null)
    })
  }

  return (
    <Panel title="Related incidents">
      <div className="space-y-5 text-body">
        {links.length > 0 && (
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={`${l.incidentId}-${l.relation}`} className="flex flex-wrap items-center gap-2">
                <Badge tone={l.relation === 'DUPLICATE' || l.relation === 'CHILD' ? 'attention' : 'neutral'}>
                  {RELATION_LABEL[l.relation ?? ''] ?? l.relation}
                </Badge>
                {canOpenOthers ? (
                  <Link href={`/incidents/${l.incidentId}`} className="font-medium underline decoration-line-strong underline-offset-2">
                    {l.reference}
                  </Link>
                ) : (
                  <span className="font-medium text-fg">{l.reference}</span>
                )}
                <span className="text-fg-muted">{l.status ? STATUS_LABEL[l.status] : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {links.length > 0 && !canOpenOthers && (
          <p className="text-label text-fg-muted">
            Other people reported the same problem. The service desk fixes them together, and you’ll hear when yours is done.
          </p>
        )}

        {candidates.length > 0 && (
          <div>
            <p className="text-label font-medium text-fg-muted">Looks similar</p>
            <ul className="mt-2 space-y-3">
              {candidates.map((s) => (
                <li key={s.incidentId}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/incidents/${s.incidentId}`} className="font-medium underline decoration-line-strong underline-offset-2">
                      {s.reference}
                    </Link>
                    {typeof s.similarity === 'number' && <Badge>{Math.round(s.similarity * 100)}% match</Badge>}
                  </div>
                  <p className="mt-0.5 text-fg-muted">{s.title}</p>
                  {canLink && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirm({ id: s.incidentId!, ref: s.reference ?? '' })}>
                        Mark as duplicate
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => link(s.incidentId!, 'RELATED', false)}>
                        Link as related
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {fixes.length > 0 && (
          <div>
            <p className="text-label font-medium text-fg-muted">What fixed similar incidents</p>
            <ul className="mt-2 space-y-3">
              {fixes.map((f) => (
                <li key={f.incidentId}>
                  <Link href={`/incidents/${f.incidentId}`} className="font-medium underline decoration-line-strong underline-offset-2">
                    {f.reference}
                  </Link>
                  <p className="mt-0.5 text-fg">{f.resolutionNote}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && link(confirm.id, 'DUPLICATE', true)}
        title={`Close ${reference} as a duplicate of ${confirm?.ref}?`}
        description={`${reference} is cancelled and its reporter is pointed at ${confirm?.ref}, which carries on.`}
        confirmLabel="Mark as duplicate"
        pending={pending}
      />
    </Panel>
  )
}
