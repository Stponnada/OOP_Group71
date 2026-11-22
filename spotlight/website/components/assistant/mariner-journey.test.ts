import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { planJourney, sampleJourney } from './mariner-journey'

const geometry = {
  home: { x: 1166, y: 810 },
  edge: { x: 1214, y: 810 },
  landing: { x: 34, y: 806 },
  ledgeEnd: { x: 258, y: 806 },
  bridgeEnd: { x: 452, y: 810 },
  viewport: { width: 1336, height: 929 },
}

test('the route leaves the floor, disappears, drops onto the sidebar, then returns home', () => {
  const journey = planJourney(geometry)
  assert.deepEqual(journey.segments.map(segment => segment.phase), [
    'edge', 'fall', 'hidden', 'drop', 'land', 'sidebar', 'cross', 'return',
  ])
  assert.deepEqual(journey.segments[0].from, geometry.home)
  const falling = journey.segments.find(segment => segment.phase === 'fall')!
  assert.ok(falling.to.y > geometry.viewport.height + 48)
  assert.equal(journey.segments.find(segment => segment.phase === 'drop')!.from.y, -72)
  assert.deepEqual(journey.segments.find(segment => segment.phase === 'drop')!.to, geometry.landing)

  let elapsed = 0
  for (const [index, segment] of journey.segments.entries()) {
    const start = sampleJourney(journey, elapsed)
    assert.equal(start.x, segment.from.x)
    assert.equal(start.y, segment.from.y)
    assert.equal(start.visible, segment.phase !== 'hidden')
    if (index > 0 && segment.phase !== 'drop') {
      assert.deepEqual(journey.segments[index - 1].to, segment.from)
    }
    elapsed += segment.duration
  }
  const finish = sampleJourney(journey, journey.duration + 1000)
  assert.equal(finish.done, true)
  assert.equal(finish.x, geometry.home.x)
  assert.equal(finish.y, geometry.home.y)
  assert.equal(finish.pose, 'idle')
  assert.equal(finish.frame, 0)
})

test('frames stay in the atlas, gravity accelerates, and the gap hop clears both ledges', () => {
  const journey = planJourney(geometry)
  let elapsed = 0
  for (const segment of journey.segments) {
    for (let local = 0; local < segment.duration; local += 16) {
      const sample = sampleJourney(journey, elapsed + local)
      assert.ok(sample.frame >= 0 && sample.frame < 16)
      assert.ok(Number.isInteger(sample.x) && Number.isInteger(sample.y))
    }
    if (segment.phase === 'drop') {
      const half = sampleJourney(journey, elapsed + segment.duration / 2)
      assert.ok(half.y < (segment.from.y + segment.to.y) / 2)
    }
    if (segment.phase === 'cross') {
      const half = sampleJourney(journey, elapsed + segment.duration / 2)
      assert.ok(half.y < Math.min(segment.from.y, segment.to.y))
    }
    elapsed += segment.duration
  }
})

test('a hidden mobile sidebar uses the left side of the composer without a phantom ledge', () => {
  const home = { x: 330, y: 720 }, landing = { x: 42, y: 720 }
  const journey = planJourney({
    home, edge: { x: 380, y: 720 }, landing, ledgeEnd: landing, bridgeEnd: landing,
    viewport: { width: 390, height: 844 },
  })
  assert.ok(!journey.segments.some(segment => segment.phase === 'sidebar' || segment.phase === 'cross'))
  const finish = sampleJourney(journey, journey.duration)
  assert.equal(finish.x, home.x)
  assert.equal(finish.y, home.y)
})
