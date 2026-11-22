'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAccessProfile, isAnyDeptAdmin, isDeptAdmin, type AccessLevel } from '@/lib/access'
import { getOrCreateDeptRole } from '@/lib/roles'
import { revalidatePath } from 'next/cache'

type ActionResult = { ok: true } | { ok: false; error: string }

// Shared by inviteEmployee/assignRole/revokeRole: a superuser can touch any
// department at any level, including granting/revoking superuser itself and
// placing people in Executive. A non-superuser admin may only place people
// into departments they themselves administer, at standard/admin, and can
// never grant superuser or touch Executive — even for their own department.
async function authorizeDeptAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  callerId: string,
  departmentId: string,
  level: AccessLevel
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getAccessProfile(supabase, callerId)
  if (!isAnyDeptAdmin(profile)) return { ok: false, error: 'Insufficient permissions' }

  if (profile.isSuperuser) return { ok: true }

  if (level === 'superuser') {
    return { ok: false, error: 'Only a superuser can grant or revoke superuser access' }
  }

  const { data: department } = await admin.from('departments').select('name').eq('id', departmentId).maybeSingle()
  if (department?.name === 'Executive') {
    return { ok: false, error: 'Only a superuser can assign someone to Executive' }
  }
  if (!isDeptAdmin(profile, departmentId)) {
    return { ok: false, error: 'You can only manage your own department' }
  }
  return { ok: true }
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = 'Light@'
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

type InviteResult =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string }

export async function inviteEmployee(payload: {
  first_name: string
  last_name: string
  email: string
  employee_code: string
  designation: string
  departments: { departmentId: string; level: AccessLevel }[]
}): Promise<InviteResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { data: caller } = await supabase
      .from('employees')
      .select('id, org_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!caller) return { ok: false, error: 'Employee record not found' }

    const email = payload.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Enter a valid email address' }
    }

    const admin = createAdminClient()

    if (payload.departments.length === 0) {
      const profile = await getAccessProfile(supabase, caller.id)
      if (!isAnyDeptAdmin(profile)) return { ok: false, error: 'Insufficient permissions' }
    } else {
      // Validate every requested department/level up front, before creating
      // anything — one disallowed entry should fail the whole invite, not
      // leave a half-onboarded account behind.
      for (const { departmentId, level } of payload.departments) {
        const authz = await authorizeDeptAssignment(supabase, admin, caller.id, departmentId, level)
        if (!authz.ok) return { ok: false, error: authz.error }
      }
    }

    const tempPassword = generateTempPassword()

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    })
    if (createError) return { ok: false, error: createError.message }

    const firstName = payload.first_name.trim()
    const lastName = payload.last_name.trim()
    const { data: newEmp, error: empError } = await admin
      .from('employees')
      .insert({
        first_name: firstName,
        last_name: lastName,

        email,
        employee_code: payload.employee_code || null,
        designation: payload.designation || null,
        auth_user_id: created.user.id,
        org_id: caller.org_id,
        is_active: true,
      })
      .select('id')
      .single()

    if (empError) return { ok: false, error: empError.message }

    for (const { departmentId, level } of payload.departments) {
      const role = await getOrCreateDeptRole(admin, departmentId, level)
      if ('error' in role) return { ok: false, error: role.error }

      const { error: roleError } = await admin.from('employee_roles').insert({
        employee_id: newEmp.id,
        role_id: role.roleId,
        org_id: caller.org_id,
        assigned_by: caller.id,
        is_active: true,
      })
      if (roleError) return { ok: false, error: roleError.message }
    }

    return { ok: true, tempPassword }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { ok: false, error: message }
  }
}

type UpdateResult = { ok: true } | { ok: false; error: string }

export async function updateEmployee(payload: {
  id: string
  first_name: string
  last_name: string
  designation: string | null
  phone: string | null
  location: string | null
  timezone: string | null
  date_of_joining: string | null
  date_of_birth: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
}): Promise<UpdateResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { data: caller } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!caller) return { ok: false, error: 'Employee record not found' }

    if (caller.id !== payload.id) {
      const profile = await getAccessProfile(supabase, caller.id)
      if (!isAnyDeptAdmin(profile)) return { ok: false, error: 'Insufficient permissions' }
    }

    const admin = createAdminClient()

    const firstName = payload.first_name.trim()
    const lastName = payload.last_name.trim()

    const { error } = await admin
      .from('employees')
      .update({
        first_name: firstName,
        last_name: lastName,
        designation: payload.designation || null,
        phone: payload.phone || null,
        location: payload.location || null,
        timezone: payload.timezone || null,
        date_of_joining: payload.date_of_joining || null,
        date_of_birth: payload.date_of_birth || null,
      })
      .eq('id', payload.id)

    if (error) return { ok: false, error: error.message }

    if (
      payload.emergency_contact_name !== undefined ||
      payload.emergency_contact_phone !== undefined
    ) {
      const { error: profileError } = await admin
        .from('employee_profiles')
        .upsert({
          employee_id: payload.id,
          emergency_contact_name: payload.emergency_contact_name || null,
          emergency_contact_phone: payload.emergency_contact_phone || null,
        }, { onConflict: 'employee_id' })

      if (profileError) return { ok: false, error: profileError.message }
    }

    revalidatePath('/profile')
    revalidatePath('/employees')
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { ok: false, error: message }
  }
}

// ── Role Assignment (department + level, no named titles) ──────
export async function assignRole(
  employeeId: string,
  departmentId: string,
  level: AccessLevel
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: caller } = await supabase.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!caller) return { ok: false, error: 'Employee not found' }

  const admin = createAdminClient()
  const authz = await authorizeDeptAssignment(supabase, admin, caller.id, departmentId, level)
  if (!authz.ok) return authz

  const role = await getOrCreateDeptRole(admin, departmentId, level)
  if ('error' in role) return { ok: false, error: role.error }

  const { data: targetEmployee } = await admin.from('employees').select('org_id').eq('id', employeeId).maybeSingle()
  if (!targetEmployee) return { ok: false, error: 'Employee not found' }

  const { error } = await admin.from('employee_roles').insert({
    employee_id: employeeId,
    role_id: role.roleId,
    org_id: targetEmployee.org_id,
    assigned_by: caller.id,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/employees')
  return { ok: true }
}

// Delete an account entirely: revokes Supabase Auth login, anonymizes PII on
// the employees row (the row itself is kept — 100+ tables FK to employees.id
// with no cascade, so a real DELETE would fail or orphan other people's
// records), and writes a full pre-deletion snapshot to audit_log so there is
// a permanent record that the account existed and was deleted, by whom, and
// when. Superuser-only, and a superuser can't delete their own account.
export async function deleteEmployee(employeeId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { data: caller } = await supabase.from('employees').select('id').eq('auth_user_id', user.id).single()
    if (!caller) return { ok: false, error: 'Employee record not found' }

    const profile = await getAccessProfile(supabase, caller.id)
    if (!profile.isSuperuser) return { ok: false, error: 'Only a superuser can delete an account' }
    if (caller.id === employeeId) return { ok: false, error: 'You cannot delete your own account' }

    const admin = createAdminClient()

    const { data: target } = await admin.from('employees').select('*').eq('id', employeeId).maybeSingle()
    if (!target) return { ok: false, error: 'Employee not found' }
    if (target.deleted_at) return { ok: false, error: 'This account has already been deleted' }

    const now = new Date().toISOString()
    const authUserId = target.auth_user_id as string | null

    // Written before any mutation: even if a later step fails, the log
    // captures that deletion was initiated with a full snapshot of the row
    // (including its original created_at/created_by) as it existed.
    const { error: logError } = await admin.from('audit_log').insert({
      employee_id: caller.id,
      action: 'delete',
      table_name: 'employees',
      record_id: employeeId,
      old_values: target,
      new_values: { deleted: true, deleted_at: now, deleted_by: caller.id },
    })
    if (logError) return { ok: false, error: logError.message }

    // Detach the auth link before deleting the auth user — employees.auth_user_id
    // references auth.users(id) with no ON DELETE clause.
    const { error: detachError } = await admin
      .from('employees')
      .update({ auth_user_id: null })
      .eq('id', employeeId)
    if (detachError) return { ok: false, error: detachError.message }

    if (authUserId) {
      const { error: authError } = await admin.auth.admin.deleteUser(authUserId)
      if (authError) return { ok: false, error: authError.message }
    }

    await admin
      .from('employee_roles')
      .update({ is_active: false, deactivated_by: caller.id, deactivated_at: now })
      .eq('employee_id', employeeId)
      .eq('is_active', true)

    const { error: anonError } = await admin
      .from('employees')
      .update({
        first_name: 'Deleted',
        last_name: 'User',
        email: `deleted-${employeeId}@deleted.invalid`,
        personal_email: null,
        phone: null,
        date_of_birth: null,
        national_id: null,
        location: null,
        is_active: false,
        deactivated_at: now,
        deactivated_by: caller.id,
        deleted_at: now,
        deleted_by: caller.id,
      })
      .eq('id', employeeId)
    if (anonError) return { ok: false, error: anonError.message }

    revalidatePath('/employees')
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { ok: false, error: message }
  }
}

export async function revokeRole(employeeId: string, roleId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: caller } = await supabase.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!caller) return { ok: false, error: 'Employee not found' }

  const admin = createAdminClient()
  const { data: role } = await admin.from('roles').select('department_id, access_level').eq('id', roleId).maybeSingle()
  if (!role) return { ok: false, error: 'Role not found' }

  const authz = await authorizeDeptAssignment(supabase, admin, caller.id, role.department_id, role.access_level as AccessLevel)
  if (!authz.ok) return authz

  const { error } = await admin
    .from('employee_roles')
    .update({ is_active: false, deactivated_by: caller.id, deactivated_at: new Date().toISOString() })
    .eq('employee_id', employeeId)
    .eq('role_id', roleId)
    .eq('is_active', true)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/employees')
  return { ok: true }
}
