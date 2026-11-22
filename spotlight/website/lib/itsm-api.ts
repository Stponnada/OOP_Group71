/**
 * Typed fetch client for the I-ITSM service.
 *
 * Frozen contract: `docs/openapi/itsm-api.yaml` (OpenAPI 3.1,
 * base `http://localhost:8081`, bearer Supabase JWT).
 *
 * Server-only: the Supabase session token is read via
 * `createClient()` from `@/lib/supabase/server`, so call this from Server
 * Components and `'use server'` actions only (same pattern as
 * `app/(dashboard)/issues/actions.ts`). Never import into a client component —
 * the JWT must not leak to the browser bundle beyond the Authorization header
 * the server already holds.
 */

import { createClient } from '@/lib/supabase/server'
import type {
  AssignmentSettings,
  AuditEntry,
  CategorisationSuggestion,
  Category,
  CategoryReportRow,
  CategoryWrite,
  CreateIncidentRequest,
  EscalationRow,
  Incident,
  IncidentPage,
  IncidentStatus,
  Me,
  NoteKind,
  OverviewReport,
  ProblemDetail,
  Service,
  ServiceReportRow,
  ServiceWrite,
  SimilarIncident,
  Skill,
  SlaProfile,
  SlaProfileUpdate,
  SlaReportRow,
  Suggestions,
  Technician,
  TechnicianRecommendation,
  TechnicianUpdate,
  TimelineEntry,
  TransitionRequest,
  TrendPoint,
  WorkloadRow,
} from './itsm-types'

export const ITSM_API_BASE =
  process.env.ITSM_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8081'

/** What the UI branches on: a readable message + the stable yaml `errorCode`. */
export type ItsmError = { error: string; errorCode?: string; status?: number }

export type ItsmResult<T> = { data: T } | ItsmError

export function isItsmError<T>(res: ItsmResult<T>): res is ItsmError {
  return 'error' in res
}

function toItsmError(status: number, problem: unknown, fallback: string): ItsmError {
  const p = (problem ?? {}) as Partial<ProblemDetail>
  return {
    error: p.detail || p.title || fallback,
    errorCode: p.errorCode,
    status,
  }
}

async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function itsmFetch<T>(path: string, init?: RequestInit): Promise<ItsmResult<T>> {
  const token = await getAccessToken()
  if (!token) return { error: 'Not signed in' }

  let res: Response
  try {
    res = await fetch(`${ITSM_API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    })
  } catch {
    // Service not running: callers render an EmptyState with this message.
    return { error: `ITSM service unreachable at ${ITSM_API_BASE}` }
  }

  if (res.status === 204) return { data: undefined as T }

  const contentType = res.headers.get('content-type') ?? ''
  const body = contentType.includes('json') ? await res.json().catch(() => null) : null

  if (!res.ok) return toItsmError(res.status, body, `Request failed (${res.status})`)
  return { data: body as T }
}

export type IncidentFilters = {
  page?: number
  size?: number
  q?: string
  status?: IncidentStatus
  priority?: string
  categoryId?: string
  serviceId?: string
  technicianId?: string
  reporterId?: string
  breachedOnly?: boolean
  openOnly?: boolean
  unassignedOnly?: boolean
  createdFrom?: string
  createdTo?: string
  sort?: 'newest' | 'due' | 'priority'
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// ── Incidents ─────────────────────────────────────────────────────────────

export function listIncidents(filters: IncidentFilters = {}): Promise<ItsmResult<IncidentPage>> {
  return itsmFetch<IncidentPage>(`/api/v1/incidents${toQuery(filters as Record<string, string | number | boolean | undefined>)}`)
}


export function createIncident(body: CreateIncidentRequest): Promise<ItsmResult<Incident>> {
  return itsmFetch<Incident>('/api/v1/incidents', { method: 'POST', body: JSON.stringify(body) })
}


export function getIncident(id: string): Promise<ItsmResult<Incident>> {
  return itsmFetch<Incident>(`/api/v1/incidents/${id}`)
}


export function getIncidentTimeline(id: string): Promise<ItsmResult<TimelineEntry[]>> {
  return itsmFetch<TimelineEntry[]>(`/api/v1/incidents/${id}/timeline`)
}


export function getIncidentSuggestions(id: string): Promise<ItsmResult<Suggestions>> {
  return itsmFetch<Suggestions>(`/api/v1/incidents/${id}/suggestions`)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

export function transitionIncident(id: string, body: TransitionRequest): Promise<ItsmResult<Incident>> {
  return itsmFetch<Incident>(`/api/v1/incidents/${id}/transitions`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ── Queue / catalog ───────────────────────────────────────────────────────

export function getQueue(
  params: { page?: number; size?: number; mineOnly?: boolean; includeUnassigned?: boolean; sort?: string } = {},
): Promise<ItsmResult<IncidentPage>> {
  return itsmFetch<IncidentPage>(`/api/v1/queue${toQuery(params as Record<string, string | number | boolean | undefined>)}`)
}


export function listTechnicians(availableOnly = false): Promise<ItsmResult<Technician[]>> {
  return itsmFetch<Technician[]>(`/api/v1/technicians${toQuery({ availableOnly })}`)
}

export function listServices(includeInactive = false): Promise<ItsmResult<Service[]>> {
  return itsmFetch<Service[]>(`/api/v1/catalog/services${toQuery({ includeInactive: includeInactive || undefined })}`)
}

export function listCategories(includeInactive = false): Promise<ItsmResult<Category[]>> {
  return itsmFetch<Category[]>(`/api/v1/catalog/categories${toQuery({ includeInactive: includeInactive || undefined })}`)
}

export function listSkills(): Promise<ItsmResult<Skill[]>> {
  return itsmFetch<Skill[]>('/api/v1/catalog/skills')
}

export function listSlaProfiles(): Promise<ItsmResult<SlaProfile[]>> {
  return itsmFetch<SlaProfile[]>('/api/v1/sla/profiles')
}

export function getAssignmentSettings(): Promise<ItsmResult<AssignmentSettings>> {
  return itsmFetch<AssignmentSettings>('/api/v1/settings/assignment')
}

export function categorise(description: string): Promise<ItsmResult<CategorisationSuggestion>> {
  return itsmFetch<CategorisationSuggestion>('/api/v1/catalog/categorise', {
    method: 'POST',
    body: JSON.stringify({ description }),
  })
}

// ── Identity ──────────────────────────────────────────────────────────────

/** The caller's ITSM roles. Technician and service-desk admin are decided by the service. */
export function getMe(): Promise<ItsmResult<Me>> {
  return itsmFetch<Me>('/api/v1/me')
}

// ── Working an incident ───────────────────────────────────────────────────

/** Reports that read like the one being written, checked before it is submitted. */
export function findSimilar(body: { serviceId: string; title?: string; description?: string }): Promise<ItsmResult<SimilarIncident[]>> {
  return itsmFetch<SimilarIncident[]>('/api/v1/incidents/similar', { method: 'POST', body: JSON.stringify(body) })
}

/** Assign, reassign or take. No technician id lets the configured strategy choose (admins only). */
export function assignIncident(
  id: string,
  body: { technicianId?: string | null; strategyKey?: string; reason?: string },
): Promise<ItsmResult<Incident>> {
  return itsmFetch<Incident>(`/api/v1/incidents/${id}/assign`, { method: 'POST', body: JSON.stringify(body) })
}

export function getRecommendations(id: string): Promise<ItsmResult<TechnicianRecommendation[]>> {
  return itsmFetch<TechnicianRecommendation[]>(`/api/v1/incidents/${id}/recommendations`)
}

export function addNote(id: string, kind: Exclude<NoteKind, 'RESOLUTION'>, body: string): Promise<ItsmResult<void>> {
  return itsmFetch<void>(`/api/v1/incidents/${id}/notes`, { method: 'POST', body: JSON.stringify({ kind, body }) })
}

export function leaveFeedback(id: string, rating: number, comment?: string): Promise<ItsmResult<void>> {
  return itsmFetch<void>(`/api/v1/incidents/${id}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  })
}

export function linkIncident(
  id: string,
  body: { relatedIncidentId: string; relation: 'DUPLICATE' | 'RELATED'; cancelAsDuplicate?: boolean },
): Promise<ItsmResult<Incident>> {
  return itsmFetch<Incident>(`/api/v1/incidents/${id}/links`, { method: 'POST', body: JSON.stringify(body) })
}

// ── Service-desk configuration (admins) ───────────────────────────────────

export function saveTechnician(employeeId: string, body: TechnicianUpdate): Promise<ItsmResult<Technician>> {
  return itsmFetch<Technician>(`/api/v1/technicians/${employeeId}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function removeTechnician(employeeId: string): Promise<ItsmResult<void>> {
  return itsmFetch<void>(`/api/v1/technicians/${employeeId}`, { method: 'DELETE' })
}

export function createService(body: ServiceWrite): Promise<ItsmResult<Service>> {
  return itsmFetch<Service>('/api/v1/catalog/services', { method: 'POST', body: JSON.stringify(body) })
}

export function updateService(id: string, body: ServiceWrite): Promise<ItsmResult<Service>> {
  return itsmFetch<Service>(`/api/v1/catalog/services/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function createCategory(body: CategoryWrite): Promise<ItsmResult<Category>> {
  return itsmFetch<Category>('/api/v1/catalog/categories', { method: 'POST', body: JSON.stringify(body) })
}

export function updateCategory(id: string, body: CategoryWrite): Promise<ItsmResult<Category>> {
  return itsmFetch<Category>(`/api/v1/catalog/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function updateSlaProfile(id: string, body: SlaProfileUpdate): Promise<ItsmResult<SlaProfile>> {
  return itsmFetch<SlaProfile>(`/api/v1/sla/profiles/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function setDefaultStrategy(defaultStrategyKey: string): Promise<ItsmResult<AssignmentSettings>> {
  return itsmFetch<AssignmentSettings>('/api/v1/settings/assignment', {
    method: 'PUT',
    body: JSON.stringify({ defaultStrategyKey }),
  })
}

// ── Reports (admins) ──────────────────────────────────────────────────────

export function getOverview(): Promise<ItsmResult<OverviewReport>> {
  return itsmFetch<OverviewReport>('/api/v1/reports/overview')
}

export function getWorkload(): Promise<ItsmResult<WorkloadRow[]>> {
  return itsmFetch<WorkloadRow[]>('/api/v1/reports/workload')
}

export function getServiceReport(): Promise<ItsmResult<ServiceReportRow[]>> {
  return itsmFetch<ServiceReportRow[]>('/api/v1/reports/services')
}

export function getSlaReport(): Promise<ItsmResult<SlaReportRow[]>> {
  return itsmFetch<SlaReportRow[]>('/api/v1/reports/sla')
}

export function getTrend(days = 14): Promise<ItsmResult<TrendPoint[]>> {
  return itsmFetch<TrendPoint[]>(`/api/v1/reports/trend${toQuery({ days })}`)
}

export function getCategoryReport(): Promise<ItsmResult<CategoryReportRow[]>> {
  return itsmFetch<CategoryReportRow[]>('/api/v1/reports/categories')
}

export function getEscalations(limit = 20): Promise<ItsmResult<EscalationRow[]>> {
  return itsmFetch<EscalationRow[]>(`/api/v1/reports/escalations${toQuery({ limit })}`)
}

export function getAudit(params: { incidentId?: string; limit?: number } = {}): Promise<ItsmResult<AuditEntry[]>> {
  return itsmFetch<AuditEntry[]>(`/api/v1/audit${toQuery(params)}`)
}
