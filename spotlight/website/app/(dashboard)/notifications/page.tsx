import Link from 'next/link'
import { requireEmployee } from '@/lib/current-employee'
import NotificationActions from './notification-actions'
import { Badge, EmptyState, Page, PageHeader, humanizeStatus } from '@/components/ui'

export default async function NotificationsPage() {
  const { supabase, employee } = await requireEmployee()

  const empId = employee.id

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, notification_type, is_read, created_at, reference_table, reference_id')
    .eq('recipient_id', empId)
    .order('created_at', { ascending: false })

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length

  // Where a notification points, when it points at something with a page.
  const hrefFor = (table: string | null, id: string | null) => (table === 'itsm.incidents' && id ? `/incidents/${id}` : null)

  return (
    <Page>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        actions={unreadCount > 0 ? <NotificationActions employeeId={empId!} mode="mark-all" /> : undefined}
      />

      {/* Same surface as <Panel>; Panel requires a title and this list has none. */}
      <section aria-label="Notifications" className="rounded-md border border-line bg-surface">
        {!notifications || notifications.length === 0 ? (
          <EmptyState title="No notifications" description="You'll see updates about your requests and approvals here." />
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((n) => (
              <li key={n.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.is_read ? 'bg-action' : ''}`}
                    />
                    <div className="min-w-0">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <p className={`text-body text-fg ${!n.is_read ? 'font-medium' : 'font-normal'}`}>
                          {!n.is_read && <span className="sr-only">Unread: </span>}
                          {hrefFor(n.reference_table, n.reference_id) ? (
                            <Link
                              href={hrefFor(n.reference_table, n.reference_id)!}
                              className="underline decoration-line-strong underline-offset-2 hover:decoration-fg"
                            >
                              {n.title}
                            </Link>
                          ) : (
                            n.title
                          )}
                        </p>
                        {n.notification_type && (
                          <Badge tone="neutral">{humanizeStatus(n.notification_type)}</Badge>
                        )}
                      </div>
                      {n.body && <p className="text-body text-fg-muted">{n.body}</p>}
                      <p className="mt-1 text-label text-fg-muted">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!n.is_read && (
                    <NotificationActions employeeId={empId!} notificationId={n.id} mode="mark-one" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  )
}
