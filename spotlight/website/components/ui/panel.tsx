import type { ReactNode } from 'react'

type SectionHeaderProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Count shown after the title, e.g. "My Requests (3)". */
  count?: number
}

/** Section title 16/600 with an optional one-line description and actions on the right. */
export function SectionHeader({ title, description, actions, count }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-h2 font-medium text-fg">
          {title}
          {count !== undefined && <span className="ml-1.5 font-normal text-fg-muted">({count})</span>}
        </h2>
        {description && <p className="mt-0.5 text-body text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

type PanelProps = Partial<SectionHeaderProps> & {
  children: ReactNode
  /** Set false for panels whose content (e.g. a table) manages its own padding. */
  padded?: boolean
  className?: string
  id?: string
}

/** The one surface style: a clear tonal step above the ground, one radius, no shadow. */
export function Panel({ children, padded = true, className = '', id, ...header }: PanelProps) {
  const hasHeader = header.title !== undefined && header.title !== null
  return (
    <section id={id} className={`rounded-md border border-line bg-surface ${padded ? 'p-5' : ''} ${className}`}>
      {hasHeader && (
        <div className={padded ? '' : 'px-5 pt-5'}>
          <SectionHeader {...header} title={header.title as ReactNode} />
        </div>
      )}
      {children}
    </section>
  )
}
