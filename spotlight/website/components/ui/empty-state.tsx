import type { ReactNode } from 'react'

/**
 * What a list shows when it has nothing in it: what's missing, why it matters (optional),
 * and the next action if there is one. Also use for "couldn't load" with tone="error".
 */
export function EmptyState({
  title,
  description,
  action,
  tone = 'empty',
  compact,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  tone?: 'empty' | 'error'
  compact?: boolean
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-10'}`}
    >
      <p className={`text-body font-medium ${tone === 'error' ? 'text-danger' : 'text-fg'}`}>{title}</p>
      {description && <p className="mt-1 max-w-md text-body text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
