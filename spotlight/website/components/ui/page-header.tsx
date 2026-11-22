import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: ReactNode
  /** One plain sentence under the title. Navigation links ("View reports →") can go here too. */
  subtitle?: ReactNode
  /** At most one primary and one secondary action. */
  actions?: ReactNode
  /** Optional small line above the title, e.g. a back link. */
  eyebrow?: ReactNode
}

/** Page titles: 24px, medium. Big enough to anchor the page without shouting over its content. */
export function PageHeader({ title, subtitle, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 max-w-full">
        {eyebrow && <div className="mb-4 text-label text-fg-muted">{eyebrow}</div>}
        <h1 className="break-words text-h1 font-medium tracking-tight text-balance text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Page width and vertical rhythm (24px between header and sections), so every page starts at the same left edge.
 *  Always wrap PageHeader in Page. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-6xl space-y-6">{children}</div>
}
