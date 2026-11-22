import { createClient } from '@/lib/supabase/server'
import { getAccessLevel, getAccessProfile, isEngineeringSuperuser } from '@/lib/access'
import { getItsmRoles } from '@/lib/itsm-roles'
import type { AgentContext } from './types'

/**
 * Resolves the signed-in employee and everything capabilities gate on. Returns null when there
 * is no session or no employee record: the agent never runs anonymously.
 */
export async function getAgentContext(currentPage: string | null = null): Promise<AgentContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: emp } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!emp) return null

  const [baseProfile, itsm, accessLevel, { data: roleRows }] = await Promise.all([
    getAccessProfile(supabase, emp.id),
    // Service-desk roles come from the ITSM service, the same answer the sidebar uses.
    getItsmRoles(),
    getAccessLevel(supabase, emp.id),
    supabase
      .from('employee_roles')
      .select('roles(role_name, title, access_level, departments(name))')
      .eq('employee_id', emp.id)
      .eq('is_active', true),
  ])

  type RoleRow = {
    role_name: string | null
    title: string | null
    access_level: string | null
    departments: { name: string } | { name: string }[] | null
  }
  const roles = (roleRows ?? []).flatMap((r: { roles: unknown }) => {
    const role = (Array.isArray(r.roles) ? r.roles[0] : r.roles) as RoleRow | null
    return role ? [role] : []
  })

  const profile = { ...baseProfile, itsm }
  const deskRoles = [itsm.serviceDeskAdmin && 'service-desk admin', itsm.technician && 'technician'].filter(Boolean)
  const roleSummary =
    [
      ...roles
      .map((r) => {
        const dept = Array.isArray(r.departments) ? r.departments[0]?.name : r.departments?.name
        const label = r.title ?? r.role_name ?? 'Role'
        return `${label}${dept ? ` (${dept}, ${r.access_level ?? 'standard'})` : ''}`
      }),
      ...(deskRoles.length ? [`IT service desk: ${deskRoles.join(' and ')}`] : []),
    ].join('; ') || 'No roles assigned'

  return {
    employeeId: emp.id as string,
    authUserId: user.id,
    employeeName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || 'Employee',
    supabase,
    profile,
    accessLevel,
    isEngineeringSuperuser: isEngineeringSuperuser(profile),
    currentPage,
    roleSummary,
  }
}
