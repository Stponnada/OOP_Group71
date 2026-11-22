/**
 * Minimal ITSM DTOs, copied from the frozen contract
 * `docs/openapi/itsm-api.yaml` (OpenAPI 3.1).
 *
 * Do NOT invent fields here — if the yaml gains a field, add it here in the
 * same commit that bumps the contract. Shapes below mirror
 * `#/components/schemas/*` exactly (optional = nullable/absent in the yaml).
 */

export type IncidentStatus =
  | 'NEW'
  | 'CLASSIFIED'
  | 'ASSIGNED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'VERIFIED'
  | 'CLOSED'
  | 'CANCELLED'

export type Priority = 'P1' | 'P2' | 'P3' | 'P4'
export type Impact = 'MINIMAL' | 'MINOR' | 'MAJOR' | 'EXTENSIVE'
export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type BusinessCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'REVENUE_OR_REGULATED'
export type SlaStatus = 'ON_TRACK' | 'WARNING' | 'BREACHED' | 'MET'
export type NoteKind = 'INVESTIGATION' | 'INFO_REQUEST' | 'INFO_RESPONSE' | 'RESOLUTION' | 'INTERNAL'

export type ErrorCode =
  | 'INVALID_TRANSITION'
  | 'UNAUTHORIZED_ACTION'
  | 'VALIDATION_FAILED'
  | 'INCIDENT_NOT_FOUND'
  | 'DUPLICATE_INCIDENT'
  | 'TECHNICIAN_UNAVAILABLE'
  | 'CAPACITY_EXCEEDED'
  | 'SLA_POLICY_MISSING'
  | 'DATA_CONFLICT'

/** RFC 7807 `application/problem+json` + stable `errorCode` (yaml `#/components/schemas/Problem`). */
export type ProblemDetail = {
  type: string
  title: string
  status: number
  detail?: string
  errorCode?: ErrorCode
  instance?: string
}

export type PriorityAssessment = {
  score?: number
  priority?: Priority
  factors?: Record<string, number>
  /** Human-readable working, shown as "why is this a P1?" in the UI. */
  explanation?: string
}

export type SlaWindow = {
  startedAt?: string
  responseDueAt?: string
  resolutionDueAt?: string
  warningPercent?: number
  responseStatus?: SlaStatus
  resolutionStatus?: SlaStatus
  resolutionRemainingMinutes?: number
}

export type Category = {
  id?: string
  code?: string
  name?: string
  sortOrder?: number
  isActive?: boolean
  description?: string | null
}

export type Service = {
  id?: string
  code?: string
  name?: string
  categoryId?: string
  businessCriticality?: BusinessCriticality
  slaProfileId?: string | null
  isActive?: boolean
  description?: string | null
  requiredSkillIds?: string[]
}

export type SlaTarget = {
  priority?: Priority
  responseMinutes?: number
  resolutionMinutes?: number
  warningPercent?: number
}

export type SlaProfile = {
  id?: string
  code?: string
  name?: string
  isActive?: boolean
  targets?: SlaTarget[]
}

export type TechnicianSkill = {
  skillId?: string
  name?: string
  proficiency?: number
}

export type Technician = {
  employeeId?: string
  displayName?: string
  isAvailable?: boolean
  activeIncidents?: number
  maxActiveIncidents?: number
  utilisationPercent?: number
  experienceYears?: number
  skills?: TechnicianSkill[]
  serviceIds?: string[]
  teamLeadId?: string | null
  teamLeadName?: string | null
}

export type Incident = {
  id?: string
  reference?: string
  title?: string
  description?: string
  status?: IncidentStatus
  category?: Category
  service?: Service
  impact?: Impact
  urgency?: Urgency
  businessCriticality?: BusinessCriticality
  affectedUsers?: number
  priority?: Priority
  priorityAssessment?: PriorityAssessment
  sla?: SlaWindow
  reporter?: { employeeId?: string; displayName?: string }
  assignee?: { employeeId?: string; displayName?: string } | null
  resolutionNote?: string | null
  duplicateOf?: { id?: string; reference?: string; similarity?: number } | null
  escalationLevel?: number
  createdAt?: string
  assignedAt?: string | null
  firstResponseAt?: string | null
  resolvedAt?: string | null
  verifiedAt?: string | null
  closedAt?: string | null
  /** Optimistic-lock token; send it back on updates. */
  version?: number
  cancellationReason?: string | null
  /** What the caller may do now. The UI renders exactly these, nothing else. */
  actions?: IncidentAction[]
  /** A technician asked the reporter something and the answer is outstanding. */
  awaitingReporter?: boolean
  slaRisk?: SlaRisk | null
  feedback?: { rating?: number; comment?: string | null; submittedAt?: string } | null
  links?: IncidentLink[]
}

export type IncidentSummary = {
  id?: string
  reference?: string
  title?: string
  status?: IncidentStatus
  priority?: Priority
  serviceName?: string
  assigneeName?: string | null
  slaStatus?: SlaStatus
  /** The next deadline: response until someone first responds, then resolution. */
  dueAt?: string | null
  createdAt?: string
  reporterName?: string
  categoryName?: string | null
  slaRisk?: SlaRisk | null
  awaitingReporter?: boolean
}

export type IncidentPage = {
  content?: IncidentSummary[]
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
}

export type CreateIncidentRequest = {
  title: string
  description: string
  categoryId: string
  serviceId: string
  impact: Impact
  urgency: Urgency
  affectedUsers?: number
  securityIncident?: boolean
  attachmentIds?: string[]
  /** Set when the reporter confirms a duplicate from the suggestion prompt. */
  relatedIncidentId?: string | null
}

export type TransitionRequest = {
  to: IncidentStatus
  /** Required for cancel and for rejecting a resolution. */
  reason?: string
  /** Required when moving to RESOLVED. */
  resolutionNote?: string
  /** Optimistic-lock guard. */
  expectedVersion?: number
}

export type TimelineEntry = {
  id?: string
  kind?: 'TRANSITION' | 'NOTE' | 'ATTACHMENT' | 'ESCALATION' | 'FEEDBACK'
  actorName?: string | null
  fromStatus?: IncidentStatus
  toStatus?: IncidentStatus
  body?: string | null
  noteKind?: NoteKind | null
  occurredAt?: string
}

export type Suggestion = {
  incidentId?: string
  reference?: string
  title?: string
  similarity?: number
  relation?: 'DUPLICATE' | 'RELATED' | 'RESOLUTION'
}

export type Suggestions = {
  duplicates?: Suggestion[]
  related?: Suggestion[]
  priorResolutions?: {
    incidentId?: string
    reference?: string
    resolutionNote?: string
    similarity?: number
  }[]
}

// ── Service desk (contract 0.2.0) ─────────────────────────────────────────

export type IncidentAction =
  | 'ACKNOWLEDGE'
  | 'START_WORK'
  | 'RESOLVE'
  | 'VERIFY'
  | 'REJECT_RESOLUTION'
  | 'CLOSE'
  | 'CANCEL'
  | 'ASSIGN'
  | 'TAKE'
  | 'ADD_NOTE'
  | 'REQUEST_INFO'
  | 'RESPOND'
  | 'FEEDBACK'
  | 'LINK'

export type SlaRisk = 'LOW' | 'MEDIUM' | 'HIGH'

export type IncidentLink = {
  incidentId?: string
  reference?: string
  title?: string
  status?: IncidentStatus
  relation?: 'DUPLICATE' | 'RELATED' | 'PARENT' | 'CHILD'
  similarity?: number
}

/** `GET /api/v1/me`: the caller's ITSM roles, which decide the IT Service navigation. */
export type Me = {
  employeeId?: string
  displayName?: string
  technician?: boolean
  serviceDeskAdmin?: boolean
  departments?: string[]
}

export type SimilarIncident = {
  incidentId?: string
  reference?: string
  title?: string
  status?: IncidentStatus
  similarity?: number
  createdAt?: string
}

export type TechnicianRecommendation = {
  employeeId?: string
  displayName?: string
  score?: number
  isAvailable?: boolean
  activeIncidents?: number
  maxActiveIncidents?: number
  experienceYears?: number
  skillMatch?: number
  knowsService?: boolean
  pickedBy?: string[]
  reasons?: string[]
}

export type Skill = { id?: string; code?: string; name?: string }

export type CategorisationSuggestion = {
  categoryId?: string | null
  categoryName?: string | null
  serviceId?: string | null
  serviceName?: string | null
  impact?: Impact | null
  urgency?: Urgency | null
  confidence?: number
  matchedTerms?: string[]
}

export type AssignmentSettings = {
  defaultStrategyKey?: string
  strategies?: { key?: string; label?: string }[]
}

export type ServiceWrite = {
  code?: string
  name: string
  description?: string | null
  categoryId: string
  businessCriticality: BusinessCriticality
  slaProfileId?: string | null
  isActive?: boolean
  requiredSkillIds?: string[]
}

export type CategoryWrite = {
  code?: string
  name: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}

export type TechnicianUpdate = {
  isAvailable?: boolean
  maxActiveIncidents?: number
  experienceYears?: number
  skills?: { skillId: string; proficiency: number }[]
  serviceIds?: string[]
  /** Replaced on every update: leave it out to clear the team lead. */
  teamLeadId?: string | null
}

export type SlaProfileUpdate = {
  name?: string
  isActive?: boolean
  targets?: { priority: Priority; responseMinutes: number; resolutionMinutes: number; warningPercent?: number }[]
}

export type OverviewReport = {
  totalIncidents?: number
  openIncidents?: number
  criticalIncidents?: number
  resolvedIncidents?: number
  slaViolations?: number
  slaCompliancePercent?: number
  averageResolutionMinutes?: number
}

export type WorkloadRow = {
  employeeId?: string
  displayName?: string
  activeIncidents?: number
  resolvedIncidents?: number
  utilisationPercent?: number
  isAvailable?: boolean
}

export type ServiceReportRow = {
  serviceId?: string
  name?: string
  businessCriticality?: BusinessCriticality
  incidents?: number
  p1Incidents?: number
  slaViolations?: number
  averageResolutionMinutes?: number
}

export type SlaReportRow = {
  priority?: Priority
  incidents?: number
  responseMet?: number
  resolutionMet?: number
  compliancePercent?: number
}

export type TrendPoint = { day?: string; created?: number; resolved?: number; breached?: number }

export type CategoryReportRow = {
  categoryId?: string
  name?: string
  incidents?: number
  openIncidents?: number
  slaViolations?: number
}

export type EscalationRow = {
  id?: string
  incidentId?: string
  reference?: string
  title?: string
  priority?: Priority
  level?: number
  reason?: string
  fromName?: string | null
  toName?: string | null
  createdAt?: string
}

export type AuditEntry = {
  id?: string
  incidentId?: string | null
  incidentReference?: string | null
  /** What changed, in words: "INC-2026-000004", "Service: VPN", "Assignment settings". */
  subject?: string
  actorName?: string | null
  action?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  occurredAt?: string
}
