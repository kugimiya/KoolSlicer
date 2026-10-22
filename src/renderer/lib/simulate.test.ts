import { describe, expect, it } from 'vitest'
import type { Move } from '@shared/types'
import {
  buildTimeline,
  positionAtTime,
  segmentIndexAtTime,
  travelLengthsAtTime
} from './simulate'
import { expectNear } from './__tests__/helpers/expectNear'

describe('simulate', () => {
  const moves: Move[] = [
    {
      type: 'rapid',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 0 },
      feed: 600,
      duration: 1,
      polygonId: 0,
      passIndex: 0
    },
    {
      type: 'cut',
      from: { x: 10, y: 0 },
      to: { x: 10, y: 10 },
      feed: 600,
      duration: 1,
      polygonId: 0,
      passIndex: 0
    }
  ]

  it('prefix total time', () => {
    const tl = buildTimeline(moves)
    expectNear(tl.totalTime, 2)
  })

  it('position at time mid segment', () => {
    const tl = buildTimeline(moves)
    const p = positionAtTime(tl, 0.5)
    expectNear(p.x, 5)
    expectNear(p.y, 0)
  })

  it('segment index boundaries', () => {
    const tl = buildTimeline(moves)
    expect(segmentIndexAtTime(tl, 0)).toBe(0)
    expect(segmentIndexAtTime(tl, 1.5)).toBe(1)
  })

  it('travel lengths at time', () => {
    const tl = buildTimeline(moves)
    expectNear(tl.totalCutLength, 10)
    expectNear(tl.totalTravelLength, 20)
    const midRapid = travelLengthsAtTime(tl, 0.5)
    expectNear(midRapid.cutMm, 0)
    expectNear(midRapid.travelMm, 5)
    const end = travelLengthsAtTime(tl, 2)
    expectNear(end.cutMm, 10)
    expectNear(end.travelMm, 20)
  })
})
