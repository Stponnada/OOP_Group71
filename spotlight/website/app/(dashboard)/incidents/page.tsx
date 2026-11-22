import Link from 'next/link'
import { buttonClass, EmptyState, Page, PageHeader, Panel, StatTile, StatTiles, Tabs } from '@/components/ui'
import { requireEmployee } from '@/lib/current-employee'
import { isItsmError, listIncidents } from '@/lib/itsm-api'
import type { IncidentSummary } from '@/lib/itsm-types'
import { IncidentTable } from './_components/incident-table'

// The reporter's view: only what this person reported, whatever other roles they hold. The
// service desk works from /incidents/queue and /incidents/all instead.

function needsReporter(i: IncidentSummary) {
  return i.status === 'RESOLVED' || (i.awaitingReporter === true && i.status !== 'CLOSED' && i.status !== 'CANCELLED')
}

export default async function MyIncidentsPage() {
  const { employee } = await requireEmployee()
  const res = await listIncidents({ reporterId: employee.id, size: 100, sort: 'newest' })
  const items = isItsmError(res) ? [] : (res.data.content ?? [])

  const needsYou = items.filter(needsReporter)
  const closed = items.filter((i) => i.status === 'CLOSED' || i.status === 'CANCELLED')
  const open = items.filter((i) => !closed.includes(i) && !needsYou.includes(i))

  const report = (
    <Link href="/incidents/new" className={buttonClass({ variant: 'primary' })}>
      Report an incident
    </Link>
  )

  if (isItsmError(res)) {
    return (
      <Page>
        <PageHeader title="My incidents" subtitle="Problems you reported to IT." actions={report} />
        <EmptyState tone="error" title="Incidents unavailable" description={`${res.error}. Try again in a minute.`} />
      </Page>
    )
  }

  const table = (list: IncidentSummary[], empty: string) =>
    list.length === 0 ? (
      <EmptyState compact title={empty} />
    ) : (
      <IncidentTable items={list} caption="Incidents you reported" columns={['service', 'assignee', 'opened']} />
    )

  return (
    <Page>
      <PageHeader title="My incidents" subtitle="Problems you reported to IT, and where each one stands." actions={report} />

      {items.length === 0 ? (
        <Panel>
          <EmptyState
            title="You haven’t reported anything"
            description="When something IT runs stops working, report it here. Spotlight sets the priority, finds a technician and keeps you posted."
            action={report}
          />
        </Panel>
      ) : (
        <>
          <StatTiles>
            <StatTile label="Needs you" value={needsYou.length} />
            <StatTile label="Being worked on" value={open.length} />
            <StatTile label="Closed" value={closed.length} />
          </StatTiles>

          {needsYou.length > 0 && (
            <Panel
              title="Waiting on you"
              description="A technician asked you something, or says it’s fixed and wants you to confirm."
              count={needsYou.length}
            >
              <ul className="divide-y divide-line">
                {needsYou.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-fg">
                        {i.reference} · {i.title}
                      </p>
                      <p className="text-label text-fg-muted">
                        {i.status === 'RESOLVED'
                          ? `${i.assigneeName ?? 'The technician'} says it’s fixed. Is it?`
                          : `${i.assigneeName ?? 'The technician'} asked you a question.`}
                      </p>
                    </div>
                    <Link href={`/incidents/${i.id}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                      {i.status === 'RESOLVED' ? 'Confirm the fix' : 'Reply'}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel>
            <Tabs
              label="Your incidents"
              defaultId={open.length > 0 || needsYou.length > 0 ? 'open' : 'closed'}
              tabs={[
                { id: 'open', label: 'Open', count: open.length + needsYou.length, content: table([...needsYou, ...open], 'Nothing open. Good.') },
                { id: 'closed', label: 'Closed', count: closed.length, content: table(closed, 'Nothing closed yet.') },
                { id: 'all', label: 'All', count: items.length, content: table(items, 'Nothing yet.') },
              ]}
            />
          </Panel>
        </>
      )}
    </Page>
  )
}
