import { redirect } from 'next/navigation'
import { getAccessProfile, isEngineeringSuperuser } from '@/lib/access'
import { requireEmployee } from '@/lib/current-employee'
import { FormMessage, Page, PageHeader } from '@/components/ui'
import IssuesClient, { type Issue } from './issues-client'

export default async function IssuesPage() {
  const { supabase, employee } = await requireEmployee()
  if (!isEngineeringSuperuser(await getAccessProfile(supabase, employee.id))) redirect('/dashboard')

  // Read through the session: RLS lets Engineering superusers see every report.
  const { data, error } = await supabase
    .from('issue_reports')
    .select(
      'id, description, page_path, screenshot_path, source, status, resolution_note, resolved_at, created_at, reporter:employees!issue_reports_reporter_id_fkey(first_name, last_name), resolver:employees!issue_reports_resolved_by_fkey(first_name, last_name), issue_report_notes(id, body, screenshot_path, created_at, author:employees!issue_report_notes_author_id_fkey(first_name, last_name))'
    )
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) console.error('Failed to load issue reports:', error)

  const name = (e: unknown) => {
    const p = (Array.isArray(e) ? e[0] : e) as { first_name: string; last_name: string } | null
    return p ? `${p.first_name} ${p.last_name}`.trim() : null
  }
  const issues: Issue[] = (data ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    pagePath: r.page_path,
    screenshotPath: r.screenshot_path,
    source: r.source,
    status: r.status,
    resolutionNote: r.resolution_note,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    reporter: name(r.reporter),
    resolver: name(r.resolver),
    notes: [...(r.issue_report_notes ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((n) => ({ id: n.id, body: n.body, screenshotPath: n.screenshot_path, createdAt: n.created_at, author: name(n.author) })),
  }))

  return (
    <Page>
      <PageHeader title="Reported Issues" subtitle="Bugs and problems people have hit in Spotlight. Work each one to a close." />
      {error ? (
        <FormMessage tone="error">Couldn&apos;t load the reports. Try reloading the page.</FormMessage>
      ) : (
        <IssuesClient issues={issues} />
      )}
    </Page>
  )
}
