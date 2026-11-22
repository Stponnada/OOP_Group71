import type { createAdminClient } from '@/lib/supabase/admin'
import type { AccessLevel } from '@/lib/access'

type Admin = ReturnType<typeof createAdminClient>

const LEVEL_LABEL: Record<AccessLevel, string> = {
  standard: 'Standard',
  admin: 'Admin',
  superuser: 'Superuser',
}

// Roles carry no user-facing "title" concept anymore — onboarding only asks
// for a department and a level. This resolves (or lazily creates) the one
// canonical role row backing that pair, auto-naming it for anyone who looks
// at the raw roles table. Executive is special: it has no standard/admin
// split, only a single superuser row, so any level requested for it is
// ignored in favor of 'superuser'. Superuser is otherwise a normal level a
// superuser caller can grant in any department — callers must enforce on
// their own that only a superuser may ever request level: 'superuser'.
export async function getOrCreateDeptRole(
  admin: Admin,
  departmentId: string,
  level: AccessLevel
): Promise<{ roleId: string } | { error: string }> {
  const { data: department, error: deptErr } = await admin
    .from('departments')
    .select('id, name')
    .eq('id', departmentId)
    .single()
  if (deptErr || !department) return { error: 'Department not found' }

  const isExecutive = department.name === 'Executive'
  const resolvedLevel: AccessLevel = isExecutive ? 'superuser' : level
  const title = `${department.name} ${LEVEL_LABEL[resolvedLevel]}`

  const { data: existing } = await admin
    .from('roles')
    .select('id')
    .eq('department_id', departmentId)
    .eq('access_level', resolvedLevel)
    .eq('is_active', true)
    .maybeSingle()
  if (existing) return { roleId: existing.id as string }

  const { data: created, error: createErr } = await admin
    .from('roles')
    .insert({ department_id: departmentId, title, access_level: resolvedLevel })
    .select('id')
    .single()
  if (createErr || !created) return { error: createErr?.message ?? 'Failed to create role' }

  return { roleId: created.id as string }
}
