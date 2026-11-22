'use client'

import { useState, useTransition } from 'react'
import { Button, Field, FormMessage, Textarea } from '@/components/ui'
import type { IncidentAction } from '@/lib/itsm-types'
import { postNote } from '../actions'

type Kind = 'INVESTIGATION' | 'INTERNAL' | 'INFO_REQUEST' | 'INFO_RESPONSE'

const KINDS: Record<Kind, { label: string; hint: string; button: string }> = {
  INVESTIGATION: { label: 'Update', hint: 'Visible to the reporter.', button: 'Post update' },
  INTERNAL: { label: 'Internal note', hint: 'Only the service desk sees this.', button: 'Add note' },
  INFO_REQUEST: { label: 'Ask the reporter', hint: 'The reporter is notified and asked to reply.', button: 'Send question' },
  INFO_RESPONSE: { label: 'Add information', hint: 'The technician is notified.', button: 'Send' },
}

/** Writing on the incident: staff choose who sees it, the reporter just adds information. */
export default function Composer({
  incidentId,
  actions,
  isReporter,
}: {
  incidentId: string
  actions: IncidentAction[]
  isReporter: boolean
}) {
  const staffKinds: Kind[] = actions.includes('ADD_NOTE')
    ? (['INVESTIGATION', 'INTERNAL', ...(actions.includes('REQUEST_INFO') ? ['INFO_REQUEST'] : [])] as Kind[])
    : []
  const kinds: Kind[] = isReporter && actions.includes('RESPOND') ? ['INFO_RESPONSE', ...staffKinds.filter((k) => k !== 'INTERNAL')] : staffKinds
  const [kind, setKind] = useState<Kind>(kinds[0] ?? 'INFO_RESPONSE')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (kinds.length === 0) return null
  const meta = KINDS[kind]

  function send() {
    setError(null)
    start(async () => {
      const res = await postNote(incidentId, kind, body)
      if ('error' in res) setError(res.error)
      else setBody('')
    })
  }

  return (
    <div className="space-y-3">
      {kinds.length > 1 && (
        <div role="radiogroup" aria-label="Who sees this" className="flex flex-wrap gap-1">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-label font-medium focus-visible:outline-2 focus-visible:outline-focus ${
                kind === k ? 'bg-action text-action-fg' : 'text-fg-muted hover:bg-sunken hover:text-fg'
              }`}
            >
              {KINDS[k].label}
            </button>
          ))}
        </div>
      )}
      <Field label={kinds.length > 1 ? 'Message' : meta.label} hint={meta.hint}>
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex justify-end">
        <Button variant="secondary" pending={pending} pendingLabel="Sending…" disabled={!body.trim()} onClick={send}>
          {meta.button}
        </Button>
      </div>
    </div>
  )
}
