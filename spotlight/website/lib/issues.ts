import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { DESCRIPTION_MAX, cleanPagePath } from '@/lib/issue-status'

// ── Issues people report with Spotlight itself. Filed from the sidebar or through Mariner, both
//    via fileIssue(); Engineering superusers triage them on /issues. ───────────────────────────

/**
 * Files a report as the signed-in employee (through their own session, so RLS decides) and lets
 * every Engineering superuser know. The notification is fire-and-forget: it never fails the report.
 */
export async function fileIssue(
  supabase: SupabaseClient,
  reporterId: string,
  input: {
    description: string
    pagePath?: string | null
    source: 'form' | 'mariner'
    userAgent?: string | null
    /** A path in mariner-uploads under the reporter's own folder (RLS checks that). */
    screenshotPath?: string | null
  }
): Promise<{ id: string } | { error: string }> {
  const description = input.description.trim()
  if (!description) return { error: 'Describe the problem first.' }
  if (description.length > DESCRIPTION_MAX) return { error: `Keep it under ${DESCRIPTION_MAX} characters.` }

  const { data, error } = await supabase
    .from('issue_reports')
    .insert({
      reporter_id: reporterId,
      description,
      page_path: cleanPagePath(input.pagePath),
      source: input.source,
      user_agent: input.userAgent?.slice(0, 500) ?? null,
      screenshot_path: input.screenshotPath ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'The report could not be saved.' }

  await notifyEngineering(reporterId, data.id, description)
  return { id: data.id }
}

/**
 * Adds a follow-up to a report, as the signed-in employee (RLS: the reporter while it's open, or
 * Engineering), and lets Engineering know when it's the reporter adding.
 */
export async function addIssueNote(
  supabase: SupabaseClient,
  authorId: string,
  input: { issueId: string; body: string; screenshotPath?: string | null }
): Promise<{ id: string } | { error: string }> {
  const body = input.body.trim()
  if (!body) return { error: 'Write what to add first.' }
  if (body.length > DESCRIPTION_MAX) return { error: `Keep it under ${DESCRIPTION_MAX} characters.` }

  const { data: issue } = await supabase.from('issue_reports').select('id, reporter_id, status').eq('id', input.issueId).maybeSingle()
  if (!issue) return { error: 'That report could not be found.' }

  const { data, error } = await supabase
    .from('issue_report_notes')
    .insert({ issue_id: issue.id, author_id: authorId, body, screenshot_path: input.screenshotPath ?? null })
    .select('id')
    .single()
  if (error || !data) {
    return { error: issue.status === 'fixed' || issue.status === 'wont_fix' ? 'That report is closed. File a new one instead.' : (error?.message ?? 'The note could not be saved.') }
  }

  if (issue.reporter_id === authorId) await notifyEngineering(authorId, issue.id, body, true)
  return { id: data.id }
}

async function notifyEngineering(reporterId: string, issueId: string, description: string, followUp = false) {
  try {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('employee_roles')
      .select('employee_id, roles!inner(access_level, departments!inner(name))')
      .eq('is_active', true)
      .eq('roles.access_level', 'superuser')
      .eq('roles.departments.name', 'Engineering')
    const recipients = [...new Set((rows ?? []).map((r) => r.employee_id as string))].filter((id) => id !== reporterId)
    if (recipients.length === 0) return

    const { data: reporter } = await admin.from('employees').select('first_name, last_name').eq('id', reporterId).maybeSingle()
    const who = reporter ? `${reporter.first_name} ${reporter.last_name}`.trim() : 'Someone'
    const summary = description.length > 160 ? `${description.slice(0, 157)}…` : description

    await admin.from('notifications').insert(
      recipients.map((recipient_id) => ({
        recipient_id,
        sender_id: reporterId,
        notification_type: 'ISSUE_REPORTED',
        title: followUp ? `${who} added to an issue` : `${who} reported an issue`,
        body: summary,
        reference_table: 'issue_reports',
        reference_id: issueId,
      }))
    )
  } catch (e) {
    console.error('notifyEngineering failed:', e)
  }
}
