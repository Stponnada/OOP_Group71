'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import motion from './mariner-motion.json'
import { planJourney, sampleJourney, type Journey, type JourneySample } from './mariner-journey'

type Reaction = 'hop' | 'wave'
type Pose = 'idle' | Reaction

function Sprite({ pose, frame }: { pose: keyof typeof motion; frame: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-2.5 -left-5 block size-16 select-none bg-no-repeat [image-rendering:pixelated]"
      style={{
        backgroundImage: 'url(/mascot/mariner-sheet.png)',
        backgroundSize: '1024px 256px',
        backgroundPosition: `${-frame * 64}px ${-motion[pose].row * 64}px`,
      }}
    />
  )
}

/** Play the approved frames once per tap; the composer's edge remains the floor. */
export function MarinerMascot() {
  const [pose, setPose] = useState<Pose>('idle')
  const [frame, setFrame] = useState(0)
  const [nextReaction, setNextReaction] = useState<Reaction>('hop')
  const button = useRef<HTMLButtonElement>(null)
  const taps = useRef(0)
  const [journey, setJourney] = useState<Journey | null>(null)
  const [traveler, setTraveler] = useState<JourneySample | null>(null)

  useEffect(() => {
    if (!journey) return

    const activeJourney = journey
    const home = activeJourney.segments[0].from
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    let request: number
    let start: number | null = null
    function finish() {
      cancelAnimationFrame(request)
      taps.current = 0
      setJourney(null)
      setTraveler(null)
    }
    function tick(time: number) {
      start ??= time
      const sample = sampleJourney(activeJourney, time - start)
      if (sample.done) finish()
      else {
        setTraveler(sample)
        request = requestAnimationFrame(tick)
      }
    }

    function floorMoved() {
      const anchor = button.current?.getBoundingClientRect()
      if (!anchor || Math.abs(anchor.left + 22 - home.x) > 1 || Math.abs(anchor.bottom - home.y) > 1 ||
        window.innerWidth !== viewport.width || window.innerHeight !== viewport.height) finish()
    }

    request = requestAnimationFrame(tick)
    // If the floor moves, return to the real composer rather than a stale coordinate.
    window.addEventListener('resize', floorMoved)
    document.addEventListener('scroll', floorMoved, true)
    return () => {
      cancelAnimationFrame(request)
      window.removeEventListener('resize', floorMoved)
      document.removeEventListener('scroll', floorMoved, true)
    }
  }, [journey])

  useEffect(() => {
    if (pose === 'idle') return

    const { durations } = motion[pose]
    const duration = durations.reduce((sum, hold) => sum + hold, 0)
    let start: number | null = null
    let request: number

    function tick(time: number) {
      start ??= time
      const elapsed = time - start
      if (elapsed >= duration) {
        setFrame(0)
        setPose('idle')
        return
      }

      let index = 0
      let boundary = durations[0]
      while (elapsed >= boundary && index < durations.length - 1) {
        boundary += durations[++index]
      }
      setFrame(index)
      request = requestAnimationFrame(tick)
    }

    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [pose])

  function react() {
    if (journey) return
    taps.current++
    if (taps.current > 5 && button.current) {
      taps.current = 0
      // Keep the quiet alternative for people who request reduced motion.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const anchor = button.current.getBoundingClientRect()
        const composer = button.current.closest('form')!.getBoundingClientRect()
        const ledge = document.querySelector('[data-mariner-ledge]')?.getBoundingClientRect()
        const home = { x: anchor.left + 22, y: anchor.bottom }
        const sidebarVisible = ledge && ledge.right > 48 && ledge.left < window.innerWidth && ledge.width > 48
        const landing = sidebarVisible
          ? { x: Math.max(ledge.left + 22, 24), y: ledge.top + 1 }
          : { x: Math.min(home.x, composer.left + 24), y: home.y }
        const ledgeEnd = sidebarVisible
          ? { x: Math.max(landing.x, Math.min(ledge.right - 18, home.x)), y: landing.y }
          : landing
        const bridgeEnd = sidebarVisible
          ? { x: Math.max(ledgeEnd.x, Math.min(home.x, composer.left + 24)), y: home.y }
          : landing
        const plan = planJourney({
          home,
          edge: { x: composer.right + 18, y: home.y },
          landing,
          ledgeEnd,
          bridgeEnd,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        })
        setFrame(0)
        setPose('idle')
        setNextReaction('hop')
        setTraveler(sampleJourney(plan, 0))
        setJourney(plan)
        return
      }
    }
    setFrame(0)
    setPose(nextReaction)
    setNextReaction(nextReaction === 'hop' ? 'wave' : 'hop')
  }

  const label = nextReaction === 'hop' ? 'Make Mariner jump' : 'Make Mariner wave'

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        onClick={react}
        disabled={Boolean(journey)}
        className={`absolute bottom-full right-2 h-12 w-11 cursor-pointer touch-manipulation rounded-md border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${journey ? 'invisible' : ''}`}
      >
        <Sprite pose={pose} frame={frame} />
      </button>
      <span role="status" className="sr-only">{journey ? 'Mariner is taking a tumble, then walking back.' : ''}</span>
      {traveler && createPortal(<div
        aria-hidden="true"
        data-mariner-journey={traveler.phase}
        className="pointer-events-none fixed left-0 top-0 z-[60] h-12 w-11"
        style={{
          transform: `translate3d(${traveler.x - 22}px, ${traveler.y - 48}px, 0) rotate(${traveler.rotation}deg)`,
          transformOrigin: '22px 48px',
          visibility: traveler.visible ? 'visible' : 'hidden',
        }}
      >
        <Sprite pose={traveler.pose} frame={traveler.frame} />
      </div>, document.body)}
    </>
  )
}
