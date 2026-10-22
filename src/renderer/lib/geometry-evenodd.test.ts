import { describe, expect, it } from 'vitest'
import {
  differenceCompoundFromClip,
  differenceToPolygons,
  getClipper,
  pointInAnyHole,
  pointInPolygon,
  polygonArea,
  rectPolygon,
  unionPaths
} from './geometry'

describe('overlapping subtract boolean', () => {
  it('union merges overlaps and difference leaves no copper in intersection', async () => {
    const clipper = await getClipper()
    const board = rectPolygon(0, 0, 20, 20)
    const a = rectPolygon(5, 5, 8, 8)
    const b = rectPolygon(10, 10, 8, 8)
    const mid = { x: 11.5, y: 11.5 }

    const merged = await unionPaths(clipper, [a, b])
    expect(merged.length).toBe(1)

    const good = await differenceToPolygons(clipper, [board], merged)
    const fillGood = good[0]
    const holeArea = fillGood.holes.reduce((s, h) => s + polygonArea(h), 0)
    expect(holeArea).toBeCloseTo(119, 1)
    expect(pointInAnyHole(mid, fillGood.holes)).toBe(true)
    expect(fillGood.holes.some((h) => pointInPolygon(mid, h))).toBe(true)
  })

  it('differenceCompound unions clip paths before subtract', async () => {
    const clipper = await getClipper()
    const board = rectPolygon(0, 0, 20, 20)
    const a = rectPolygon(5, 5, 8, 8)
    const b = rectPolygon(10, 10, 8, 8)
    const mid = { x: 11.5, y: 11.5 }
    const result = await differenceCompoundFromClip(clipper, { outer: board, holes: [] }, [a, b])
    expect(pointInAnyHole(mid, result[0].holes)).toBe(true)
  })
})
