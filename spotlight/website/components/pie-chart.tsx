// Small dependency-free donut chart. No charting library exists in this
// repo (package.json has none), so this is plain SVG using stacked
// stroke-dasharray circles — same technique used for CSS conic-gradient
// pies, just as an SVG so it degrades gracefully and stays crisp at any size.

// Mid-tone hues that read on both the light and the dark ground. No near-black
// first slice (it vanished on the dark theme).
const PALETTE = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ef4444', // red-500
  '#a8a29e', // stone-400
  '#ec4899', // pink-500
]

export type PieSlice = {
  label: string
  value: number
}

interface Props {
  data: PieSlice[]
  size?: number
  thickness?: number
  valueFormatter?: (v: number) => string
  emptyLabel?: string
}

export default function PieChart({
  data,
  size = 160,
  thickness = 26,
  valueFormatter = (v) => v.toLocaleString('en-IN'),
  emptyLabel = 'No data yet',
}: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = size / 2 - thickness / 2
  const circumference = 2 * Math.PI * radius

  // Each slice's colour and starting point, computed up front (no mutation during render).
  const colored = data.map((d, i) => ({
    ...d,
    color: PALETTE[i % PALETTE.length],
    start: data.slice(0, i).reduce((sum, x) => sum + Math.max(x.value, 0), 0),
  }))

  if (total === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md bg-sunken text-body text-fg-muted">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {colored.map((slice) => {
            if (slice.value <= 0) return null
            const fraction = slice.value / total
            const dash = fraction * circumference
            const offset = -((slice.start / total) * circumference)
            return (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            )
          })}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-fg"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {valueFormatter(total)}
        </text>
      </svg>

      <div className="flex flex-col gap-1.5 min-w-[140px]">
        {colored
          .filter((d) => d.value > 0)
          .map((slice) => (
            <div key={slice.label} className="flex items-center gap-2 text-body">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden="true" />
              <span className="truncate text-fg">{slice.label}</span>
              <span className="ml-auto whitespace-nowrap pl-2 text-fg-muted">
                {valueFormatter(slice.value)} · {((slice.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
