'use client'

import { useId, useState } from 'react'
import type { TrendPoint } from '@/lib/itsm-types'

const W = 640
const H = 200
const PAD = { top: 12, right: 72, bottom: 24, left: 28 }

const SERIES = [
  { key: 'created', label: 'Reported', color: 'var(--series-1)' },
  { key: 'resolved', label: 'Resolved', color: 'var(--series-2)' },
] as const

function dayLabel(iso?: string) {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Reported vs resolved per day. Two lines on one count axis, direct labels at the line ends, a
 * crosshair and tooltip on hover, and the numbers as a table for anyone not reading the chart.
 */
export default function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const titleId = useId()
  const n = points.length
  const max = Math.max(1, ...points.flatMap((p) => [p.created ?? 0, p.resolved ?? 0]))
  const top = Math.max(2, Math.ceil(max / 2) * 2)
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (n <= 1 ? iw / 2 : (i * iw) / (n - 1))
  const y = (v: number) => PAD.top + ih - (v / top) * ih
  const path = (key: 'created' | 'resolved') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key] ?? 0).toFixed(1)}`).join(' ')

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const i = Math.round(((px - PAD.left) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const last = points[n - 1]
  const h = hover !== null ? points[hover] : null

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap gap-4 text-label text-fg-muted" aria-hidden="true">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-labelledby={titleId}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <title id={titleId}>
            Incidents reported and resolved per day, {dayLabel(points[0]?.day)} to {dayLabel(last?.day)}
          </title>
          {[0, top / 2, top].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-fg-muted text-[11px]">
                {v}
              </text>
            </g>
          ))}
          {[0, Math.floor((n - 1) / 2), n - 1]
            .filter((i, k, a) => i >= 0 && a.indexOf(i) === k)
            .map((i) => (
              <text
                key={i}
                x={x(i)}
                y={H - 6}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                className="fill-fg-muted text-[11px]"
              >
                {dayLabel(points[i]?.day)}
              </text>
            ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="stroke-line-strong" strokeWidth={1} />}
          {SERIES.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {last &&
            SERIES.map((s, k) => {
              const v = last[s.key] ?? 0
              const other = last[SERIES[1 - k].key] ?? 0
              // Nudge the end labels apart when the lines finish on the same value.
              const dy = v === other ? (k === 0 ? -8 : 8) : 0
              return (
                <text key={s.key} x={x(n - 1) + 8} y={y(v) + dy} dy="0.32em" className="fill-fg text-[11px]">
                  {s.label} {v}
                </text>
              )
            })}
          {h &&
            hover !== null &&
            SERIES.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(h[s.key] ?? 0)} r={4} fill={s.color} className="stroke-surface" strokeWidth={2} />
            ))}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border border-line bg-surface px-3 py-2 text-label shadow-md"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: hover > n / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
          >
            <p className="font-medium text-fg">{dayLabel(h.day)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center justify-between gap-4 text-fg">
                <span className="inline-flex items-center gap-1.5 text-fg-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                {h[s.key] ?? 0}
              </p>
            ))}
            <p className="mt-0.5 flex justify-between gap-4 text-fg">
              <span className="text-fg-muted">Breached</span>
              {h.breached ?? 0}
            </p>
          </div>
        )}
      </div>
      <details className="text-label text-fg-muted">
        <summary className="cursor-pointer">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 font-medium">Reported</th>
              <th className="py-1 font-medium">Resolved</th>
              <th className="py-1 font-medium">Breached</th>
            </tr>
          </thead>
          <tbody className="text-fg">
            {points.map((p) => (
              <tr key={p.day} className="border-t border-line">
                <td className="py-1">{dayLabel(p.day)}</td>
                <td className="py-1">{p.created ?? 0}</td>
                <td className="py-1">{p.resolved ?? 0}</td>
                <td className="py-1">{p.breached ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
