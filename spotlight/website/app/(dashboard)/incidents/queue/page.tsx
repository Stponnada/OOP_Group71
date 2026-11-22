import Link from 'next/link'
import { buttonClass, EmptyState, Page, PageHeader, Panel, StatTile, StatTiles, Tabs } from '@/components/ui'
import { requireEmployee } from '@/lib/current-employee'
import { getQueue, isItsmError, listTechnicians } from '@/lib/itsm-api'
import { getItsmRoles } from '@/lib/itsm-roles'
import type { IncidentSummary } from '@/lib/itsm-types'
import { IncidentTable } from '../_components/incident-table'
import { TakeButton } from '../_components/row-actions-client'

// The technician's desk: their open work, soonest deadline first, and the pool nobody has taken.

const atRisk = (i: IncidentSummary) => i.slaStatus === 'BREACHED' || i.slaStatus === 'WARNING' || i.slaRisk === 'HIGH'

export default async function QueuePage() {
  const { employee } = await requireEmployee()
  const roles = await getItsmRoles()

  if (!roles.technician) {
    return (
      <Page>
        <PageHeader title="My work" />
        <EmptyState
          title="You’re not on the technician roster"
          description={
            roles.serviceDeskAdmin
              ? 'Add yourself under Technicians to take incidents. All incidents shows the whole desk.'
              : 'This queue is for IT technicians. Incidents you reported are under My incidents.'
          }
          action={
            <Link href={roles.serviceDeskAdmin ? '/incidents/technicians' : '/incidents'} className={buttonClass({ variant: 'secondary' })}>
              {roles.serviceDeskAdmin ? 'Technicians' : 'My incidents'}
            </Link>
          }
        />
      </Page>
    )
  }

  const [mineRes, poolRes, techRes] = await Promise.all([
    getQueue({ mineOnly: true, includeUnassigned: false, size: 100, sort: 'due' }),
    getQueue({ mineOnly: false, size: 100, sort: 'priority' }),
    listTechnicians(),
  ])

  if (isItsmError(mineRes)) {
    return (
      <Page>
        <PageHeader title="My work" />
        <EmptyState tone="error" title="Queue unavailable" description={`${mineRes.error}. Try again in a minute.`} />
      </Page>
    )
  }

  const mine = mineRes.data.content ?? []
  const pool = isItsmError(poolRes) ? [] : (poolRes.data.content ?? [])
  const me = isItsmError(techRes) ? undefined : techRes.data.find((t) => t.employeeId === employee.id)

  const toAcknowledge = mine.filter((i) => i.status === 'ASSIGNED')
  const waiting = mine.filter((i) => i.awaitingReporter || i.status === 'RESOLVED' || i.status === 'VERIFIED')
  const risky = mine.filter(atRisk)
  const full = me?.maxActiveIncidents !== undefined && (me.activeIncidents ?? 0) >= me.maxActiveIncidents

  return (
    <Page>
      <PageHeader
        title="My work"
        subtitle={
          me?.isAvailable === false
            ? 'You are marked away, so nothing new is assigned to you automatically.'
            : 'Your open incidents, soonest deadline first, and the ones nobody has taken yet.'
        }
      />

      <StatTiles>
        <StatTile
          label="Assigned to you"
          value={me?.maxActiveIncidents ? `${mine.filter((i) => i.status !== 'RESOLVED' && i.status !== 'VERIFIED').length} of ${me.maxActiveIncidents}` : mine.length}
        />
        <StatTile label="To acknowledge" value={toAcknowledge.length} />
        <StatTile label="Breached or at risk" value={risky.length} />
        <StatTile label="Unassigned" value={pool.length} />
      </StatTiles>

      <Panel>
        <Tabs
          label="Queue"
          defaultId={mine.length > 0 || pool.length === 0 ? 'mine' : 'pool'}
          tabs={[
            {
              id: 'mine',
              label: 'Assigned to me',
              count: mine.length,
              content:
                mine.length === 0 ? (
                  <EmptyState compact title="Nothing assigned to you" description="Take one from Unassigned, or enjoy the quiet." />
                ) : (
                  <IncidentTable items={mine} caption="Incidents assigned to you" columns={['service', 'reporter', 'due']} />
                ),
            },
            {
              id: 'pool',
              label: 'Unassigned',
              count: pool.length,
              content:
                pool.length === 0 ? (
                  <EmptyState compact title="Every incident has a technician" />
                ) : (
                  <>
                    {full && (
                      <p className="mb-3 text-label text-fg-muted">
                        You are at your limit of {me?.maxActiveIncidents} open incidents. Taking another goes past it.
                      </p>
                    )}
                    <IncidentTable
                      items={pool}
                      caption="Incidents nobody has taken"
                      columns={['service', 'reporter', 'due']}
                      rowAction={(i) => (i.id ? <TakeButton incidentId={i.id} /> : null)}
                    />
                  </>
                ),
            },
            {
              id: 'waiting',
              label: 'Waiting on reporter',
              count: waiting.length,
              content:
                waiting.length === 0 ? (
                  <EmptyState compact title="Nobody owes you an answer" />
                ) : (
                  <IncidentTable items={waiting} caption="Waiting for the reporter" columns={['reporter', 'due']} />
                ),
            },
          ]}
        />
      </Panel>
    </Page>
  )
}
