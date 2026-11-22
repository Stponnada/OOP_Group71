import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAccessProfile } from '@/lib/access'
import { requireEmployee } from '@/lib/current-employee'
import { getItsmRoles } from '@/lib/itsm-roles'
import { getVisibleNavCategories, getNavActionGroups } from '@/lib/nav-categories'
import NavigationCards from '@/components/navigation-cards'
import { Page, PageHeader, SectionHeader } from '@/components/ui'

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: categoryId } = await params
  const { supabase, employee } = await requireEmployee()
  const [hrProfile, itsm] = await Promise.all([getAccessProfile(supabase, employee.id), getItsmRoles()])
  const profile = { ...hrProfile, itsm }
  const category = getVisibleNavCategories(profile).find((item) => item.id === categoryId)

  // The same filtered categories drive the sidebar, Home, and direct URLs.
  if (!category) notFound()
  return (
    <Page>
      <PageHeader
        title={category.label}
        subtitle={category.description}
        eyebrow={
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-md hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            <ArrowLeft size={14} aria-hidden="true" />
            Home
          </Link>
        }
      />
      <div className="space-y-8">
        {getNavActionGroups(category).map((group) => (
          <section key={group.label} aria-label={group.label}>
            {group.label && <SectionHeader title={group.label} />}
            <NavigationCards items={group.items} headingLevel={3} />
          </section>
        ))}
      </div>
    </Page>
  )
}
