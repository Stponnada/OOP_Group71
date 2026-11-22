import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge, buttonClass, EmptyState, Page, PageHeader, StatusBadge, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { getAccessProfile, isAnyDeptAdmin, fullName } from '@/lib/access'
import { requireEmployee } from '@/lib/current-employee'
import InviteEmployeeButton from './invite-employee-button'
import DeactivateButton from './deactivate-button'
import DeleteButton from './delete-button'
import EditEmployeeModal from './edit-employee-modal'
import { ManageRolesDeptButton } from './assign-role-dept-client'
import { getEmployeeSignInStatuses } from './sign-in-actions'

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; department?: string }>
}) {
  const params = await searchParams
  const { supabase, employee: currentEmployee } = await requireEmployee()

  const empId = currentEmployee.id
  const orgId = currentEmployee.org_id

  const profile = await getAccessProfile(supabase, empId)
  if (!isAnyDeptAdmin(profile)) redirect('/dashboard')

  const isSysAdmin = profile.isSuperuser

  // Fetch all orgs in the tree (so a superuser can see & filter subsidiaries)
  const { data: allOrgs } = isSysAdmin
    ? await supabase.from('organizations').select('id, name, org_type').eq('is_active', true).order('name')
    : { data: null }

  const visibleOrgs = allOrgs ?? []

  // Employees query: superuser can view all orgs or filter; others see their own org
  const employeeQuery = supabase
    .from('employees')
    .select('id, first_name, last_name, email, designation, is_active, date_of_joining, phone, location, timezone, date_of_birth, org_id')
    .is('deleted_at', null)
    .order('last_name', { ascending: true })

  if (isSysAdmin && params.org) {
    employeeQuery.eq('org_id', params.org)
  } else if (isSysAdmin && !params.org) {
    // Show all — no filter
  } else {
    employeeQuery.eq('org_id', orgId)
  }

  // Departments the caller may onboard/assign into: all of them for a
  // superuser, only the ones they themselves administer otherwise. No more
  // named-role catalog — onboarding only ever asks for department + level.
  const { data: allDepts } = await supabase
    .from('departments')
    .select('id, name')
    .eq('org_id', isSysAdmin && params.org ? params.org : orgId)
    .eq('is_active', true)
    .order('name')

  const assignableDepts = isSysAdmin
    ? (allDepts ?? [])
    : (allDepts ?? []).filter((d) => profile.departments.some((pd) => pd.id === d.id && pd.level === 'admin'))

  const { data: employees } = await employeeQuery

  const empIds = (employees ?? []).map((e) => e.id)
  const { data: allRoleRows } = empIds.length
    ? await supabase
        .from('employee_roles')
        .select('employee_id, role_id, roles(title, access_level, departments(id, name))')
        .in('employee_id', empIds)
        .eq('is_active', true)
    : { data: [] }

  // Build per-employee lookup maps
  const rolesByEmp: Record<string, { role_id: string; roles: { title: string } | null; sortPriority: number }[]> = {}
  const sortPriorityByEmp: Record<string, number> = {}
  const deptNamesByEmp: Record<string, Set<string>> = {}
  const deptIdsByEmp: Record<string, Set<string>> = {}
  const filterDepts = new Map<string, { id: string; name: string; employeeIds: Set<string> }>()
  for (const row of allRoleRows ?? []) {
    const role = (Array.isArray(row.roles) ? row.roles[0] : row.roles) as
      | { title: string; access_level: string; departments: { id: string; name: string } | { id: string; name: string }[] | null }
      | null

    const dept = role ? (Array.isArray(role.departments) ? role.departments[0] : role.departments) : null
    const sortPriority = dept?.name === 'Executive' ? 0 : role?.access_level === 'superuser' ? 1 : 2
    if (!rolesByEmp[row.employee_id]) rolesByEmp[row.employee_id] = []
    rolesByEmp[row.employee_id].push({ role_id: row.role_id, roles: role ? { title: role.title } : null, sortPriority })
    sortPriorityByEmp[row.employee_id] = Math.min(sortPriorityByEmp[row.employee_id] ?? 2, sortPriority)

    if (dept) {
      if (!deptNamesByEmp[row.employee_id]) deptNamesByEmp[row.employee_id] = new Set()
      deptNamesByEmp[row.employee_id].add(dept.name)
      if (!deptIdsByEmp[row.employee_id]) deptIdsByEmp[row.employee_id] = new Set()
      deptIdsByEmp[row.employee_id].add(dept.id)
      if (!filterDepts.has(dept.id)) filterDepts.set(dept.id, { ...dept, employeeIds: new Set() })
      filterDepts.get(dept.id)!.employeeIds.add(row.employee_id)
    }
  }
  for (const roles of Object.values(rolesByEmp)) {
    roles.sort((a, b) => a.sortPriority - b.sortPriority ||
      (a.roles?.title ?? '').localeCompare(b.roles?.title ?? '', undefined, { sensitivity: 'base' }))
  }

  const filteredEmployees = (employees ?? [])
    .filter((emp) => !params.department || deptIdsByEmp[emp.id]?.has(params.department))
    .sort((a, b) => (sortPriorityByEmp[a.id] ?? 2) - (sortPriorityByEmp[b.id] ?? 2) ||
      fullName(a).localeCompare(fullName(b), undefined, { sensitivity: 'base' }))
  const signInStatuses = await getEmployeeSignInStatuses(filteredEmployees.map((emp) => emp.id))
  const departmentFilters = [...filterDepts.values()].sort((a, b) => a.name.localeCompare(b.name))
  function departmentFilterHref(department?: string) {
    const query = new URLSearchParams()
    if (isSysAdmin && params.org) query.set('org', params.org)
    if (department) query.set('department', department)
    return query.size ? `/employees?${query}` : '/employees'
  }

  function segmentClass(active: boolean) {
    return buttonClass({ variant: active ? 'secondary' : 'ghost', size: 'sm', className: active ? '' : 'border border-transparent' })
  }

  return (
    <Page>
      <PageHeader
        title="Employees"
        subtitle={`${filteredEmployees.length} employee(s)`}
        actions={<InviteEmployeeButton depts={assignableDepts} isSuperuser={isSysAdmin} />}
      />

      {/* Org filter — only for a superuser with multiple orgs */}
      {isSysAdmin && visibleOrgs.length > 1 && (
        <nav
          aria-label="Filter employees by organisation"
          className="inline-flex max-w-full flex-wrap gap-1 rounded-md border border-line bg-sunken p-1"
        >
          <Link href="/employees" aria-current={!params.org ? 'page' : undefined} className={segmentClass(!params.org)}>
            All Orgs
          </Link>
          {visibleOrgs.map((org) => (
            <Link
              key={org.id}
              href={`/employees?org=${org.id}`}
              aria-current={params.org === org.id ? 'page' : undefined}
              className={segmentClass(params.org === org.id)}
            >
              {org.name}
              {org.org_type !== 'standalone' && (
                <span className="font-normal text-fg-muted">{org.org_type}</span>
              )}
            </Link>
          ))}
        </nav>
      )}

      {/* Same surface as <Panel>; Panel currently requires a title and this list has none. */}
      <section aria-label="Employee list" className="rounded-md border border-line bg-surface p-5">
        <nav
          aria-label="Filter employees by department"
          className="mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-md border border-line bg-sunken p-1"
        >
          <Link
            href={departmentFilterHref()}
            aria-current={!params.department ? 'page' : undefined}
            className={segmentClass(!params.department)}
          >
            All departments ({employees?.length ?? 0})
          </Link>
          {departmentFilters.map((dept) => (
            <Link
              key={dept.id}
              href={departmentFilterHref(dept.id)}
              aria-current={params.department === dept.id ? 'page' : undefined}
              className={segmentClass(params.department === dept.id)}
            >
              {dept.name} ({dept.employeeIds.size})
            </Link>
          ))}
        </nav>
        {filteredEmployees.length === 0 ? (
          <EmptyState
            title="No employees found"
            description={
              params.department
                ? 'No one is assigned to this department yet. Pick another department or show all departments.'
                : 'Use Invite Employee at the top right to add someone.'
            }
          />
        ) : (
          <Table caption="Employees" minWidth={860}>
            <THead>
              <Th>Name</Th>
              <Th>Designation</Th>
              <Th>Roles</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th className="pr-0">Actions</Th>
            </THead>
            <TBody>
              {filteredEmployees.map((emp) => {
                const empRoles = rolesByEmp[emp.id] ?? []
                const departmentNames = [...(deptNamesByEmp[emp.id] ?? [])].join(', ') || '—'
                const name = fullName(emp)
                const signInStatus = signInStatuses[emp.id] ?? 'unavailable'
                const status = !emp.is_active ? 'Inactive'
                  : signInStatus === 'signed_in' ? 'Signed in'
                  : signInStatus === 'never_signed_in' || signInStatus === 'no_account' ? 'Onboarding'
                  : 'Unavailable'
                return (
                  <Tr key={emp.id}>
                    <Td>
                      <div className="font-medium whitespace-nowrap">{name}</div>
                      <div className="text-label text-fg-muted">{emp.email}</div>
                    </Td>
                    <Td muted>{emp.designation ?? '—'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {empRoles.length > 0
                          ? empRoles.map((r) => (
                              <Badge key={r.role_id} tone="neutral">{r.roles?.title ?? '—'}</Badge>
                            ))
                          : <span className="text-fg-muted">—</span>}
                      </div>
                    </Td>
                    <Td muted>{departmentNames}</Td>
                    <Td nowrap>
                      <StatusBadge status={status.toLowerCase().replace(' ', '_')} label={status} />
                    </Td>
                    <Td className="w-[14rem] pr-0">
                      {/* Two rows at most: Edit + Manage Access, then the destructive pair. */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EditEmployeeModal
                          employee={{
                            id: emp.id,
                            first_name: emp.first_name ?? '',
                            last_name: emp.last_name ?? '',
                            designation: emp.designation ?? null,
                            phone: emp.phone ?? null,
                            location: emp.location ?? null,
                            timezone: emp.timezone ?? null,
                            date_of_joining: emp.date_of_joining ?? null,
                            date_of_birth: emp.date_of_birth ?? null,
                          }}
                        />
                        <ManageRolesDeptButton
                          employeeId={emp.id}
                          employeeName={name}
                          availableDepts={assignableDepts}
                          currentRoles={empRoles}
                          isSuperuser={isSysAdmin}
                        />
                        {emp.is_active && emp.id !== empId && (
                          <DeactivateButton employeeId={emp.id} employeeName={name} />
                        )}
                        {isSysAdmin && emp.id !== empId && (
                          <DeleteButton employeeId={emp.id} employeeName={name} />
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </section>
    </Page>
  )
}
