'use server'

import { getAccessProfile, isAnyDeptAdmin } from '@/lib/access'
import { requireEmployee } from '@/lib/current-employee'
import { createAdminClient } from '@/lib/supabase/admin'

export type EmployeeSignInStatus = 'never_signed_in' | 'signed_in' | 'no_account' | 'unavailable'

export async function getEmployeeSignInStatuses(
  employeeIds: string[]
): Promise<Record<string, EmployeeSignInStatus>> {
  const { supabase, employee } = await requireEmployee()
  const profile = await getAccessProfile(supabase, employee.id)
  if (!isAnyDeptAdmin(profile) || employeeIds.length === 0) return {}

  // Recheck visibility before using the privileged Auth API. Do not trust
  // employee IDs supplied to this server action by a browser.
  const query = supabase
    .from('employees')
    .select('id, auth_user_id')
    .in('id', [...new Set(employeeIds)])
    .is('deleted_at', null)
  if (!profile.isSuperuser) query.eq('org_id', employee.org_id)

  const { data: employees, error } = await query
  if (error || !employees?.length) return {}

  const admin = createAdminClient()
  const statuses: Record<string, EmployeeSignInStatus> = {}
  // Bound concurrency and fetch only accounts belonging to visible employees.
  for (let offset = 0; offset < employees.length; offset += 10) {
    await Promise.all(employees.slice(offset, offset + 10).map(async (emp) => {
      if (!emp.auth_user_id) {
        statuses[emp.id] = 'no_account'
        return
      }
      try {
        const { data, error } = await admin.auth.admin.getUserById(emp.auth_user_id)
        statuses[emp.id] = error || !data.user
          ? 'unavailable'
          : data.user.last_sign_in_at ? 'signed_in' : 'never_signed_in'
      } catch {
        statuses[emp.id] = 'unavailable'
      }
    }))
  }
  return statuses
}
