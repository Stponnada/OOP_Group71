import Link from 'next/link'
import { Badge, buttonClass, EmptyState, Page, PageHeader, Panel, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { getItsmRoles } from '@/lib/itsm-roles'
import { getAudit, isItsmError } from '@/lib/itsm-api'
import type { AuditEntry } from '@/lib/itsm-types'
import { humanize, when } from '../_components/format'

// Every change the service desk made, from the shared audit log: incident history and every
// configuration change, with who made it and what it changed.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const roles = await getItsmRoles()
  if (!roles.serviceDeskAdmin) {
    return (
      <Page>
        <PageHeader title="Audit log" />
        <EmptyState
          title="The audit log is for the service desk"
          action={
            <Link href="/incidents" className={buttonClass({ variant: 'secondary' })}>
              My incidents
            </Link>
          }
        />
      </Page>
    )
  }

  const sp = await searchParams
  const raw = Array.isArray(sp.incidentId) ? sp.incidentId[0] : sp.incidentId
  const incidentId = raw && UUID.test(raw) ? raw : undefined
  const res = await getAudit({ incidentId, limit: 200 })
  const entries = isItsmError(res) ? [] : res.data
  const reference = incidentId ? entries.find((e) => e.incidentReference)?.incidentReference : null

  return (
    <Page>
      <PageHeader
        title="Audit log"
        subtitle={
          incidentId
            ? `Everything recorded for ${reference ?? 'this incident'}.`
            : 'Every change to incidents and service-desk settings, newest first.'
        }
        actions={
          incidentId ? (
            <span className="flex gap-2">
              <Link href={`/incidents/${incidentId}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                Open {reference ?? 'incident'}
              </Link>
              <Link href="/incidents/audit" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
                Show everything
              </Link>
            </span>
          ) : undefined
        }
      />
      <Panel count={entries.length}>
        {isItsmError(res) ? (
          <EmptyState tone="error" title="Audit log unavailable" description={`${res.error}. Try again in a minute.`} />
        ) : entries.length === 0 ? (
          <EmptyState compact title="Nothing recorded yet" />
        ) : (
          <Table caption="Audit entries" minWidth={760}>
            <THead>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What</Th>
              <Th>Change</Th>
            </THead>
            <TBody>
              {entries.map((e, n) => (
                <Tr key={e.id ?? n}>
                  <Td muted nowrap>
                    {when(e.occurredAt)}
                  </Td>
                  <Td nowrap>{e.actorName || 'Spotlight'}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{actionLabel(e)}</Badge>
                      {e.incidentId && !incidentId ? (
                        <Link href={`/incidents/audit?incidentId=${e.incidentId}`} className="font-medium underline decoration-line-strong underline-offset-2">
                          {e.subject}
                        </Link>
                      ) : (
                        <span className="font-medium text-fg">{e.subject}</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Changes entry={e} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>
    </Page>
  )
}

const HIDDEN = new Set(['id', 'updated_at', 'created_at', 'org_id'])

// The shared audit table only allows a fixed set of action words (create, status_change, …), so
// configuration edits are stored as status_change. Name them by what they did instead.
const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  status_change: 'Changed',
  role_assign: 'Added',
  role_revoke: 'Removed',
  deactivate: 'Retired',
  delete: 'Removed',
}

function actionLabel(e: AuditEntry): string {
  const statusMoved = e.oldValues && e.newValues && 'status' in e.oldValues && 'status' in e.newValues
  if (e.action === 'status_change' && statusMoved) return 'Status change'
  return ACTION_LABEL[e.action ?? ''] ?? humanize(e.action)
}

/** "assignedTechnicianId" and "assigned_technician_id" both read "Assigned technician id". */
function fieldLabel(key: string): string {
  return humanize(key.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.length ? v.map(show).join(', ') : 'none'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.length > 80 ? `${s.slice(0, 77)}…` : s
}

/** Old → new for every field that changed; the new values alone for a creation. */
function Changes({ entry }: { entry: AuditEntry }) {
  const before = (entry.oldValues ?? {}) as Record<string, unknown>
  const after = (entry.newValues ?? {}) as Record<string, unknown>
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !HIDDEN.has(k))
  const changed = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
  if (changed.length === 0) return <span className="text-label text-fg-muted">—</span>
  return (
    <dl className="space-y-0.5 text-label">
      {changed.slice(0, 6).map((k) => (
        <div key={k} className="flex flex-wrap gap-x-1.5">
          <dt className="text-fg-muted">{fieldLabel(k)}:</dt>
          <dd className="text-fg">
            {k in before && <span className="text-fg-muted line-through decoration-fg-subtle">{show(before[k])}</span>}
            {k in before && k in after && ' → '}
            {k in after && show(after[k])}
          </dd>
        </div>
      ))}
      {changed.length > 6 && <div className="text-fg-muted">and {changed.length - 6} more</div>}
    </dl>
  )
}
