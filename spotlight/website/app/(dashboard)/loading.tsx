// Every dashboard page is dynamic (per-user Supabase queries), and Next.js
// skips prefetching dynamic routes that have no loading boundary — so each
// sidebar click used to sit on the old page until the new one fully rendered.
// With this in place the shell stays put and this skeleton swaps in instantly
// while the page streams.
export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-5 w-48 bg-gray-100 rounded" />
        <div className="h-3 w-72 bg-gray-100 rounded" />
      </div>
      <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-3">
        <div className="h-4 w-40 bg-gray-100 rounded" />
        <div className="h-9 w-full bg-gray-50 rounded" />
        <div className="h-9 w-full bg-gray-50 rounded" />
        <div className="h-9 w-2/3 bg-gray-50 rounded" />
      </div>
    </div>
  )
}
