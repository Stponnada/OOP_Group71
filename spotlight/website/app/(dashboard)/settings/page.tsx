import { redirect } from 'next/navigation'
import { getAccessLevel, isSysAdmin } from '@/lib/access'
import { requireEmployee } from '@/lib/current-employee'
import DepartmentManagementSection from './department-management-section'
import { Page, PageHeader, Panel, Table, THead, Th, TBody, Tr, Td, Badge, StatusBadge, EmptyState } from '@/components/ui'

export default async function SettingsPage() {
  const { supabase, employee } = await requireEmployee()

  const empId = employee.id

  const access = await getAccessLevel(supabase, empId)
  if (!isSysAdmin(access)) redirect('/dashboard')

  // All roles
  const { data: allRoles } = await supabase
    .from('roles')
    .select('id, title, access_level, description, is_active')
    .eq('is_active', true)
    .order('title', { ascending: true })

  // Org ID for settings actions
  const { data: empRow } = await supabase
    .from('employees')
    .select('org_id')
    .eq('id', empId)
    .single()
  const orgId = empRow?.org_id

  // Departments for this org
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name, description, is_active')
    .eq('org_id', orgId)
    .order('name', { ascending: true })

  return (
    <Page>
      <PageHeader title="Company Settings" subtitle="Departments and roles" />

      <Panel
        title="Departments"
        description="Manage departments in your organization. Departments group employees and decide who administers whom."
      >
        <DepartmentManagementSection
          departments={(departments ?? []).map(d => ({ id: d.id, name: d.name ?? '', description: d.description ?? null, is_active: d.is_active }))}
          orgId={orgId ?? ''}
        />
      </Panel>

      <Panel title="System Roles" count={allRoles?.length}>
        {!allRoles || allRoles.length === 0 ? (
          <EmptyState compact title="No roles defined" />
        ) : (
          <Table caption="System roles">
            <THead>
              <Th>Role</Th>
              <Th>Access Level</Th>
              <Th>Description</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {allRoles.map((role) => (
                <Tr key={role.id}>
                  <Td className="font-medium">{role.title}</Td>
                  <Td>
                    <Badge tone="neutral">{role.access_level}</Badge>
                  </Td>
                  <Td muted>{role.description ?? '—'}</Td>
                  <Td>
                    <StatusBadge status={role.is_active ? 'active' : 'inactive'} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>
    </Page>
  )
}
