import ChangePasswordForm from './change-password-form'
import EditEmployeeModal from '../employees/edit-employee-modal'
import { requireEmployee } from '@/lib/current-employee'
import { Page, PageHeader, Panel, StatusBadge } from '@/components/ui'

export default async function ProfilePage() {
  const { supabase, employee } = await requireEmployee()

  const empId = employee.id

  const { data: profile } = empId
    ? await supabase
        .from('employee_profiles')
        .select('emergency_contact_name, emergency_contact_phone')
        .eq('employee_id', empId)
        .maybeSingle()
    : { data: null }

  const displayName = employee ? `${employee.first_name} ${employee.last_name}` : null

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: 'Full Name', value: displayName },
    { label: 'Email', value: employee?.email },
    { label: 'Employee Code', value: employee?.employee_code },
    { label: 'Designation', value: employee?.designation },
    { label: 'Phone', value: employee?.phone },
    { label: 'Location', value: employee?.location },
    {
      label: 'Date of Joining',
      value: employee?.date_of_joining
        ? new Date(employee.date_of_joining).toLocaleDateString()
        : null,
    },
    { label: 'Timezone', value: employee?.timezone },
    { label: 'Emergency Contact', value: profile?.emergency_contact_name },
    { label: 'Emergency Phone', value: profile?.emergency_contact_phone },
  ]

  return (
    <Page>
      <PageHeader title="My Profile" subtitle="View and manage your personal information" />

      <div className="grid grid-cols-1 gap-6">
        {/* Personal Information */}
        <Panel
          title="Personal Information"
          description="Use the Edit button to update your phone, location, timezone, and other details."
          actions={
            employee && (
              <EditEmployeeModal
                employee={{
                  id: employee.id ?? '',
                  first_name: employee.first_name ?? '',
                  last_name: employee.last_name ?? '',
                  designation: employee.designation ?? null,
                  phone: employee.phone ?? null,
                  location: employee.location ?? null,
                  timezone: employee.timezone ?? null,
                  date_of_joining: employee.date_of_joining ?? null,
                  date_of_birth: employee.date_of_birth ?? null,
                  emergency_contact_name: profile?.emergency_contact_name ?? null,
                  emergency_contact_phone: profile?.emergency_contact_phone ?? null,
                }}
              />
            )
          }
        >
          <dl className="divide-y divide-line">
            {fields.map((field) => (
              <div
                key={field.label}
                className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"
              >
                <dt className="text-label font-medium text-fg-muted">{field.label}</dt>
                <dd className="min-w-0 break-words text-body text-fg">{field.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 border-t border-line pt-3">
            <StatusBadge status={employee?.is_active ? 'active' : 'inactive'} />
          </div>
        </Panel>
      </div>

      <ChangePasswordForm />
    </Page>
  )
}
