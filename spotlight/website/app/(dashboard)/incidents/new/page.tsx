import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/ui'
import { requireEmployee } from '@/lib/current-employee'
import { isItsmError, listCategories, listServices } from '@/lib/itsm-api'
import IncidentForm, { type CatalogCategory, type CatalogService } from './incident-form'

export default async function NewIncidentPage() {
  await requireEmployee()

  const [categoriesRes, servicesRes] = await Promise.all([listCategories(), listServices()])
  const catalogError = isItsmError(categoriesRes)
    ? categoriesRes.error
    : isItsmError(servicesRes)
      ? servicesRes.error
      : null

  const categories: CatalogCategory[] = isItsmError(categoriesRes)
    ? []
    : categoriesRes.data
        .filter((c) => c.id && c.name && c.isActive !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((c) => ({ id: c.id!, name: c.name! }))

  const services: CatalogService[] = isItsmError(servicesRes)
    ? []
    : servicesRes.data
        .filter((s) => s.id && s.name && s.isActive !== false)
        .sort((a, b) => a.name!.localeCompare(b.name!))
        .map((s) => ({ id: s.id!, name: s.name!, categoryId: s.categoryId ?? null }))

  return (
    <Page>
      <PageHeader
        title="Report an incident"
        subtitle="Tell IT what stopped working. You’ll be kept posted at every step."
        eyebrow={<Link href="/incidents" className="underline decoration-line-strong underline-offset-2">← My incidents</Link>}
      />
      <Panel>
        <IncidentForm categories={categories} services={services} catalogError={catalogError} />
      </Panel>
    </Page>
  )
}
