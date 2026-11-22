import motion from './mariner-motion.json'

export type Point = { x: number; y: number }
export type JourneyPose = 'idle' | 'walk' | 'hop'
type Phase = 'edge' | 'fall' | 'hidden' | 'drop' | 'land' | 'sidebar' | 'cross' | 'return'
type Segment = {
  phase: Phase
  from: Point
  to: Point
  duration: number
  pose: JourneyPose
  arc?: number
}
export type Journey = { segments: Segment[]; duration: number }
export type JourneySample = Point & {
  phase: Phase
  pose: JourneyPose
  frame: number
  rotation: number
  visible: boolean
  done: boolean
}

/** All coordinates describe the turtle's feet, measured in viewport pixels. */
export function planJourney({ home, edge, landing, ledgeEnd, bridgeEnd, viewport }: {
  home: Point
  edge: Point
  landing: Point
  ledgeEnd: Point
  bridgeEnd: Point
  viewport: { width: number; height: number }
}): Journey {
  const segments: Segment[] = []
  function add(phase: Phase, from: Point, to: Point, duration: number, pose: JourneyPose, arc?: number) {
    segments.push({ phase, from, to, duration, pose, arc })
  }
  function walk(phase: Phase, from: Point, to: Point, speed: number) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    if (distance > 0) add(phase, from, to, Math.max(80, distance / speed * 1000), 'walk')
  }

  walk('edge', home, edge, 65)
  const offscreen = { x: Math.min(viewport.width + 48, edge.x + 42), y: viewport.height + 96 }
  add('fall', edge, offscreen, 650, 'hop')
  add('hidden', offscreen, offscreen, 220, 'idle')
  add('drop', { x: landing.x, y: -72 }, landing, 900, 'idle')
  add('land', landing, landing, 220, 'idle', 5)
  walk('sidebar', landing, ledgeEnd, 85)
  if (Math.hypot(bridgeEnd.x - ledgeEnd.x, bridgeEnd.y - ledgeEnd.y) > 1) {
    add('cross', ledgeEnd, bridgeEnd, 650, 'hop', 24)
  }
  walk('return', bridgeEnd, home, 95)
  return { segments, duration: segments.reduce((sum, segment) => sum + segment.duration, 0) }
}

export function sampleJourney(journey: Journey, elapsed: number): JourneySample {
  let remaining = Math.max(0, elapsed)
  let segment = journey.segments[journey.segments.length - 1]
  for (const candidate of journey.segments) {
    segment = candidate
    if (remaining < candidate.duration) break
    remaining -= candidate.duration
  }
  const done = elapsed >= journey.duration
  const progress = done ? 1 : Math.min(1, remaining / segment.duration)
  const gravity = segment.phase === 'fall' || segment.phase === 'drop'
  const yProgress = gravity ? progress * progress : progress
  const distance = Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y)
  let frame = 0
  if (segment.pose === 'walk') {
    // The approved two-foot stride covers ten display pixels per cycle.
    frame = Math.floor(distance * progress / 10 * 16) % 16
  } else if (segment.pose === 'hop') {
    if (segment.phase === 'fall') frame = 6
    else {
      const durations = motion.hop.durations
      let local = progress * durations.reduce((sum, hold) => sum + hold, 0)
      while (frame < durations.length - 1 && local >= durations[frame]) local -= durations[frame++]
    }
  }
  return {
    x: Math.round(segment.from.x + (segment.to.x - segment.from.x) * progress),
    y: Math.round(segment.from.y + (segment.to.y - segment.from.y) * yProgress - Math.sin(Math.PI * progress) * (segment.arc || 0)),
    phase: segment.phase,
    pose: done ? 'idle' : segment.pose,
    frame: done ? 0 : frame,
    rotation: segment.phase === 'fall' ? Math.round(progress * 5) * 15 : 0,
    visible: segment.phase !== 'hidden',
    done,
  }
}
