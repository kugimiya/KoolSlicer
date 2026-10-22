import { describe, expect, it } from 'vitest'
import {
  bboxOfPoints,
  differenceToPolygons,
  fromClipper,
  getClipper,
  nearestNeighborOrder,
  polygonArea,
  rectPolygon,
  toClipper
} from './geometry'
import { expectNear } from './__tests__/helpers/expectNear'

describe('geometry', () => {
  it('clipper round-trip', () => {
    const p = { x: 1.234, y: 5.678 }
    const back = fromClipper(toClipper(p))
    expectNear(back.x, p.x, 0.001)
    expectNear(back.y, p.y, 0.001)
  })

  it('polygon area rect', () => {
    expectNear(polygonArea(rectPolygon(0, 0, 2, 0.2)), 0.4, 1e-6)
  })

  it('bbox', () => {
    const b = bboxOfPoints(rectPolygon(1, 2, 3, 4))
    expect(b.minX).toBe(1)
    expect(b.minY).toBe(2)
    expect(b.maxX).toBe(4)
    expect(b.maxY).toBe(6)
  })

  it('difference paths', async () => {
    const clipper = await getClipper()
    const outer = rectPolygon(0, 0, 10, 10)
    const inner = rectPolygon(3, 3, 4, 4)
    const result = await differenceToPolygons(clipper, [outer], [inner])
    expect(result.length).toBe(1)
    const outerArea = polygonArea(result[0].outer)
    const holesArea = result[0].holes.reduce((s, h) => s + polygonArea(h), 0)
    expectNear(outerArea - holesArea, 84, 0.5)
  })

  it('difference many disjoint subjects keeps board hole', async () => {
    const clipper = await getClipper()
    const board = rectPolygon(0, 0, 10, 10)
    const hole = rectPolygon(3, 3, 4, 4)
    const pads: ReturnType<typeof rectPolygon>[] = []
    for (let i = 0; i < 20; i++) {
      pads.push(rectPolygon(20 + i, 20 + i, 1, 1))
    }
    const single = await differenceToPolygons(clipper, [board], [hole])
    const many = await differenceToPolygons(clipper, [board, ...pads], [hole])
    const singleArea =
      polygonArea(single[0].outer) -
      single[0].holes.reduce((s, h) => s + polygonArea(h), 0)
    const boardPoly = many.find((p) => polygonArea(p.outer) > 50)
    expect(boardPoly).toBeTruthy()
    const manyArea =
      polygonArea(boardPoly!.outer) -
      boardPoly!.holes.reduce((s, h) => s + polygonArea(h), 0)
    expectNear(manyArea, singleArea, 0.5)
    expect(many.length).toBeGreaterThan(20)
  })

  it('nearest neighbor', () => {
    const items = [
      { id: 'a', p: { x: 10, y: 0 } },
      { id: 'b', p: { x: 1, y: 0 } },
      { id: 'c', p: { x: 2, y: 0 } }
    ]
    const ordered = nearestNeighborOrder(items, (i) => i.p, { x: 0, y: 0 })
    expect(ordered.map((o) => o.id)).toEqual(['b', 'c', 'a'])
  })
})
