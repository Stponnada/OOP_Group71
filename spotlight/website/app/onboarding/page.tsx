import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAccessLevel } from '@/lib/access'
import OnboardingClient from './onboarding-client'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('id, first_name, last_name, email, employee_code, designation')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee) redirect('/dashboard')

  const access = await getAccessLevel(supabase, employee.id)
  const mustChangePassword = user.user_metadata?.must_change_password === true

  return (
    <OnboardingClient
      employee={employee}
      accessLevel={access}
      mustChangePassword={mustChangePassword}
    />
  )
}
