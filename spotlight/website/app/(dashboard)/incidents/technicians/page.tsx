import Link from 'next/link'
import { buttonClass, EmptyState, Page, PageHeader } from '@/components/ui'
import { requireEmployee } from '@/lib/current-employee'
import { getItsmRoles } from '@/lib/itsm-roles'
import { isItsmError, listServices, listSkills, listTechnicians } from '@/lib/itsm-api'
import TechniciansClient from './technicians-client'

// The technician roster: who takes incidents, what they know, how much they can carry and who
// their team lead is (the first rung of escalation). Writes go through the ITSM service.

export default async function TechniciansPage() {
  const { supabase } = await requireEmployee()
  const roles = await getItsmRoles()
  if (!roles.serviceDeskAdmin) {
    return (
      <Page>
        <PageHeader title="Technicians" />
        <EmptyState
          title="The roster is managed by the service desk"
          action={
            <Link href="/incidents" className={buttonClass({ variant: 'secondary' })}>
              My incidents
            </Link>
          }
        />
      </Page>
    )
  }

  const [techRes, skillsRes, servicesRes, employeesRes] = await Promise.all([
    listTechnicians(),
    listSkills(),
    listServices(),
    supabase
      .from('employees')
      .select('id, first_name, last_name, email')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('first_name', { ascending: true }),
  ])

  if (isItsmError(techRes)) {
    return (
      <Page>
        <PageHeader title="Technicians" />
        <EmptyState tone="error" title="Roster unavailable" description={`${techRes.error}. Try again in a minute.`} />
      </Page>
    )
  }

  const employees = (employeesRes.data ?? []).map((e) => ({
    id: e.id as string,
    name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || (e.email as string),
    email: e.email as string,
  }))

  return (
    <Page>
      <TechniciansClient
        technicians={techRes.data}
        skills={isItsmError(skillsRes) ? [] : skillsRes.data}
        services={isItsmError(servicesRes) ? [] : servicesRes.data}
        employees={employees}
      />
    </Page>
  )
}
