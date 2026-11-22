import { z } from 'zod'
import { defineCapability, type AgentContext } from '../types'
import { whenLive } from '../modules'
import { fields } from '../preview'

// IT incidents live in the Java ITSM service, not in Supabase. Every tool below calls that
// service with the user's own Supabase JWT, so the service enforces exactly what its REST API
// allows for that caller (a reporter sees only their own incidents; assignment and lifecycle
// moves are validated server-side). Nothing here ever uses the service-role key.

// Same service URL as lib/itsm-api.ts, so the pages and Mariner always talk to the same backend.
const ITSM_BASE = process.env.ITSM_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8081'

// The same roles that decide the Service Desk sidebar section (`GET /api/v1/me`): a technician
// profile, or service-desk admin (superuser, or admin of the IT department). The service still
// checks every call; these gates only decide which tools Mariner is offered.
const isTechnician = (ctx: AgentContext) => ctx.profile.itsm?.technician === true
const isDeskAdmin = (ctx: AgentContext) => ctx.profile.itsm?.serviceDeskAdmin === true
const anyEmployee = whenLive('/incidents')
const supportStaff = whenLive('/incidents', (ctx: AgentContext) => isTechnician(ctx) || isDeskAdmin(ctx))
const deskAdmin = whenLive('/incidents/all', isDeskAdmin)

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

const impact = z.enum(['MINIMAL', 'MINOR', 'MAJOR', 'EXTENSIVE'])
const urgency = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const incidentStatus = z.enum([
  'NEW',
  'CLASSIFIED',
  'ASSIGNED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'VERIFIED',
  'CLOSED',
  'CANCELLED',
])

type Problem = { title?: string; detail?: string; errorCode?: string }
type Named = { id: string; name: string; code?: string }
type Technician = { employeeId: string; displayName: string; isAvailable: boolean; activeIncidents: number }
type Recommendation = {
  employeeId: string
  displayName: string
  score: number
  isAvailable: boolean
  activeIncidents: number
  maxActiveIncidents: number
  pickedBy?: string[]
  reasons?: string[]
}
type TimelineEntry = { kind: string; noteKind?: string | null; actorName?: string; body?: string; toStatus?: string; occurredAt: string }
type IncidentSummary = {
  id: string
  reference: string
  title: string
  status: string
  priority?: string
  serviceName?: string
  assigneeName?: string | null
  slaStatus?: string
  dueAt?: string | null
  createdAt: string
}
type IncidentPage = { content?: IncidentSummary[]; totalElements?: number }
type Categorisation = {
  categoryId?: string | null
  serviceId?: string | null
  impact?: z.infer<typeof impact>
  urgency?: z.infer<typeof urgency>
}

async function userJwt(ctx: AgentContext): Promise<string | null> {
  const { data } = await ctx.supabase.auth.getSession()
  return data.session?.access_token ?? null
}

type ItsmResult = { ok: true; body: unknown } | { ok: false; error: string; code?: string }

async function callItsm(ctx: AgentContext, path: string, init?: RequestInit): Promise<ItsmResult> {
  const token = await userJwt(ctx)
  if (!token) return { ok: false, error: 'Could not reach the incident service: your session has expired. Ask them to sign in again.' }
  let res: Response
  try {
    res = await fetch(`${ITSM_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    })
  } catch {
    return { ok: false, error: 'Could not reach the incident service. It may not be running.' }
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const p = (body ?? {}) as Problem
    const failure: ItsmResult = { ok: false, error: p.detail ?? p.title ?? `The incident service refused the request (${res.status}).` }
    if (p.errorCode) failure.code = p.errorCode
    return failure
  }
  return { ok: true, body }
}

const failed = (r: Extract<ItsmResult, { ok: false }>) => (r.code ? { error: r.error, code: r.code } : { error: r.error })

async function loadNamed(ctx: AgentContext, kind: 'categories' | 'services'): Promise<{ list: Named[] } | { error: string }> {
  const res = await callItsm(ctx, `/api/v1/catalog/${kind}`)
  if (!res.ok) return failed(res)
  const list = (res.body ?? []) as Named[]
  return { list }
}

function matchNamed(list: Named[], want: string): { id: string } | { ambiguous: string[] } | null {
  const w = want.trim().toLowerCase()
  const exact = list.filter((e) => e.name.toLowerCase() === w || (e.code ?? '').toLowerCase() === w)
  if (exact.length === 1) return { id: exact[0].id }
  if (exact.length > 1) return { ambiguous: exact.map((e) => e.name) }
  const partial = list.filter((e) => e.name.toLowerCase().includes(w) || (e.code ?? '').toLowerCase().includes(w))
  if (partial.length === 1) return { id: partial[0].id }
  if (partial.length > 1) return { ambiguous: partial.map((e) => e.name) }
  return null
}

async function suggestFromText(ctx: AgentContext, title: string, description: string): Promise<Categorisation | null> {
  const res = await callItsm(ctx, '/api/v1/catalog/categorise', {
    method: 'POST',
    body: JSON.stringify({ description: `${title}\n${description}` }),
  })
  if (!res.ok) return null
  return (res.body ?? {}) as Categorisation
}

async function lookupIncident(ctx: AgentContext, id: string): Promise<{ reference: string; title: string } | null> {
  const res = await callItsm(ctx, `/api/v1/incidents/${id}`)
  if (!res.ok) return null
  const inc = res.body as { reference?: string; title?: string }
  return inc.reference && inc.title ? { reference: inc.reference, title: inc.title } : null
}

const NOTE_KIND = { UPDATE: 'INVESTIGATION', INTERNAL: 'INTERNAL', QUESTION: 'INFO_REQUEST', REPLY: 'INFO_RESPONSE' } as const
const NOTE_TITLE = {
  UPDATE: 'Post an update',
  INTERNAL: 'Add an internal note',
  QUESTION: 'Ask the reporter',
  REPLY: 'Reply to the technician',
} as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** An incident id from its id or its INC- reference, searched within what the caller can see. */
async function resolveIncidentId(ctx: AgentContext, ref: string): Promise<{ id: string } | { error: string }> {
  const want = ref.trim()
  if (UUID_RE.test(want)) return { id: want }
  const res = await callItsm(ctx, `/api/v1/incidents?${new URLSearchParams({ q: want, size: '5' })}`)
  if (!res.ok) return failed(res)
  const hit = ((res.body ?? {}) as IncidentPage).content?.find((i) => i.reference.toLowerCase() === want.toLowerCase())
  return hit ? { id: hit.id } : { error: `No incident ${want} that this user can see.` }
}

const slim = (i: IncidentSummary) => ({
  id: i.id,
  reference: i.reference,
  title: i.title,
  status: i.status,
  priority: i.priority,
  service: i.serviceName,
  assignee: i.assigneeName,
  sla: i.slaStatus,
  dueAt: i.dueAt,
  createdAt: i.createdAt,
})

export const itsmCapabilities = [
  defineCapability({
    name: 'report_incident',
    module: 'IT incidents',
    risk: 'write',
    description: 'Reports an IT incident (outage, broken equipment, access problem) to the service desk.',
    skill:
      '`report_incident`: when something IT-related is broken or the user needs help from IT, offer to report it, or report it straight away if they ask. Write the title and description in their words plus what you learned. `category` and `service` are names (e.g. "Network", "Email"); leave them out if unsure and the service will suggest them from the description. Only pass `impact`/`urgency` when the user states them or they are obvious (many people affected, work stopped); otherwise they are derived. Afterwards, give them the incident reference so they can follow up.',
    input: z.object({
      title: z.string().min(3).max(200).describe('Short summary of the problem.'),
      description: z.string().min(1).max(4000).describe('What is broken, in plain words.'),
      category: z.string().max(100).optional().describe('Category name, e.g. Network. Omit when unsure.'),
      service: z.string().max(100).optional().describe('Affected service name, e.g. Email. Omit when unsure.'),
      impact: impact.optional().describe('How many people are affected. Omit unless stated or obvious.'),
      urgency: urgency.optional().describe('How time-critical it is. Omit unless stated or obvious.'),
      affectedUsers: z.number().int().min(0).default(1),
    }),
    allowed: anyEmployee,
    preview: (input, ctx) => ({
      kind: 'issue',
      title: 'Report IT incident',
      done: 'Incident reported',
      fields: fields(
        ['Title', clip(input.title, 120), true],
        ['Problem', clip(input.description, 400), true],
        ['Category', input.category],
        ['Service', input.service ?? ctx.currentPage],
        ['Impact', input.impact],
        ['Urgency', input.urgency],
        ['Affected users', input.affectedUsers]
      ),
    }),
    run: async (ctx, input) => {
      const { category, service } = input
      let { impact: imp, urgency: urg } = input
      const [cats, svcs] = await Promise.all([loadNamed(ctx, 'categories'), loadNamed(ctx, 'services')])
      if ('error' in cats) return { error: cats.error }
      if ('error' in svcs) return { error: svcs.error }
      const names = (l: Named[]) => l.map((e) => e.name).join(', ') || 'none set up yet'

      let categoryId: string | undefined
      if (category) {
        const m = matchNamed(cats.list, category)
        if (m === null) return { error: `No incident category matches "${category}". Available: ${names(cats.list)}.` }
        if ('ambiguous' in m) return { error: `"${category}" matches several categories (${m.ambiguous.join(', ')}). Ask which one.` }
        categoryId = m.id
      }
      let serviceId: string | undefined
      if (service) {
        const m = matchNamed(svcs.list, service)
        if (m === null) return { error: `No service matches "${service}". Available: ${names(svcs.list)}.` }
        if ('ambiguous' in m) return { error: `"${service}" matches several services (${m.ambiguous.join(', ')}). Ask which one.` }
        serviceId = m.id
      }
      if (!categoryId || !serviceId || !imp || !urg) {
        const s = await suggestFromText(ctx, input.title, input.description)
        categoryId ??= s?.categoryId ?? undefined
        serviceId ??= s?.serviceId ?? undefined
        imp ??= s?.impact
        urg ??= s?.urgency
      }
      if (!categoryId) return { error: `Could not tell which category this is. Available: ${names(cats.list)}. Ask the user.` }
      if (!serviceId) return { error: `Could not tell which service is affected. Available: ${names(svcs.list)}. Ask the user.` }
      const res = await callItsm(ctx, '/api/v1/incidents', {
        method: 'POST',
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          categoryId,
          serviceId,
          impact: imp ?? 'MINOR',
          urgency: urg ?? 'MEDIUM',
          affectedUsers: input.affectedUsers,
        }),
      })
      if (!res.ok) return failed(res)
      const inc = res.body as { id: string; reference: string; priority?: string; status: string }
      return { reported: true, id: inc.id, reference: inc.reference, priority: inc.priority, status: inc.status }
    },
  }),

  defineCapability({
    name: 'list_my_incidents',
    module: 'IT incidents',
    risk: 'read',
    description: "The IT incidents the user reported, newest first, with status and priority.",
    skill:
      '`list_my_incidents`: what the user has reported to IT and where each stands. Use it to find the incident they mean before anything else.',
    input: z.object({
      status: incidentStatus.optional().describe('Only incidents in this status.'),
      limit: z.number().int().min(1).max(30).default(10),
    }),
    allowed: anyEmployee,
    run: async (ctx, { status, limit }) => {
      const q = new URLSearchParams({ size: String(limit), reporterId: ctx.employeeId, sort: 'newest' })
      if (status) q.set('status', status)
      const res = await callItsm(ctx, `/api/v1/incidents?${q}`)
      if (!res.ok) return failed(res)
      const page = (res.body ?? {}) as IncidentPage
      return { incidents: (page.content ?? []).map(slim), total: page.totalElements }
    },
  }),

  defineCapability({
    name: 'list_incident_queue',
    module: 'IT incident queue',
    risk: 'read',
    description: "The service desk work queue: unassigned incidents and ones assigned to technicians.",
    skill:
      '`list_incident_queue`: the service-desk queue, for technicians and admins. Defaults to your own work plus unassigned, most urgent first. Take the `id` from here for `assign_incident` and `update_incident_status`.',
    input: z.object({
      mineOnly: z.boolean().default(true).describe('Only incidents assigned to the caller (plus unassigned when included).'),
      includeUnassigned: z.boolean().default(true),
      sort: z.enum(['priority', 'due', 'newest']).default('due'),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    allowed: supportStaff,
    run: async (ctx, { mineOnly, includeUnassigned, sort, limit }) => {
      const q = new URLSearchParams({
        mineOnly: String(mineOnly),
        includeUnassigned: String(includeUnassigned),
        sort,
        size: String(limit),
      })
      const res = await callItsm(ctx, `/api/v1/queue?${q}`)
      if (!res.ok) return failed(res)
      const page = (res.body ?? {}) as IncidentPage
      return { incidents: (page.content ?? []).map(slim), total: page.totalElements }
    },
  }),

  defineCapability({
    name: 'assign_incident',
    module: 'IT incident queue',
    risk: 'write',
    description: 'Assigns an IT incident to a technician, or lets the service pick one.',
    skill:
      '`assign_incident`: take the incident `id` from `list_incident_queue`. Pass a technician name to assign to them, or leave it out and the service picks by availability and skill. Reassigning does not reset the SLA clock. If the technician is unavailable or at capacity the service refuses: say so and suggest leaving it unassigned for auto-assignment.',
    input: z.object({
      incidentId: z.string().uuid(),
      technician: z.string().max(100).optional().describe('Technician name. Omit for automatic assignment.'),
      reason: z.string().max(500).default(''),
    }),
    allowed: supportStaff,
    preview: async ({ incidentId, technician, reason }, ctx) => {
      const cur = await lookupIncident(ctx, incidentId)
      return {
        kind: 'issue',
        title: 'Assign incident',
        done: 'Incident assigned',
        subject: cur ? `${cur.reference} · ${clip(cur.title, 80)}` : undefined,
        fields: fields(['Technician', technician ?? 'Automatic'], ['Reason', reason]),
      }
    },
    run: async (ctx, { incidentId, technician, reason }) => {
      let technicianId: string | undefined
      if (technician) {
        const res = await callItsm(ctx, '/api/v1/technicians')
        if (!res.ok) return failed(res)
        const techs = (res.body ?? []) as Technician[]
        const w = technician.trim().toLowerCase()
        const hits = techs.filter((t) => t.displayName.toLowerCase() === w)
        const pool = hits.length > 0 ? hits : techs.filter((t) => t.displayName.toLowerCase().includes(w))
        if (pool.length === 0)
          return { error: `No technician matches "${technician}". Available: ${techs.map((t) => t.displayName).join(', ') || 'none'}.` }
        if (pool.length > 1) return { error: `"${technician}" matches several technicians (${pool.map((t) => t.displayName).join(', ')}). Ask which one.` }
        technicianId = pool[0].employeeId
      }
      const res = await callItsm(ctx, `/api/v1/incidents/${incidentId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ technicianId: technicianId ?? null, reason }),
      })
      if (!res.ok) return failed(res)
      const inc = res.body as { id: string; reference: string; status: string; assignee?: { displayName: string } | null }
      return { assigned: true, id: inc.id, reference: inc.reference, status: inc.status, assignee: inc.assignee?.displayName ?? null }
    },
  }),

  defineCapability({
    name: 'update_incident_status',
    module: 'IT incident queue',
    risk: 'write',
    description: 'Moves an IT incident to a new lifecycle status (acknowledge, start, resolve, verify, close, cancel).',
    skill:
      '`update_incident_status`: take the incident `id` from `list_my_incidents` or `list_incident_queue`. A reporter confirms a fix with VERIFIED, or sends it back with IN_PROGRESS and a `reason`. The service validates the move and who may make it: only the assigned technician can acknowledge, start and resolve; only the reporter (or an admin) can verify; anyone involved can cancel with a reason. Resolving needs a `resolutionNote` the reporter can read; cancelling and rejecting a resolution need a `reason`. An illegal move is refused: relay the refusal and the current status instead of retrying.',
    input: z.object({
      incidentId: z.string().uuid(),
      to: incidentStatus.describe('Target lifecycle status.'),
      reason: z.string().max(1000).default('').describe('Required when cancelling or rejecting a resolution.'),
      resolutionNote: z.string().max(4000).default('').describe('Required when resolving: what was done, for the reporter.'),
    }),
    allowed: anyEmployee,
    preview: async ({ incidentId, to, reason, resolutionNote }, ctx) => {
      const cur = await lookupIncident(ctx, incidentId)
      return {
        kind: 'issue',
        title: 'Update incident status',
        done: 'Incident status updated',
        subject: cur ? `${cur.reference} · ${clip(cur.title, 80)}` : undefined,
        fields: fields(['New status', to, true], ['Reason', reason], ['Resolution note', resolutionNote]),
      }
    },
    run: async (ctx, { incidentId, to, reason, resolutionNote }) => {
      const res = await callItsm(ctx, `/api/v1/incidents/${incidentId}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ to, reason, resolutionNote }),
      })
      if (!res.ok) return failed(res)
      const inc = res.body as { id: string; reference: string; status: string }
      return { updated: true, id: inc.id, reference: inc.reference, status: inc.status }
    },
  }),
  defineCapability({
    name: 'get_incident',
    module: 'IT incidents',
    risk: 'read',
    description: 'One IT incident in full: status, priority and why, SLA deadlines, who has it, recent activity and what the caller can do next.',
    skill:
      '`get_incident`: before acting on an incident, or when the user asks where one stands. Pass its `id` or its reference (INC-…). `actions` lists what this user may do now; only offer those. The service hides internal notes from reporters.',
    input: z.object({
      incident: z.string().min(3).max(60).describe('The incident id, or its reference such as INC-2026-000004.'),
    }),
    allowed: anyEmployee,
    run: async (ctx, { incident }) => {
      const id = await resolveIncidentId(ctx, incident)
      if ('error' in id) return id
      const [inc, tl] = await Promise.all([
        callItsm(ctx, `/api/v1/incidents/${id.id}`),
        callItsm(ctx, `/api/v1/incidents/${id.id}/timeline`),
      ])
      if (!inc.ok) return failed(inc)
      const i = inc.body as Record<string, unknown> & {
        reporter?: { displayName?: string }
        assignee?: { displayName?: string } | null
        service?: { name?: string }
        category?: { name?: string }
        sla?: Record<string, unknown>
        priorityAssessment?: { explanation?: string }
      }
      const timeline = tl.ok ? ((tl.body ?? []) as TimelineEntry[]) : []
      return {
        id: i.id,
        reference: i.reference,
        title: i.title,
        description: clip(String(i.description ?? ''), 1200),
        status: i.status,
        priority: i.priority,
        whyThisPriority: i.priorityAssessment?.explanation,
        service: i.service?.name,
        category: i.category?.name,
        reporter: i.reporter?.displayName,
        assignee: i.assignee?.displayName ?? null,
        sla: i.sla,
        slaRisk: i.slaRisk,
        escalationLevel: i.escalationLevel,
        awaitingReporter: i.awaitingReporter,
        resolutionNote: i.resolutionNote,
        actions: i.actions,
        links: i.links,
        recentActivity: timeline.slice(-8).map((e) => ({
          when: e.occurredAt,
          who: e.actorName,
          kind: e.noteKind ?? e.kind,
          text: e.kind === 'TRANSITION' ? `→ ${e.toStatus}${e.body ? `: ${clip(e.body, 200)}` : ''}` : clip(e.body ?? '', 300),
        })),
      }
    },
  }),

  defineCapability({
    name: 'add_incident_note',
    module: 'IT incidents',
    risk: 'write',
    description: 'Writes on an IT incident: an update for the reporter, an internal note, a question for the reporter, or the reporter’s reply.',
    skill:
      '`add_incident_note`: `kind` is UPDATE (technician, visible to the reporter), INTERNAL (service desk only), QUESTION (asks the reporter for information and notifies them) or REPLY (the reporter answering a question or adding detail). Check `actions` from `get_incident` first: QUESTION needs REQUEST_INFO, REPLY needs RESPOND, the rest need ADD_NOTE.',
    input: z.object({
      incidentId: z.string().uuid(),
      kind: z.enum(['UPDATE', 'INTERNAL', 'QUESTION', 'REPLY']),
      body: z.string().min(1).max(4000),
    }),
    allowed: anyEmployee,
    preview: async ({ incidentId, kind, body }, ctx) => {
      const cur = await lookupIncident(ctx, incidentId)
      return {
        kind: 'issue',
        title: NOTE_TITLE[kind],
        done: 'Posted',
        subject: cur ? `${cur.reference} · ${clip(cur.title, 80)}` : undefined,
        fields: fields(['Message', clip(body, 400), true]),
      }
    },
    run: async (ctx, { incidentId, kind, body }) => {
      const res = await callItsm(ctx, `/api/v1/incidents/${incidentId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ kind: NOTE_KIND[kind], body }),
      })
      if (!res.ok) return failed(res)
      return { posted: true }
    },
  }),

  defineCapability({
    name: 'leave_incident_feedback',
    module: 'IT incidents',
    risk: 'write',
    description: 'The reporter rates how a confirmed fix was handled, 1 to 5, with an optional comment.',
    skill:
      '`leave_incident_feedback`: after the user confirms a fix (status VERIFIED or CLOSED, `actions` includes FEEDBACK). Ask for the rating; never invent one.',
    input: z.object({
      incidentId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(2000).default(''),
    }),
    allowed: anyEmployee,
    preview: async ({ incidentId, rating, comment }, ctx) => {
      const cur = await lookupIncident(ctx, incidentId)
      return {
        kind: 'issue',
        title: 'Rate the fix',
        done: 'Feedback sent',
        subject: cur ? `${cur.reference} · ${clip(cur.title, 80)}` : undefined,
        fields: fields(['Rating', `${rating} of 5`, true], ['Comment', comment]),
      }
    },
    run: async (ctx, { incidentId, rating, comment }) => {
      const res = await callItsm(ctx, `/api/v1/incidents/${incidentId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comment || undefined }),
      })
      if (!res.ok) return failed(res)
      return { sent: true }
    },
  }),

  defineCapability({
    name: 'recommend_technicians',
    module: 'IT incident queue',
    risk: 'read',
    description: 'Ranks the technicians for one incident by skills for its service, workload, experience and past work, with each strategy’s pick.',
    skill:
      '`recommend_technicians`: before assigning, to explain who fits and why. Give the top two or three with their reasons; mention anyone away or at their limit.',
    input: z.object({ incidentId: z.string().uuid() }),
    allowed: deskAdmin,
    run: async (ctx, { incidentId }) => {
      const res = await callItsm(ctx, `/api/v1/incidents/${incidentId}/recommendations`)
      if (!res.ok) return failed(res)
      const list = (res.body ?? []) as Recommendation[]
      return {
        technicians: list.slice(0, 6).map((r) => ({
          name: r.displayName,
          score: Math.round(r.score * 100) / 100,
          available: r.isAvailable,
          load: `${r.activeIncidents} of ${r.maxActiveIncidents}`,
          pickedBy: r.pickedBy,
          reasons: r.reasons,
        })),
      }
    },
  }),

  defineCapability({
    name: 'search_incidents',
    module: 'IT incident queue',
    risk: 'read',
    description: 'Searches every IT incident in the company with the service desk’s filters.',
    skill:
      '`search_incidents`: for the service desk ("open P1s", "breached this week", "unassigned network incidents"). Dates are yyyy-mm-dd, India time.',
    input: z.object({
      text: z.string().max(200).optional().describe('Words in the reference, title or description.'),
      status: incidentStatus.optional(),
      priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
      openOnly: z.boolean().default(true),
      unassignedOnly: z.boolean().default(false),
      breachedOnly: z.boolean().default(false),
      reportedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      reportedTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      sort: z.enum(['due', 'priority', 'newest']).default('due'),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    allowed: deskAdmin,
    run: async (ctx, input) => {
      const q = new URLSearchParams({ size: String(input.limit), sort: input.sort })
      if (input.text) q.set('q', input.text)
      if (input.status) q.set('status', input.status)
      if (input.priority) q.set('priority', input.priority)
      if (input.openOnly && !input.status) q.set('openOnly', 'true')
      if (input.unassignedOnly) q.set('unassignedOnly', 'true')
      if (input.breachedOnly) q.set('breachedOnly', 'true')
      if (input.reportedFrom) q.set('createdFrom', new Date(`${input.reportedFrom}T00:00:00+05:30`).toISOString())
      if (input.reportedTo) q.set('createdTo', new Date(`${input.reportedTo}T23:59:59+05:30`).toISOString())
      const res = await callItsm(ctx, `/api/v1/incidents?${q}`)
      if (!res.ok) return failed(res)
      const page = (res.body ?? {}) as IncidentPage
      return { incidents: (page.content ?? []).map(slim), total: page.totalElements }
    },
  }),

  defineCapability({
    name: 'service_desk_overview',
    module: 'IT incident queue',
    risk: 'read',
    description: 'How the service desk is doing: open and P1 counts, SLA compliance by priority, technician workload and recent escalations.',
    skill:
      '`service_desk_overview`: for "how are we doing", "who is overloaded", "what got escalated". Lead with what needs attention.',
    input: z.object({}),
    allowed: deskAdmin,
    run: async (ctx) => {
      const [overview, sla, workload, escalations] = await Promise.all([
        callItsm(ctx, '/api/v1/reports/overview'),
        callItsm(ctx, '/api/v1/reports/sla'),
        callItsm(ctx, '/api/v1/reports/workload'),
        callItsm(ctx, '/api/v1/reports/escalations?limit=5'),
      ])
      if (!overview.ok) return failed(overview)
      return {
        overview: overview.body,
        slaByPriority: sla.ok ? sla.body : null,
        workload: workload.ok ? workload.body : null,
        recentEscalations: escalations.ok ? escalations.body : null,
      }
    },
  }),
]
