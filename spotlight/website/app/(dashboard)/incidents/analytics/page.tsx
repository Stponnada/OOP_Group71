import Link from 'next/link'
import { Badge, buttonClass, EmptyState, Page, PageHeader, Panel, StatTile, StatTiles, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { getItsmRoles } from '@/lib/itsm-roles'
import {
  getCategoryReport,
  getEscalations,
  getOverview,
  getServiceReport,
  getSlaReport,
  getTrend,
  getWorkload,
  isItsmError,
  type ItsmResult,
} from '@/lib/itsm-api'
import { duration, humanize, when } from '../_components/format'
import { PriorityBadge } from '../_components/badges'
import TrendChart from './trend-chart-client'

const ESCALATION_LABEL = ['', 'Team lead', 'System administrator', 'IT manager']

function ok<T>(res: ItsmResult<T>, fallback: T): T {
  return isItsmError(res) ? fallback : res.data
}

export default async function AnalyticsPage() {
  const roles = await getItsmRoles()
  if (!roles.serviceDeskAdmin) {
    return (
      <Page>
        <PageHeader title="Analytics" />
        <EmptyState
          title="Analytics are for the service desk"
          action={
            <Link href="/incidents" className={buttonClass({ variant: 'secondary' })}>
              My incidents
            </Link>
          }
        />
      </Page>
    )
  }

  const [overviewRes, trendRes, slaRes, servicesRes, categoriesRes, workloadRes, escalationsRes] = await Promise.all([
    getOverview(),
    getTrend(14),
    getSlaReport(),
    getServiceReport(),
    getCategoryReport(),
    getWorkload(),
    getEscalations(8),
  ])

  if (isItsmError(overviewRes)) {
    return (
      <Page>
        <PageHeader title="Analytics" />
        <EmptyState tone="error" title="Reports unavailable" description={`${overviewRes.error}. Try again in a minute.`} />
      </Page>
    )
  }

  const o = overviewRes.data
  const trend = ok(trendRes, [])
  const sla = ok(slaRes, [])
  const services = ok(servicesRes, [])
  const categories = ok(categoriesRes, []).filter((c) => (c.incidents ?? 0) > 0)
  const workload = ok(workloadRes, [])
  const escalations = ok(escalationsRes, [])
  const maxCategory = Math.max(1, ...categories.map((c) => c.incidents ?? 0))

  return (
    <Page>
      <PageHeader title="Analytics" subtitle="How the service desk is doing: volume, deadlines, where incidents come from and who is carrying them." />

      <StatTiles>
        <StatTile label="Open incidents" value={o.openIncidents ?? 0} />
        <StatTile label="Open P1" value={o.criticalIncidents ?? 0} />
        <StatTile label="Resolved" value={o.resolvedIncidents ?? 0} />
        {/* Both measure resolved incidents, so with none resolved there is nothing to show. */}
        <StatTile label="Resolved within SLA" value={o.resolvedIncidents ? `${o.slaCompliancePercent ?? 0}%` : '—'} />
        <StatTile label="Average time to resolve" value={o.resolvedIncidents ? duration(o.averageResolutionMinutes) : '—'} />
        <StatTile label="Incidents that breached" value={o.slaViolations ?? 0} />
      </StatTiles>

      <Panel title="Reported and resolved" description="Per day over the last two weeks, India time.">
        {trend.length === 0 ? <EmptyState compact title="No data yet" /> : <TrendChart points={trend} />}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="SLA met, by priority" description="Share of incidents whose response and resolution both landed in time.">
          {sla.length === 0 ? (
            <EmptyState compact title="No incidents yet" />
          ) : (
            <ul className="space-y-4">
              {sla.map((r) => (
                <li key={r.priority}>
                  <Meter
                    label={<PriorityBadge priority={r.priority} />}
                    value={r.compliancePercent ?? 0}
                    max={100}
                    text={`${Math.round(r.compliancePercent ?? 0)}%`}
                    detail={`${r.resolutionMet ?? 0} of ${r.incidents ?? 0} resolved in time, ${r.responseMet ?? 0} answered in time`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Incidents by category">
          {categories.length === 0 ? (
            <EmptyState compact title="No incidents yet" />
          ) : (
            <ul className="space-y-4">
              {categories.map((c) => (
                <li key={c.categoryId}>
                  <Meter
                    label={<span className="text-body text-fg">{c.name}</span>}
                    value={c.incidents ?? 0}
                    max={maxCategory}
                    text={String(c.incidents ?? 0)}
                    detail={`${c.openIncidents ?? 0} open${c.slaViolations ? `, ${c.slaViolations} breached` : ''}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Technician workload"
        description="Open incidents against each technician’s limit."
        actions={
          <Link href="/incidents/technicians" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
            Manage technicians
          </Link>
        }
      >
        {workload.length === 0 ? (
          <EmptyState compact title="No technicians on the roster" />
        ) : (
          <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {workload.map((w) => (
              <li key={w.employeeId}>
                <Meter
                  label={
                    <span className="flex items-center gap-2 text-body text-fg">
                      {w.displayName}
                      {w.isAvailable === false && <Badge>Away</Badge>}
                    </span>
                  }
                  value={Math.min(100, w.utilisationPercent ?? 0)}
                  max={100}
                  text={`${Math.round(w.utilisationPercent ?? 0)}%`}
                  detail={`${w.activeIncidents ?? 0} open, ${w.resolvedIncidents ?? 0} resolved`}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Services">
        {services.length === 0 ? (
          <EmptyState compact title="No services" />
        ) : (
          <Table caption="Incidents by service" minWidth={640}>
            <THead>
              <Th>Service</Th>
              <Th>Criticality</Th>
              <Th className="text-right">Incidents</Th>
              <Th className="text-right">P1</Th>
              <Th className="text-right">Breaches</Th>
              <Th className="text-right">Average to resolve</Th>
            </THead>
            <TBody>
              {services.map((s) => (
                <Tr key={s.serviceId}>
                  <Td>{s.name}</Td>
                  <Td muted>{humanize(s.businessCriticality)}</Td>
                  <Td className="text-right tabular-nums">{s.incidents ?? 0}</Td>
                  <Td className="text-right tabular-nums">{s.p1Incidents ?? 0}</Td>
                  <Td className="text-right tabular-nums">{s.slaViolations ?? 0}</Td>
                  <Td className="text-right tabular-nums" muted>
                    {s.averageResolutionMinutes ? duration(s.averageResolutionMinutes) : '—'}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      <Panel title="Recent escalations" description="Raised automatically as deadlines pass: team lead, then system administrator, then IT manager.">
        {escalations.length === 0 ? (
          <EmptyState compact title="Nothing has been escalated" />
        ) : (
          <ul className="divide-y divide-line">
            {escalations.map((e) => {
              const rung = ESCALATION_LABEL[e.level ?? 0] ?? `Level ${e.level}`
              const { why, passedTo } = splitReason(e.reason, rung)
              return (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/incidents/${e.incidentId}`} className="font-medium text-fg underline decoration-line-strong underline-offset-2">
                      {e.reference}
                    </Link>
                    <PriorityBadge priority={e.priority} />
                    <Badge tone="negative">{rung}</Badge>
                  </p>
                  <p className="mt-0.5 text-body text-fg">{why}</p>
                  <p className="text-label text-fg-muted">
                    {!e.toName
                      ? 'Nobody holds that role yet'
                      : passedTo
                        ? `Nobody is a ${inSentence(rung)} yet, so it went to ${e.toName} as ${inSentence(passedTo)}.`
                        : `Sent to ${e.toName}`}
                  </p>
                </div>
                <span className="text-label text-fg-muted">{when(e.createdAt)}</span>
              </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </Page>
  )
}

/**
 * The monitor stores "<who took it>: <why>" (older rows hold only the why). When nobody holds a
 * rung's role the chain passes it up, so who took it can differ from the rung.
 */
function splitReason(reason: string | undefined, rung: string): { why: string; passedTo: string | null } {
  const text = reason ?? ''
  const at = text.indexOf(': ')
  if (at < 0) return { why: text, passedTo: null }
  const handledBy = text.slice(0, at).replace(/ \(nobody holds this role\)$/, '')
  return { why: text.slice(at + 2), passedTo: handledBy === rung ? null : handledBy }
}

/** "Team lead" -> "team lead", but "IT manager" keeps its acronym. */
function inSentence(role: string): string {
  return /^.[A-Z]/.test(role) ? role : role.charAt(0).toLowerCase() + role.slice(1)
}

/** A labelled horizontal bar: one hue, rounded data end, the number in text beside it. */
function Meter({
  label,
  value,
  max,
  text,
  detail,
}: {
  label: React.ReactNode
  value: number
  max: number
  text: string
  detail?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div title={detail}>
      <div className="flex items-center justify-between gap-3">
        {label}
        <span className="text-body font-medium tabular-nums text-fg">{text}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-sunken">
        <div className="h-2 rounded-full bg-series-1" style={{ width: `${pct}%`, minWidth: value > 0 ? 8 : 0 }} />
      </div>
      {detail && <p className="mt-1 text-label text-fg-muted">{detail}</p>}
    </div>
  )
}
