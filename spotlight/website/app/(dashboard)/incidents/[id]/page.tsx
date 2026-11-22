import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Badge, EmptyState, Page, PageHeader, Panel } from '@/components/ui'
import { requireEmployee } from '@/lib/current-employee'
import { getItsmRoles } from '@/lib/itsm-roles'
import {
  getAssignmentSettings,
  getIncident,
  getIncidentSuggestions,
  getIncidentTimeline,
  getRecommendations,
  isItsmError,
} from '@/lib/itsm-api'
import type { TimelineEntry } from '@/lib/itsm-types'
import { IncidentStatusBadge, PriorityBadge, SlaBadge } from '../_components/badges'
import { duration, humanize, IMPACT_LABEL, relative, STATUS_LABEL, URGENCY_LABEL, when } from '../_components/format'
import NextStep from './next-step-client'
import HeaderActions from './header-actions-client'
import Composer from './composer-form'
import Related from './related-client'

const ESCALATION_LABEL = ['', 'Team lead', 'System administrator', 'IT manager']

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { employee } = await requireEmployee()
  const [incidentRes, roles] = await Promise.all([getIncident(id), getItsmRoles()])

  if (isItsmError(incidentRes)) {
    if (incidentRes.status === 404) notFound()
    return (
      <Page>
        <PageHeader title="Incident" eyebrow={<BackLink href="/incidents" label="My incidents" />} />
        <EmptyState
          tone="error"
          title={incidentRes.status === 403 ? 'This incident isn’t yours to see' : 'Incident unavailable'}
          description={
            incidentRes.status === 403
              ? 'Only the person who reported it, the technician working it and the service desk can open it.'
              : `${incidentRes.error}. Try again in a minute.`
          }
        />
      </Page>
    )
  }

  const incident = incidentRes.data
  const actions = incident.actions ?? []
  const isReporter = incident.reporter?.employeeId === employee.id
  const isAssignee = incident.assignee?.employeeId === employee.id
  const staff = roles.serviceDeskAdmin || isAssignee || (roles.technician && !isReporter)
  const canAssign = actions.includes('ASSIGN')

  const [timelineRes, suggestionsRes, recommendationsRes, settingsRes] = await Promise.all([
    getIncidentTimeline(id),
    staff ? getIncidentSuggestions(id) : Promise.resolve(null),
    canAssign ? getRecommendations(id) : Promise.resolve(null),
    canAssign ? getAssignmentSettings() : Promise.resolve(null),
  ])
  const timeline = timelineRes && !isItsmError(timelineRes) ? timelineRes.data : []
  const suggestions = suggestionsRes && !isItsmError(suggestionsRes) ? suggestionsRes.data : null
  const recommendations = recommendationsRes && !isItsmError(recommendationsRes) ? recommendationsRes.data : []
  const settings = settingsRes && !isItsmError(settingsRes) ? settingsRes.data : null
  const strategyLabel =
    settings?.strategies?.find((s) => s.key === settings.defaultStrategyKey)?.label ?? settings?.defaultStrategyKey ?? null

  const lastQuestion = [...timeline].reverse().find((e) => e.kind === 'NOTE' && e.noteKind === 'INFO_REQUEST')
  const back = isReporter && !roles.serviceDeskAdmin
    ? { href: '/incidents', label: 'My incidents' }
    : roles.serviceDeskAdmin
      ? { href: '/incidents/all', label: 'All incidents' }
      : roles.technician
        ? { href: '/incidents/queue', label: 'My work' }
        : { href: '/incidents', label: 'My incidents' }
  const open = incident.status !== 'CLOSED' && incident.status !== 'CANCELLED'
  // Before anyone responds, a missed response deadline is the headline; after that, resolution.
  const headlineSla =
    !incident.firstResponseAt && incident.sla?.responseStatus === 'BREACHED' ? 'BREACHED' : incident.sla?.resolutionStatus

  return (
    <Page>
      <PageHeader
        eyebrow={<BackLink href={back.href} label={back.label} />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{incident.reference}</span>
            <IncidentStatusBadge status={incident.status} />
            <PriorityBadge priority={incident.priority} />
            {open && <SlaBadge status={headlineSla} risk={incident.slaRisk} />}
            {(incident.escalationLevel ?? 0) > 0 && open && (
              <Badge tone="negative">Escalated: {ESCALATION_LABEL[incident.escalationLevel ?? 0]}</Badge>
            )}
          </span>
        }
        subtitle={incident.title}
        actions={
          <HeaderActions
            incidentId={id}
            actions={actions}
            reference={incident.reference ?? ''}
            hasAssignee={Boolean(incident.assignee)}
            recommendations={recommendations}
            strategyLabel={strategyLabel}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <NextStep
            incidentId={id}
            status={incident.status!}
            actions={actions}
            viewer={{ isReporter, isAssignee, isAdmin: roles.serviceDeskAdmin }}
            assigneeName={incident.assignee?.displayName ?? null}
            reporterName={incident.reporter?.displayName ?? null}
            resolutionNote={incident.resolutionNote ?? null}
            awaitingReporter={incident.awaitingReporter === true}
            question={lastQuestion ? { body: lastQuestion.body ?? '', by: lastQuestion.actorName ?? 'The technician' } : null}
            resolutionDue={incident.sla?.resolutionDueAt ?? null}
            cancellationReason={incident.cancellationReason ?? null}
            feedback={incident.feedback ?? null}
            recommendations={recommendations}
            strategyLabel={strategyLabel}
          />

          <Panel title="What was reported">
            <p className="whitespace-pre-wrap break-words text-body text-fg">{incident.description}</p>
            <dl className="mt-5 grid gap-x-8 gap-y-3 text-body sm:grid-cols-2">
              <Detail label="Service" value={incident.service?.name} />
              <Detail label="Category" value={incident.category?.name} />
              <Detail label="Impact" value={incident.impact ? IMPACT_LABEL[incident.impact] : null} />
              <Detail label="Urgency" value={incident.urgency ? URGENCY_LABEL[incident.urgency] : null} />
              <Detail label="People affected" value={String(incident.affectedUsers ?? 1)} />
              <Detail label="Business criticality" value={humanize(incident.businessCriticality)} />
              <Detail label="Reported by" value={incident.reporter?.displayName} />
              <Detail label="Reported" value={when(incident.createdAt)} />
            </dl>
            {incident.priorityAssessment?.explanation && (
              <div className="mt-5 rounded-md bg-sunken px-4 py-3">
                <p className="text-label font-medium text-fg-muted">Why {incident.priority}?</p>
                <p className="mt-1 text-body text-fg">{incident.priorityAssessment.explanation}</p>
              </div>
            )}
          </Panel>

          <Panel title="Activity" description={staff ? 'Internal notes are only visible to the service desk.' : undefined}>
            <Timeline entries={timeline} />
            {(actions.includes('ADD_NOTE') || actions.includes('RESPOND')) && (
              <div className="mt-6 border-t border-line pt-5">
                <Composer incidentId={id} actions={actions} isReporter={isReporter} />
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Service level">
            <dl className="space-y-3 text-body">
              <Detail label="Assigned to" value={incident.assignee?.displayName ?? 'Nobody yet'} />
              <Detail
                label="First response"
                value={
                  incident.firstResponseAt
                    ? `${when(incident.firstResponseAt)}${incident.sla?.responseStatus === 'BREACHED' ? ' (late)' : ''}`
                    : incident.sla?.responseDueAt
                      ? `Due ${when(incident.sla.responseDueAt)} (${relative(incident.sla.responseDueAt)})`
                      : null
                }
              />
              <Detail
                label="Resolution"
                value={
                  incident.resolvedAt
                    ? `${when(incident.resolvedAt)}${incident.sla?.resolutionStatus === 'BREACHED' ? ' (late)' : ''}`
                    : incident.sla?.resolutionDueAt
                      ? `Due ${when(incident.sla.resolutionDueAt)} (${relative(incident.sla.resolutionDueAt)})`
                      : null
                }
              />
              {open && incident.slaRisk && (
                <Detail
                  label="Breach risk"
                  value={`${humanize(incident.slaRisk)}, from how long similar incidents have taken`}
                />
              )}
              {(incident.escalationLevel ?? 0) > 0 && (
                <Detail label="Escalated to" value={ESCALATION_LABEL[incident.escalationLevel ?? 0]} />
              )}
              {incident.sla?.startedAt && incident.resolvedAt && (
                <Detail
                  label="Time to resolve"
                  value={duration((new Date(incident.resolvedAt).getTime() - new Date(incident.sla.startedAt).getTime()) / 60000)}
                />
              )}
            </dl>
          </Panel>

          <Related
            incidentId={id}
            reference={incident.reference ?? ''}
            canLink={actions.includes('LINK')}
            canOpenOthers={staff}
            links={incident.links ?? []}
            suggestions={suggestions}
          />

          {roles.serviceDeskAdmin && (
            <p className="px-1 text-label text-fg-muted">
              <Link href={`/incidents/audit?incidentId=${id}`} className="underline decoration-line-strong underline-offset-2">
                Audit trail for {incident.reference}
              </Link>
            </p>
          )}
        </div>
      </div>
    </Page>
  )
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      {label}
    </Link>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{value || '—'}</dd>
    </div>
  )
}

const NOTE_LABEL: Record<string, string> = {
  INVESTIGATION: 'Update',
  INTERNAL: 'Internal note',
  INFO_REQUEST: 'Asked the reporter',
  INFO_RESPONSE: 'Reporter replied',
  RESOLUTION: 'Resolution',
}

// The service records these on routine moves; they repeat the status, so the feed leaves them out
// and keeps the reasons people actually wrote (a cancellation, a fix sent back).
const SYSTEM_REASONS = new Set(['classified', 'assigned', 'acknowledged', 'started work on', 'resolved', 'verified', 'closed'])

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return <EmptyState compact title="No activity yet" />
  return (
    <ol className="space-y-4 border-l-2 border-line pl-5">
      {entries.map((e, n) => (
        <li key={e.id ?? n} className="relative">
          <span aria-hidden="true" className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-line-strong" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-fg-muted">
            <span className="font-medium text-fg">{e.actorName || 'Spotlight'}</span>
            <span>{when(e.occurredAt)}</span>
            {e.kind === 'NOTE' && e.noteKind && (
              <Badge tone={e.noteKind === 'INFO_REQUEST' ? 'attention' : 'neutral'}>{NOTE_LABEL[e.noteKind] ?? humanize(e.noteKind)}</Badge>
            )}
            {e.kind === 'ESCALATION' && <Badge tone="negative">Escalation</Badge>}
            {e.kind === 'FEEDBACK' && <Badge tone="positive">Feedback</Badge>}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-body text-fg">
            {e.kind === 'TRANSITION' ? (
              <>
                {e.toStatus ? STATUS_LABEL[e.toStatus] : 'Updated'}
                {e.body && !SYSTEM_REASONS.has(e.body) ? <span className="text-fg-muted"> · {e.body}</span> : null}
              </>
            ) : (
              e.body
            )}
          </p>
        </li>
      ))}
    </ol>
  )
}
