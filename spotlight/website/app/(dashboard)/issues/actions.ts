'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee } from '@/lib/current-employee'
import { getAccessProfile, isEngineeringSuperuser } from '@/lib/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { fileIssue } from '@/lib/issues'
import { ISSUE_STATUS_LABEL, isIssueStatus } from '@/lib/issue-status'

type ActionResult = { success: true } | { error: string }

/** Anyone signed in can report a problem with Spotlight. */
export async function reportIssue(description: string, pagePath: string | null): Promise<ActionResult> {
  const { supabase, employee } = await getCurrentEmployee()
  if (!employee) return { error: 'Not signed in' }

  const res = await fileIssue(supabase, employee.id, {
    description,
    pagePath,
    source: 'form',
    userAgent: (await headers()).get('user-agent'),
  })
  if ('error' in res) return res
  revalidatePath('/issues')
  return { success: true }
}

/** Engineering superusers move a report along and say what happened. */
export async function updateIssue(id: string, status: string, note: string): Promise<ActionResult> {
  const { supabase, employee } = await getCurrentEmployee()
  if (!employee) return { error: 'Not signed in' }
  if (!isEngineeringSuperuser(await getAccessProfile(supabase, employee.id))) {
    return { error: 'Only Engineering superusers can update reported issues.' }
  }
  if (!isIssueStatus(status)) return { error: 'Unknown status' }

  const closed = status === 'fixed' || status === 'wont_fix'
  const { data: before } = await supabase.from('issue_reports').select('status, reporter_id, description').eq('id', id).maybeSingle()
  if (!before) return { error: 'Issue not found' }

  const { error } = await supabase
    .from('issue_reports')
    .update({
      status,
      resolution_note: note.trim().slice(0, 2000) || null,
      resolved_by: closed ? employee.id : null,
      resolved_at: closed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }

  // Close the loop with whoever reported it.
  if (closed && before.status !== status && before.reporter_id && before.reporter_id !== employee.id) {
    const summary = before.description.length > 80 ? `${before.description.slice(0, 77)}…` : before.description
    await createAdminClient()
      .from('notifications')
      .insert({
        recipient_id: before.reporter_id,
        sender_id: employee.id,
        notification_type: 'ISSUE_RESOLVED',
        title: status === 'fixed' ? 'The issue you reported is fixed' : `Your issue report: ${ISSUE_STATUS_LABEL[status]}`,
        body: [`“${summary}”`, note.trim()].filter(Boolean).join(' — '),
        reference_table: 'issue_reports',
        reference_id: id,
      })
      .then(({ error: e }) => e && console.error('issue resolved notification failed:', e.message))
  }

  revalidatePath('/issues')
  return { success: true }
}
