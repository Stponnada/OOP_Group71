import type { ReactNode } from 'react'

/** One stat tile style everywhere: label 12/500 muted above value 20/600. */
export function StatTile({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="min-w-28 rounded-md border border-line bg-surface p-4">
      <p className="text-label font-medium text-fg-muted">{label}</p>
      <p className="mt-1 text-h1 font-medium text-fg">{value}</p>
    </div>
  )
}

/** A wrapping row of StatTiles. */
export function StatTiles({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>
}
