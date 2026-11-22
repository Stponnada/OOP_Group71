import Link from 'next/link'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

type NavigationCard = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

export default function NavigationCards({ items, headingLevel = 2 }: { items: NavigationCard[]; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex min-h-44 flex-col gap-5 rounded-md border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-sunken text-fg-muted group-hover:bg-surface">
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <ArrowUpRight size={16} className="text-fg-subtle transition-colors group-hover:text-fg" aria-hidden="true" />
            </div>
            <div>
              <Heading className="text-body font-normal text-fg">{item.label}</Heading>
              <p className="mt-1 text-label text-fg-muted">{item.description}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
