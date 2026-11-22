import { requireEmployee } from '@/lib/current-employee'
import { Page, PageHeader } from '@/components/ui'
import PreferencesClient from './preferences-client'

export default async function PreferencesPage() {
  await requireEmployee()
  return (
    <Page>
      <PageHeader title="Settings" subtitle="How Spotlight looks and behaves for you." />
      <PreferencesClient />
    </Page>
  )
}
