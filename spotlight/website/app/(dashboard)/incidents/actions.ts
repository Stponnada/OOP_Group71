'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentEmployee } from '@/lib/current-employee'
import {
  addNote,
  assignIncident,
  categorise,
  createCategory,
  createService,
  findSimilar,
  isItsmError,
  leaveFeedback,
  linkIncident,
  removeTechnician,
  saveTechnician,
  setDefaultStrategy,
  transitionIncident,
  updateCategory,
  updateService,
  updateSlaProfile,
  type ItsmError,
} from '@/lib/itsm-api'
import type {
  CategorisationSuggestion,
  CategoryWrite,
  IncidentStatus,
  ServiceWrite,
  SimilarIncident,
  SlaProfileUpdate,
  TechnicianUpdate,
} from '@/lib/itsm-types'

// Every incident and service-desk change goes through the ITSM service, which decides whether
// the caller may make it. These actions only translate the result for the UI and refresh the
// pages that show it.

export type ActionResult = { ok: true } | { error: string }

const fail = (res: ItsmError): ActionResult => ({ error: res.error })

function refresh() {
  revalidatePath('/incidents', 'layout')
}

async function done<T>(promise: Promise<{ data: T } | ItsmError>): Promise<ActionResult> {
  const res = await promise
  if (isItsmError(res)) return fail(res)
  refresh()
  return { ok: true }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

export async function moveIncident(
  id: string,
  to: IncidentStatus,
  details: { reason?: string; resolutionNote?: string } = {},
): Promise<ActionResult> {
  const reason = details.reason?.trim() || undefined
  const resolutionNote = details.resolutionNote?.trim() || undefined
  if (to === 'RESOLVED' && !resolutionNote) return { error: 'Say what fixed it, so the reporter and the next technician know.' }
  if ((to === 'CANCELLED' || to === 'IN_PROGRESS') && details.reason !== undefined && !reason) {
    return { error: 'Give a reason.' }
  }
  return done(transitionIncident(id, { to, reason, resolutionNote }))
}

/** A technician picks an unassigned incident up for themselves. */
export async function takeIncident(id: string): Promise<ActionResult> {
  const { employee } = await getCurrentEmployee()
  if (!employee) return { error: 'Not signed in' }
  return done(assignIncident(id, { technicianId: employee.id, reason: 'Taken from the unassigned queue' }))
}

/** Assign or reassign. No technician lets the configured strategy choose. */
export async function assignTo(id: string, technicianId: string | null, reason?: string): Promise<ActionResult> {
  return done(assignIncident(id, { technicianId, reason: reason?.trim() || undefined }))
}

export async function postNote(
  id: string,
  kind: 'INVESTIGATION' | 'INTERNAL' | 'INFO_REQUEST' | 'INFO_RESPONSE',
  body: string,
): Promise<ActionResult> {
  if (!body.trim()) return { error: 'Write something first.' }
  return done(addNote(id, kind, body.trim()))
}

export async function sendFeedback(id: string, rating: number, comment: string): Promise<ActionResult> {
  if (rating < 1 || rating > 5) return { error: 'Pick a rating from 1 to 5.' }
  return done(leaveFeedback(id, rating, comment.trim() || undefined))
}

export async function linkIncidents(
  id: string,
  relatedIncidentId: string,
  relation: 'DUPLICATE' | 'RELATED',
  cancelAsDuplicate: boolean,
): Promise<ActionResult> {
  return done(linkIncident(id, { relatedIncidentId, relation, cancelAsDuplicate }))
}

// ── Help while reporting (read-only) ────────────────────────────────────────

export async function similarReports(serviceId: string, title: string, description: string): Promise<SimilarIncident[]> {
  if (!serviceId || (title.trim().length < 3 && description.trim().length < 10)) return []
  const res = await findSimilar({ serviceId, title: title.slice(0, 200), description: description.slice(0, 4000) })
  return isItsmError(res) ? [] : res.data
}

export async function suggestClassification(description: string): Promise<CategorisationSuggestion | null> {
  if (description.trim().length < 10) return null
  const res = await categorise(description.slice(0, 4000))
  return isItsmError(res) ? null : res.data
}

// ── Service-desk configuration ──────────────────────────────────────────────

export async function saveTechnicianProfile(employeeId: string, body: TechnicianUpdate): Promise<ActionResult> {
  return done(saveTechnician(employeeId, body))
}

export async function removeTechnicianProfile(employeeId: string): Promise<ActionResult> {
  return done(removeTechnician(employeeId))
}

export async function saveService(id: string | null, body: ServiceWrite): Promise<ActionResult> {
  return done(id ? updateService(id, body) : createService(body))
}

export async function saveCategory(id: string | null, body: CategoryWrite): Promise<ActionResult> {
  return done(id ? updateCategory(id, body) : createCategory(body))
}

export async function saveSlaProfile(id: string, body: SlaProfileUpdate): Promise<ActionResult> {
  return done(updateSlaProfile(id, body))
}

export async function chooseStrategy(key: string): Promise<ActionResult> {
  return done(setDefaultStrategy(key))
}
