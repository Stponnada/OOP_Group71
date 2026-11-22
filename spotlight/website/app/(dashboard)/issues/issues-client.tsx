'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Button, EmptyState, Field, FormMessage, Select, Tabs, Textarea } from '@/components/ui'
import { ISSUE_STATUSES, ISSUE_STATUS_LABEL, isIssueStatus, type IssueStatus } from '@/lib/issue-status'
import { createClient } from '@/lib/supabase/client'
import { UPLOAD_BUCKET } from '@/lib/agent/upload-ref'
import { updateIssue } from './actions'

export type Issue = {
  id: string
  description: string
  pagePath: string | null
  screenshotPath: string | null
  source: string
  status: string
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
  reporter: string | null
  resolver: string | null
  /** Follow-ups added after the report was filed, oldest first. */
  notes: { id: string; body: string; screenshotPath: string | null; createdAt: string; author: string | null }[]
}

const TONE: Record<IssueStatus, 'attention' | 'neutral' | 'positive'> = {
  open: 'attention',
  in_progress: 'neutral',
  fixed: 'positive',
  wont_fix: 'neutral',
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const isClosed = (s: string) => s === 'fixed' || s === 'wont_fix'

export default function IssuesClient({ issues }: { issues: Issue[] }) {
  const open = issues.filter((i) => !isClosed(i.status))
  const closed = issues.filter((i) => isClosed(i.status))

  const list = (items: Issue[], empty: string) =>
    items.length === 0 ? (
      <EmptyState title={empty} />
    ) : (
      <ul className="space-y-3">
        {items.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </ul>
    )

  return (
    <Tabs
      label="Reported issues"
      tabs={[
        { id: 'open', label: 'Open', count: open.length, content: list(open, 'Nothing open. Spotlight is behaving.') },
        { id: 'closed', label: 'Closed', count: closed.length, content: list(closed, 'Nothing closed yet.') },
      ]}
    />
  )
}

function IssueCard({ issue }: { issue: Issue }) {
  const router = useRouter()
  const status: IssueStatus = isIssueStatus(issue.status) ? issue.status : 'open'
  const [editing, setEditing] = useState(false)
  const [next, setNext] = useState<IssueStatus>(status)
  const [note, setNote] = useState(issue.resolutionNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    setError(null)
    start(async () => {
      const res = await updateIssue(issue.id, next, note)
      if ('error' in res) setError(res.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  return (
    <li className="rounded-xl border border-line bg-surface px-5 py-5 sm:px-6">
      <div className="flex items-start gap-4">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-body text-fg">{issue.description}</p>
        <Badge tone={TONE[status]}>{ISSUE_STATUS_LABEL[status]}</Badge>
      </div>

      {issue.screenshotPath && <Screenshot path={issue.screenshotPath} />}

      {issue.notes.length > 0 && (
        <ol className="mt-4 space-y-3 border-l-2 border-line pl-4" aria-label="Follow-ups">
          {issue.notes.map((n) => (
            <li key={n.id}>
              <p className="whitespace-pre-wrap break-words text-body text-fg">{n.body}</p>
              {n.screenshotPath && <Screenshot path={n.screenshotPath} />}
              <p className="mt-1 text-label text-fg-subtle">
                {n.author ?? 'Former employee'} · {when(n.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-label text-fg-muted">
        {issue.reporter ?? 'Former employee'} · {when(issue.createdAt)} · {issue.source === 'mariner' ? 'via Mariner' : 'via the sidebar'}
        {issue.pagePath && (
          <>
            {' · on '}
            <Link href={issue.pagePath} className="text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg">
              {issue.pagePath}
            </Link>
          </>
        )}
      </p>

      {issue.resolutionNote && !editing && (
        <p className="mt-3 rounded-lg bg-sunken px-3 py-2 text-body text-fg-muted">
          {issue.resolutionNote}
          {issue.resolver && issue.resolvedAt && (
            <span className="text-fg-subtle">
              {' '}
              — {issue.resolver}, {when(issue.resolvedAt)}
            </span>
          )}
        </p>
      )}

      {editing ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Field label="Status">
            <Select value={next} onChange={(e) => setNext(e.target.value as IssueStatus)} className="sm:max-w-xs">
              {ISSUE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ISSUE_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" hint={isClosed(next) ? 'The reporter sees this in their notification.' : 'Optional.'}>
            <Textarea rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={save} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => setEditing(true)}>
            Update
          </Button>
        </div>
      )}
    </li>
  )
}

/** The reporter's screenshot, through a short-lived link (storage RLS lets Engineering read it). */
function Screenshot({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    createClient()
      .storage.from(UPLOAD_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => live && setSrc(data?.signedUrl ?? null))
    return () => {
      live = false
    }
  }, [path])
  if (!src) return null
  return (
    <a href={src} target="_blank" rel="noreferrer" className="mt-3 inline-block overflow-hidden rounded-lg border border-line focus-visible:outline-2 focus-visible:outline-focus">
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed url */}
      <img src={src} alt="Screenshot from the report" className="max-h-48 max-w-full object-contain" />
    </a>
  )
}
