import type { SupabaseClient } from '@supabase/supabase-js'

export type AccessLevel = 'standard' | 'admin' | 'superuser'

export async function getAccessLevel(
  supabase: SupabaseClient,
  employeeId: string
): Promise<AccessLevel> {
  const { data } = await supabase
    .from('employee_roles')
    .select('roles(access_level, departments(name))')
    .eq('employee_id', employeeId)
    .eq('is_active', true)

  const rows = (data ?? []).flatMap((r: { roles: unknown }) => {
    const role = (Array.isArray(r.roles) ? r.roles[0] : r.roles) as
      | { access_level: string; departments: { name: string } | { name: string }[] | null }
      | null
    return role ? [role] : []
  })

  const isSuperuser = rows.some((role) => {
    if (role.access_level === 'superuser') return true
    const dept = Array.isArray(role.departments) ? role.departments[0] : role.departments
    return dept?.name === 'Executive'
  })
  if (isSuperuser) return 'superuser'
  if (rows.some((role) => role.access_level === 'admin')) return 'admin'
  return 'standard'
}

export const isPrivileged = (l: AccessLevel) => l !== 'standard'
export const isSysAdmin = (l: AccessLevel) => l === 'superuser'

export function fullName(emp: { first_name: string; last_name: string } | null | undefined): string {
  if (!emp) return '—'
  return `${emp.first_name} ${emp.last_name}`
}

// ── Department-scoped access ────────────────────────────────────────────
// Layered on top of the flat AccessLevel above for the modules that need
// real per-department scoping (Operations & Finance, employee onboarding,
// content/admin gating). Everything else in the app keeps using the flat
// isPrivileged/isSysAdmin helpers above unchanged.

export type DeptMembership = { id: string; name: string; level: 'standard' | 'admin' }
/** Service-desk roles, from the ITSM service rather than the HR tables (see lib/itsm-roles.ts). */
export type ItsmRoles = { technician: boolean; serviceDeskAdmin: boolean }
export type AccessProfile = {
  isSuperuser: boolean
  departments: DeptMembership[]
  /** Departments where the employee holds a superuser role, e.g. Engineering superusers see reported issues. */
  superuserDepartments: string[]
  /** Absent where nobody asked the ITSM service; service-desk items then stay hidden. */
  itsm?: ItsmRoles
}

export async function getAccessProfile(
  supabase: SupabaseClient,
  employeeId: string
): Promise<AccessProfile> {
  const { data } = await supabase
    .from('employee_roles')
    .select('roles(access_level, department_id, departments(id, name))')
    .eq('employee_id', employeeId)
    .eq('is_active', true)

  type RoleRow = {
    access_level: string
    department_id: string
    departments: { id: string; name: string } | { id: string; name: string }[] | null
  }

  const rows = (data ?? []).flatMap((r: { roles: unknown }) => {
    const role = (Array.isArray(r.roles) ? r.roles[0] : r.roles) as RoleRow | null
    return role ? [role] : []
  })

  const isSuperuser = rows.some((role) => {
    if (role.access_level === 'superuser') return true
    const dept = Array.isArray(role.departments) ? role.departments[0] : role.departments
    return dept?.name === 'Executive'
  })

  const superuserDepartments = new Set<string>()
  const departments = new Map<string, DeptMembership>()
  for (const role of rows) {
    if (role.access_level === 'superuser') {
      const dept = Array.isArray(role.departments) ? role.departments[0] : role.departments
      if (dept) superuserDepartments.add(dept.name)
    }
    if (role.access_level !== 'standard' && role.access_level !== 'admin') continue
    const dept = Array.isArray(role.departments) ? role.departments[0] : role.departments
    if (!dept) continue
    const existing = departments.get(dept.id)
    if (!existing || (existing.level === 'standard' && role.access_level === 'admin')) {
      departments.set(dept.id, { id: dept.id, name: dept.name, level: role.access_level as 'standard' | 'admin' })
    }
  }

  return { isSuperuser, departments: [...departments.values()], superuserDepartments: [...superuserDepartments] }
}

export function isDeptAdmin(profile: AccessProfile, departmentId: string): boolean {
  return profile.isSuperuser || profile.departments.some((d) => d.id === departmentId && d.level === 'admin')
}

/** Engineering superusers triage the issues people report about Spotlight itself. */
export function isEngineeringSuperuser(profile: AccessProfile): boolean {
  return profile.superuserDepartments.includes('Engineering')
}

export function isDeptMember(profile: AccessProfile, departmentId: string): boolean {
  return profile.isSuperuser || profile.departments.some((d) => d.id === departmentId)
}

// Used to gate site-administration functions (e.g. /employees) that any
// department's admin should reach to onboard their own people, not just
// superusers.
export function isAnyDeptAdmin(profile: AccessProfile): boolean {
  return profile.isSuperuser || profile.departments.some((d) => d.level === 'admin')
}
