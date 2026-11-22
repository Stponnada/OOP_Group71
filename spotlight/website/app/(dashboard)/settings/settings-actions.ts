'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessLevel, isSysAdmin } from '@/lib/access'
import { revalidatePath } from 'next/cache'

type Result = { ok: true } | { ok: false; error: string }

type CallerOk = { ok: true; empId: string; orgId: string; supabase: Awaited<ReturnType<typeof createClient>> }
type CallerErr = { ok: false; error: string }

async function getCaller(): Promise<CallerOk | CallerErr> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }
  const { data: emp } = await supabase
    .from('employees')
    .select('id, org_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!emp) return { ok: false, error: 'Employee not found' }
  return { ok: true, empId: emp.id as string, orgId: emp.org_id as string, supabase }
}

// ── Add Department ────────────────────────────────────────────
export async function addDepartment(payload: {
  name: string
  description: string | null
  orgId: string
}): Promise<Result> {
  const caller = await getCaller()
  if (!caller.ok) return { ok: false, error: caller.error }
  const { empId, supabase } = caller
  const access = await getAccessLevel(supabase, empId)
  if (!isSysAdmin(access)) return { ok: false, error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin.from('departments').insert({
    name: payload.name.trim(),
    description: payload.description || null,
    org_id: payload.orgId,
    is_active: true,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true }
}
