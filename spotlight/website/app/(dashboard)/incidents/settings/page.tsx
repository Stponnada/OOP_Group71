import Link from 'next/link'
import { buttonClass, EmptyState, Page, PageHeader, Panel, Tabs } from '@/components/ui'
import { getItsmRoles } from '@/lib/itsm-roles'
import { getAssignmentSettings, isItsmError, listCategories, listServices, listSkills, listSlaProfiles } from '@/lib/itsm-api'
import { CategoriesTab, ServicesTab, SlaTab, StrategyTab } from './settings-client'

// Service-desk configuration: the catalog people report against, the SLA targets the clock uses
// and the strategy that picks a technician. Every change is audited by the ITSM service.

export default async function ServiceSettingsPage() {
  const roles = await getItsmRoles()
  if (!roles.serviceDeskAdmin) {
    return (
      <Page>
        <PageHeader title="Service settings" />
        <EmptyState
          title="Settings are managed by the service desk"
          action={
            <Link href="/incidents" className={buttonClass({ variant: 'secondary' })}>
              My incidents
            </Link>
          }
        />
      </Page>
    )
  }

  const [servicesRes, categoriesRes, skillsRes, slaRes, strategyRes] = await Promise.all([
    listServices(true),
    listCategories(true),
    listSkills(),
    listSlaProfiles(),
    getAssignmentSettings(),
  ])

  if (isItsmError(servicesRes)) {
    return (
      <Page>
        <PageHeader title="Service settings" />
        <EmptyState tone="error" title="Settings unavailable" description={`${servicesRes.error}. Try again in a minute.`} />
      </Page>
    )
  }

  const categories = isItsmError(categoriesRes) ? [] : categoriesRes.data
  const skills = isItsmError(skillsRes) ? [] : skillsRes.data
  const profiles = isItsmError(slaRes) ? [] : slaRes.data
  const strategy = isItsmError(strategyRes) ? null : strategyRes.data

  return (
    <Page>
      <PageHeader title="Service settings" subtitle="What people can report against, how fast each priority must be handled, and how technicians are picked." />
      <Panel>
        <Tabs
          label="Settings"
          tabs={[
            {
              id: 'services',
              label: 'Services',
              count: servicesRes.data.length,
              content: <ServicesTab services={servicesRes.data} categories={categories} skills={skills} profiles={profiles} />,
            },
            { id: 'categories', label: 'Categories', count: categories.length, content: <CategoriesTab categories={categories} /> },
            { id: 'sla', label: 'SLA policies', count: profiles.length, content: <SlaTab profiles={profiles} /> },
            { id: 'assignment', label: 'Assignment', content: <StrategyTab settings={strategy} /> },
          ]}
        />
      </Panel>
    </Page>
  )
}
