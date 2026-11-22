import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard-shell'
import { getAccessProfile } from '@/lib/access'
import { getCurrentEmployee } from '@/lib/current-employee'
import { getItsmRoles } from '@/lib/itsm-roles'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user, employee } = await getCurrentEmployee()

  if (!user) {
    redirect('/login')
  }

  const [{ count: unreadCount }, hrProfile, itsm] = await Promise.all([
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', employee?.id ?? '')
      .eq('is_read', false),
    getAccessProfile(supabase, employee?.id ?? ''),
    getItsmRoles(),
  ])
  const accessProfile = { ...hrProfile, itsm }

  const mustChangePassword = user.user_metadata?.must_change_password === true

  if (mustChangePassword) {
    redirect('/onboarding')
  }

  return (
    <DashboardShell
      employeeName={employee ? `${employee.first_name} ${employee.last_name}` : (user.email ?? 'Employee')}
      employeeCode={employee?.employee_code ?? ''}
      designation={employee?.designation ?? null}
      unreadCount={unreadCount ?? 0}
      accessProfile={accessProfile}
      hideMascot={user.user_metadata?.hide_mascot === true}
    >
      {children}
    </DashboardShell>
  )
}
