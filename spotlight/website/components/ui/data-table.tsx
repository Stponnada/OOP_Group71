import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * Table primitives. Every table in the app uses these so headers, cell padding, text
 * strengths and row rhythm match. Wraps in a horizontal scroller on narrow screens.
 */
export function Table({ children, caption, minWidth = 640 }: { children: ReactNode; caption?: string; minWidth?: number }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-left text-body" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line">{children}</tr>
    </thead>
  )
}

export function Th({ children, className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={`py-2.5 pr-4 text-label font-medium text-fg-muted whitespace-nowrap ${className}`} {...props}>
      {children}
    </th>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`align-top ${className}`}>{children}</tr>
}

/** `muted` for secondary columns (dates, metadata); `nowrap` for IDs, dates and amounts. */
export function Td({
  children,
  muted,
  nowrap,
  className = '',
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { muted?: boolean; nowrap?: boolean }) {
  return (
    <td
      className={`py-3 pr-4 ${muted ? 'text-fg-muted' : 'text-fg'} ${nowrap ? 'whitespace-nowrap' : ''} ${className}`}
      {...props}
    >
      {children}
    </td>
  )
}

/**
 * The control for an expandable row: a real button (keyboard and screen-reader operable)
 * with aria-expanded. Put it in the row's first cell instead of an onClick on <tr>.
 */
export function RowToggle({
  expanded,
  onToggle,
  controls,
  children,
}: {
  expanded: boolean
  onToggle: () => void
  /** id of the expanded detail region */
  controls?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      className="inline-flex items-center gap-1.5 rounded-sm font-medium text-fg whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <ChevronRight
        size={14}
        aria-hidden="true"
        className={`shrink-0 text-fg-subtle transition-transform ${expanded ? 'rotate-90' : ''}`}
      />
      {children}
    </button>
  )
}

/** Detail area under an expanded row: indented with a left hairline, not another card. */
export function RowDetail({ id, colSpan, children }: { id?: string; colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td id={id} colSpan={colSpan} className="pb-4 pr-4">
        <div className="ml-2 border-l border-line pl-5">{children}</div>
      </td>
    </tr>
  )
}
