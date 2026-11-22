/**
 * What a pending change looks like on its confirmation card, and afterwards as a one-line record
 * in the conversation. Plain data, so the server can build it and send it alongside the stream.
 * Never put ids in here: the person confirming should see names, amounts and dates.
 */
export type ActionPreview = {
  /** Picks the card's icon. */
  kind: 'request' | 'review' | 'order' | 'approval' | 'receipt' | 'pickup' | 'collected' | 'reject' | 'cancel' | 'bill' | 'payment' | 'issue' | 'expense' | 'card' | 'stock'
  /** Imperative, for the card: "Update order". */
  title: string
  /** Past tense, for the record once it ran: "Order updated". */
  done: string
  /** The thing being changed, e.g. a request code or item, shown beside the title. */
  subject?: string
  /** Moves money or makes a decision on someone's behalf: the card says so. */
  money?: boolean
  fields: { label: string; value: string; emphasis?: boolean }[]
  /** Line items, e.g. the things in a purchase request. */
  lines?: { label: string; detail?: string }[]
}

export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

/** "2026-10-18" → "18 Oct 2026"; anything unparseable is shown as given. */
export function day(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return s
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** "ORDER_PLACED" → "Order placed". */
export const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')

/** Drops fields whose value wasn't given, so callers can list every optional field. */
export function fields(...entries: [string, string | number | null | undefined, boolean?][]): ActionPreview['fields'] {
  return entries
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([l, v, emphasis]) => ({ label: l, value: String(v), ...(emphasis && { emphasis }) }))
}
