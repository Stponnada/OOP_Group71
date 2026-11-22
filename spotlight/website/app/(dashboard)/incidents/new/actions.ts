'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/current-employee'
import { createIncident, isItsmError } from '@/lib/itsm-api'
import type { Impact, Urgency } from '@/lib/itsm-types'

type ActionResult = { error: string }

const IMPACTS: Impact[] = ['MINIMAL', 'MINOR', 'MAJOR', 'EXTENSIVE']
const URGENCIES: Urgency[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

// Anyone signed in can report an incident. Priority and the SLA are derived by the service
// (`POST /api/v1/incidents`); the form never sends them. Matching reports are linked there too.
export async function reportIncident(formData: FormData): Promise<ActionResult | void> {
  const { employee } = await getCurrentEmployee()
  if (!employee) return { error: 'Not signed in' }

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const categoryId = String(formData.get('categoryId') ?? '').trim()
  const serviceId = String(formData.get('serviceId') ?? '').trim()
  const impact = String(formData.get('impact') ?? '') as Impact
  const urgency = String(formData.get('urgency') ?? '') as Urgency

  if (title.length < 3 || title.length > 200) return { error: 'Title must be 3–200 characters.' }
  if (!description || description.length > 4000) return { error: 'Description must be 1–4000 characters.' }
  if (!categoryId || !serviceId) return { error: 'Pick a category and a service.' }
  if (!IMPACTS.includes(impact) || !URGENCIES.includes(urgency)) return { error: 'Pick an impact and an urgency.' }

  const res = await createIncident({
    title,
    description,
    categoryId,
    serviceId,
    impact,
    urgency,
    affectedUsers: Math.max(1, Math.min(100000, Number(formData.get('affectedUsers') ?? 1) || 1)),
    securityIncident: formData.get('securityIncident') === 'on',
  })
  if (isItsmError(res)) return { error: res.error }

  revalidatePath('/incidents', 'layout')
  redirect(res.data.id ? `/incidents/${res.data.id}` : '/incidents')
}
