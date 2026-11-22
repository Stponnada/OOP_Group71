import { z } from 'zod'
import { addIssueNote, fileIssue } from '@/lib/issues'
import { ownUploadPath } from '../uploads'
import { ISSUE_STATUSES, ISSUE_STATUS_LABEL } from '@/lib/issue-status'
import { updateIssue } from '@/app/(dashboard)/issues/actions'
import { defineCapability, type AgentContext } from '../types'
import { fields } from '../preview'

// Problems with Spotlight itself. Anyone can report one; Engineering superusers triage them.

const anyEmployee = () => true
const engineering = (ctx: AgentContext) => ctx.isEngineeringSuperuser

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export const issueCapabilities = [
  defineCapability({
    name: 'report_issue',
    module: 'Reporting a problem with Spotlight',
    risk: 'write',
    description: 'Files a report for the engineering team: a bug or problem with Spotlight, or an idea for an improvement or feature.',
    skill:
      "`report_issue`: when the user says something in Spotlight is broken, wrong, slow or confusing, or suggests an improvement or a new feature, offer to report it, or report it straight away if they ask. For an idea, start the description with \"Suggestion:\" and say what they want and why. Write the description in their words plus what you learned: what they did, what they expected, what happened. Leave out `pagePath` to use the page they're on now; set it only if they name a different page. If they attached a screenshot, pass its `screenshotUploadId` and use what it shows in the description. If they want to add to something they already reported (a clarification, a screenshot), use `add_to_issue_report` instead of filing a new one. This is for bugs in Spotlight itself. A problem with an IT service (VPN, email, a laptop, an app the company runs) is an incident: use `report_incident` for that. Questions you can answer need no report. Afterwards, tell them Engineering will see it and they'll get a notification when it's sorted.",
    input: z.object({
      description: z.string().min(1).max(4000).describe('What went wrong, in plain words.'),
      pagePath: z.string().max(500).optional().describe('An in-app path like /incidents, only if not the current page.'),
      screenshotUploadId: z.string().nullable().default(null).describe('uploadId of a screenshot the user attached'),
    }),
    allowed: anyEmployee,
    preview: (input, ctx) => ({
      kind: 'issue',
      title: 'Report an issue',
      done: 'Issue reported',
      fields: fields(['Problem', clip(input.description, 400), true], ['Page', input.pagePath ?? ctx.currentPage], ['Screenshot', input.screenshotUploadId ? 'Attached from the chat' : null], ['Goes to', 'Engineering']),
    }),
    run: async (ctx, { description, pagePath, screenshotUploadId }) => {
      // A screenshot that can't be found shouldn't sink the report: file it without, and say so.
      const screenshotPath = screenshotUploadId ? await ownUploadPath(ctx, screenshotUploadId) : null
      const res = await fileIssue(ctx.supabase, ctx.employeeId, {
        description,
        pagePath: pagePath ?? ctx.currentPage,
        source: 'mariner',
        screenshotPath,
      })
      if ('error' in res) return res
      return screenshotUploadId && !screenshotPath
        ? { reported: true, note: 'Filed without the screenshot: it could not be found. They can add it with add_to_issue_report.' }
        : { reported: true }
    },
  }),

  defineCapability({
    name: 'list_my_reported_issues',
    module: 'Reporting a problem with Spotlight',
    risk: 'read',
    description: "The reports the user has filed, newest first, with their status and any follow-ups.",
    skill:
      '`list_my_reported_issues`: what the user has reported and where each stands. Use it to find the report they mean before `add_to_issue_report`.',
    input: z.object({ limit: z.number().int().min(1).max(30).default(10) }),
    allowed: anyEmployee,
    run: async (ctx, { limit }) => {
      const { data, error } = await ctx.supabase
        .from('issue_reports')
        .select('id, description, status, resolution_note, created_at, issue_report_notes(body, created_at)')
        .eq('reporter_id', ctx.employeeId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return { error: error.message }
      return {
        reports: (data ?? []).map((r) => ({
          id: r.id,
          description: clip(r.description, 300),
          status: ISSUE_STATUS_LABEL[r.status as keyof typeof ISSUE_STATUS_LABEL] ?? r.status,
          engineeringNote: r.resolution_note,
          followUps: (r.issue_report_notes ?? []).length,
          reportedAt: r.created_at,
        })),
      }
    },
  }),

  defineCapability({
    name: 'add_to_issue_report',
    module: 'Reporting a problem with Spotlight',
    risk: 'write',
    description: 'Adds a follow-up (a clarification, a screenshot) to a report the user already filed.',
    skill:
      "`add_to_issue_report`: when the user wants to add to an earlier report rather than file a new one. Find it with `list_my_reported_issues` (ask which if it's unclear), then add what they said. Pass `screenshotUploadId` if they attached a screenshot for it in this message. Only open reports can take follow-ups; for a closed one, file a new report.",
    input: z.object({
      issueId: z.string().uuid(),
      note: z.string().min(1).max(4000).describe('What to add, in their words plus what you learned.'),
      screenshotUploadId: z.string().nullable().default(null).describe('uploadId of a screenshot attached to the latest message'),
    }),
    allowed: anyEmployee,
    preview: async ({ issueId, note, screenshotUploadId }, ctx) => {
      const { data } = await ctx.supabase.from('issue_reports').select('description').eq('id', issueId).maybeSingle()
      return {
        kind: 'issue',
        title: 'Add to issue report',
        done: 'Added to issue report',
        subject: data ? clip(data.description, 80) : undefined,
        fields: fields(['Adding', clip(note, 400), true], ['Screenshot', screenshotUploadId ? 'Attached from the chat' : null]),
      }
    },
    run: async (ctx, { issueId, note, screenshotUploadId }) => {
      const screenshotPath = screenshotUploadId ? await ownUploadPath(ctx, screenshotUploadId) : null
      const res = await addIssueNote(ctx.supabase, ctx.employeeId, { issueId, body: note, screenshotPath })
      if ('error' in res) return res
      return screenshotUploadId && !screenshotPath
        ? { added: true, note: 'Added without the screenshot: it could not be found.' }
        : { added: true }
    },
  }),

  defineCapability({
    name: 'list_reported_issues',
    module: 'Reported issues',
    risk: 'read',
    description: 'Issues people have reported with Spotlight, newest first.',
    skill:
      '`list_reported_issues`: the engineering queue of problems people reported. Defaults to what is still open (open or in progress). Link people to [Reported Issues](/issues) to work through them.',
    input: z.object({
      filter: z.enum(['open', 'closed', 'all']).default('open'),
      limit: z.number().int().min(1).max(100).default(20),
    }),
    allowed: engineering,
    run: async (ctx, { filter, limit }) => {
      let q = ctx.supabase
        .from('issue_reports')
        .select('id, description, page_path, source, status, resolution_note, created_at, reporter:employees!issue_reports_reporter_id_fkey(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (filter === 'open') q = q.in('status', ['open', 'in_progress'])
      if (filter === 'closed') q = q.in('status', ['fixed', 'wont_fix'])
      const { data, error } = await q
      if (error) return { error: error.message }
      return {
        issues: (data ?? []).map((r) => {
          const p = (Array.isArray(r.reporter) ? r.reporter[0] : r.reporter) as { first_name: string; last_name: string } | null
          return {
            id: r.id,
            description: r.description,
            page: r.page_path,
            via: r.source,
            status: ISSUE_STATUS_LABEL[r.status as keyof typeof ISSUE_STATUS_LABEL] ?? r.status,
            note: r.resolution_note,
            reportedBy: p ? `${p.first_name} ${p.last_name}` : null,
            reportedAt: r.created_at,
          }
        }),
        link: '/issues',
      }
    },
  }),

  defineCapability({
    name: 'update_reported_issue',
    module: 'Reported issues',
    risk: 'write',
    description: "Moves a reported issue to a new status, with an optional note for the reporter.",
    skill:
      '`update_reported_issue`: take the issue id from `list_reported_issues`. Marking it fixed or won\'t-fix notifies the reporter with your note, so make the note something they can read.',
    input: z.object({
      issueId: z.string().uuid(),
      status: z.enum(ISSUE_STATUSES),
      note: z.string().max(2000).default(''),
    }),
    allowed: engineering,
    preview: async ({ issueId, status, note }, ctx) => {
      const { data } = await ctx.supabase.from('issue_reports').select('description').eq('id', issueId).maybeSingle()
      return {
        kind: 'issue',
        title: 'Update reported issue',
        done: 'Issue updated',
        subject: data ? clip(data.description, 80) : undefined,
        fields: fields(['Status', ISSUE_STATUS_LABEL[status], true], ['Note', note]),
      }
    },
    run: async (_ctx, { issueId, status, note }) => updateIssue(issueId, status, note),
  }),
]
