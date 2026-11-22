import Link from 'next/link'
import { Badge, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import type { IncidentSummary } from '@/lib/itsm-types'
import { IncidentStatusBadge, PriorityBadge, SlaBadge } from './badges'
import { day, relative } from './format'

type Column = 'reporter' | 'assignee' | 'service' | 'due' | 'opened'

// Once resolved the deadline no longer runs, so there is nothing to count down to.
const CLOCK_STOPPED = new Set(['RESOLVED', 'VERIFIED', 'CLOSED', 'CANCELLED'])

/**
 * The one incident list. Each screen picks the columns its reader needs: a reporter doesn't
 * need their own name, a technician needs the deadline, the desk needs both people.
 */
export function IncidentTable({
  items,
  caption,
  columns,
  rowAction,
}: {
  items: IncidentSummary[]
  caption: string
  columns: Column[]
  rowAction?: (incident: IncidentSummary) => React.ReactNode
}) {
  const has = (c: Column) => columns.includes(c)
  return (
    <Table caption={caption} minWidth={720}>
      <THead>
        <Th>Incident</Th>
        <Th>Status</Th>
        <Th>Priority</Th>
        {has('service') && <Th>Service</Th>}
        {has('reporter') && <Th>Reported by</Th>}
        {has('assignee') && <Th>Assignee</Th>}
        {has('due') && <Th>Next deadline</Th>}
        {has('opened') && <Th>Opened</Th>}
        {rowAction && <Th className="text-right">Action</Th>}
      </THead>
      <TBody>
        {items.map((i) => (
          <Tr key={i.id}>
            <Td>
              <Link href={`/incidents/${i.id}`} className="font-medium text-fg underline decoration-line-strong underline-offset-2">
                {i.reference}
              </Link>
              <p className="mt-0.5 line-clamp-1 text-label text-fg-muted">{i.title}</p>
            </Td>
            <Td>
              <div className="flex flex-wrap items-center gap-1.5">
                <IncidentStatusBadge status={i.status} />
                {i.awaitingReporter && <Badge tone="attention">Needs reply</Badge>}
              </div>
            </Td>
            <Td nowrap>
              <PriorityBadge priority={i.priority} />
            </Td>
            {has('service') && <Td muted>{i.serviceName ?? '—'}</Td>}
            {has('reporter') && <Td muted>{i.reporterName ?? '—'}</Td>}
            {has('assignee') && <Td muted>{i.assigneeName ?? <span className="text-fg">Unassigned</span>}</Td>}
            {has('due') && (
              <Td nowrap>
                <div className="flex items-center gap-1.5">
                  <SlaBadge status={i.slaStatus} risk={i.slaRisk} />
                  <span className="text-label text-fg-muted">
                    {CLOCK_STOPPED.has(i.status!) ? '' : relative(i.dueAt)}
                  </span>
                </div>
              </Td>
            )}
            {has('opened') && <Td muted nowrap>{day(i.createdAt)}</Td>}
            {rowAction && <Td className="text-right">{rowAction(i)}</Td>}
          </Tr>
        ))}
      </TBody>
    </Table>
  )
}
