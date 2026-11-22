import Link from 'next/link'
import { buttonClass, EmptyState, Input, Page, PageHeader, Panel, Select, StatTile, StatTiles } from '@/components/ui'
import { getItsmRoles } from '@/lib/itsm-roles'
import { getOverview, isItsmError, listCategories, listIncidents, listServices, listTechnicians, type IncidentFilters } from '@/lib/itsm-api'
import type { IncidentStatus } from '@/lib/itsm-types'
import { IncidentTable } from '../_components/incident-table'
import { AutoAssignButton } from '../_components/row-actions-client'
import { STATUS_LABEL } from '../_components/format'

// The service desk's view of everything. Filters are plain query parameters, so every view is a
// link that can be bookmarked or shared, and the page needs no client state.

type Params = Record<string, string | string[] | undefined>

const QUICK_VIEWS: { label: string; params: Record<string, string> }[] = [
  { label: 'Open', params: { open: '1' } },
  { label: 'Unassigned', params: { unassigned: '1' } },
  { label: 'Breached', params: { breached: '1', open: '1' } },
  { label: 'P1 open', params: { priority: 'P1', open: '1' } },
  { label: 'Waiting for a fix check', params: { status: 'RESOLVED' } },
  { label: 'Everything', params: { all: '1' } },
]

const PAGE_SIZE = 25

/** A yyyy-mm-dd from a date input, read as India time, as the UTC instant the API expects. */
function istDay(date: string | undefined, time: string): string | undefined {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined
  return new Date(`${date}T${time}+05:30`).toISOString()
}

export default async function AllIncidentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const roles = await getItsmRoles()
  if (!roles.serviceDeskAdmin) {
    return (
      <Page>
        <PageHeader title="All incidents" />
        <EmptyState
          title="This view is for the service desk"
          description="It lists every incident in the company. Incidents you reported are under My incidents."
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
  const one = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
  }
  const isQuick = Object.keys(sp).filter((k) => k !== 'page').length === 0
  const filters: IncidentFilters = {
    q: one('q'),
    status: one('status') as IncidentStatus | undefined,
    priority: one('priority'),
    categoryId: one('categoryId'),
    serviceId: one('serviceId'),
    technicianId: one('technicianId'),
    createdFrom: istDay(one('from'), '00:00:00'),
    createdTo: istDay(one('to'), '23:59:59'),
    breachedOnly: one('breached') === '1' || undefined,
    unassignedOnly: one('unassigned') === '1' || undefined,
    // With no filters at all, start on the open incidents: that is what the desk works from.
    openOnly: one('open') === '1' || isQuick || undefined,
    sort: (one('sort') as IncidentFilters['sort']) ?? 'due',
    page: Math.max(0, Number(one('page') ?? 1) - 1),
    size: PAGE_SIZE,
  }

  const [res, overviewRes, categoriesRes, servicesRes, techRes] = await Promise.all([
    listIncidents(filters),
    getOverview(),
    listCategories(true),
    listServices(true),
    listTechnicians(),
  ])
  const categories = isItsmError(categoriesRes) ? [] : categoriesRes.data
  const services = isItsmError(servicesRes) ? [] : servicesRes.data
  const technicians = isItsmError(techRes) ? [] : techRes.data
  const overview = isItsmError(overviewRes) ? null : overviewRes.data
  const page = isItsmError(res) ? null : res.data
  const items = page?.content ?? []
  const current = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]])),
  )
  const pageHref = (n: number) => {
    const q = new URLSearchParams(current)
    q.set('page', String(n))
    return `/incidents/all?${q}`
  }
  const pageNo = (filters.page ?? 0) + 1
  const activeFilters = ['q', 'status', 'priority', 'categoryId', 'serviceId', 'technicianId', 'from', 'to', 'unassigned', 'breached'].filter(
    (k) => one(k),
  ).length
  const activeQuick = QUICK_VIEWS.find((v) => {
    const keys = [...current.keys()].filter((k) => k !== 'page')
    if (isQuick) return v.label === 'Open'
    return keys.length === Object.keys(v.params).length && Object.entries(v.params).every(([k, val]) => current.get(k) === val)
  })

  return (
    <Page>
      <PageHeader title="All incidents" subtitle="Every incident in the company. Filter, then open one to assign or act on it." />

      {overview && (
        <StatTiles>
          <StatTile label="Open" value={overview.openIncidents ?? 0} />
          <StatTile label="Open P1" value={overview.criticalIncidents ?? 0} />
          <StatTile label="Incidents that breached" value={overview.slaViolations ?? 0} />
          <StatTile label="Resolved within SLA" value={overview.resolvedIncidents ? `${overview.slaCompliancePercent ?? 0}%` : '—'} />
        </StatTiles>
      )}

      <nav aria-label="Quick views" className="flex flex-wrap gap-2">
        {QUICK_VIEWS.map((v) => (
          <Link
            key={v.label}
            href={`/incidents/all?${new URLSearchParams(v.params)}`}
            aria-current={activeQuick?.label === v.label ? 'page' : undefined}
            className={buttonClass({ variant: activeQuick?.label === v.label ? 'primary' : 'secondary', size: 'sm' })}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <details open={activeFilters > 0 && !activeQuick} className="group rounded-md border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-body font-medium text-fg">
          <span>
            Filters
            {activeFilters > 0 && <span className="ml-2 text-label font-normal text-fg-muted">{activeFilters} applied</span>}
          </span>
          <span className="text-label font-normal text-fg-muted group-open:hidden">Show</span>
          <span className="hidden text-label font-normal text-fg-muted group-open:inline">Hide</span>
        </summary>
        <form method="get" action="/incidents/all" className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="text-label text-fg-muted">Search</span>
            <Input name="q" defaultValue={one('q')} placeholder="Reference, title or description" />
          </label>
          <FilterSelect name="status" label="Status" value={one('status')} options={Object.entries(STATUS_LABEL).map(([v, l]) => [v, l])} />
          <FilterSelect name="priority" label="Priority" value={one('priority')} options={['P1', 'P2', 'P3', 'P4'].map((p) => [p, p])} />
          <FilterSelect name="categoryId" label="Category" value={one('categoryId')} options={categories.map((c) => [c.id!, c.name!])} />
          <FilterSelect name="serviceId" label="Service" value={one('serviceId')} options={services.map((s) => [s.id!, s.name!])} />
          <FilterSelect
            name="technicianId"
            label="Technician"
            value={one('technicianId')}
            options={technicians.map((t) => [t.employeeId!, t.displayName!])}
          />
          <FilterSelect
            name="sort"
            label="Sort by"
            value={one('sort') ?? 'due'}
            includeAny={false}
            options={[
              ['due', 'Deadline, soonest first'],
              ['priority', 'Priority'],
              ['newest', 'Newest first'],
            ]}
          />
          <label>
            <span className="text-label text-fg-muted">Reported from</span>
            <Input type="date" name="from" defaultValue={one('from')} />
          </label>
          <label>
            <span className="text-label text-fg-muted">Reported to</span>
            <Input type="date" name="to" defaultValue={one('to')} />
          </label>
          <fieldset className="flex flex-wrap items-end gap-4 sm:col-span-2">
            <legend className="sr-only">Only show</legend>
            <Check name="open" label="Open only" checked={one('open') === '1' || isQuick} />
            <Check name="unassigned" label="Unassigned" checked={one('unassigned') === '1'} />
            <Check name="breached" label="SLA breached" checked={one('breached') === '1'} />
          </fieldset>
          <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-4">
            <Link href="/incidents/all?all=1" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
              Clear
            </Link>
            <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              Apply filters
            </button>
          </div>
        </form>
      </details>

      <Panel count={page?.totalElements}>
        {isItsmError(res) ? (
          <EmptyState tone="error" title="Incidents unavailable" description={`${res.error}. Try again in a minute.`} />
        ) : items.length === 0 ? (
          <EmptyState compact title="No incidents match" description="Loosen a filter or clear them." />
        ) : (
          <>
            <IncidentTable
              items={items}
              caption="Incidents"
              columns={['service', 'reporter', 'assignee', 'due']}
              rowAction={(i) => (!i.assigneeName && i.id && i.status !== 'CLOSED' && i.status !== 'CANCELLED' ? <AutoAssignButton incidentId={i.id} /> : null)}
            />
            {(page?.totalPages ?? 1) > 1 && (
              <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-label text-fg-muted">
                <span>
                  Page {pageNo} of {page?.totalPages} · {page?.totalElements} incidents
                </span>
                <span className="flex gap-2">
                  {pageNo > 1 && (
                    <Link href={pageHref(pageNo - 1)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                      Previous
                    </Link>
                  )}
                  {pageNo < (page?.totalPages ?? 1) && (
                    <Link href={pageHref(pageNo + 1)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                      Next
                    </Link>
                  )}
                </span>
              </nav>
            )}
          </>
        )}
      </Panel>
    </Page>
  )
}

function FilterSelect({
  name,
  label,
  value,
  options,
  includeAny = true,
}: {
  name: string
  label: string
  value?: string
  options: [string, string][]
  includeAny?: boolean
}) {
  return (
    <label>
      <span className="text-label text-fg-muted">{label}</span>
      <Select name={name} defaultValue={value ?? ''}>
        {includeAny && <option value="">Any</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </label>
  )
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-body text-fg">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="h-4 w-4 accent-action" />
      {label}
    </label>
  )
}
