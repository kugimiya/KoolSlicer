import { describe, expect, it } from 'vitest'
import { DEFAULT_LASER_SETTINGS } from '@shared/types'
import { bboxContained, bboxOfPoints, distance, pointInPolygon, rectPolygon } from './geometry'
import { generateRings } from './offset'

function maxCutSegmentMm(rings: { points: { x: number; y: number }[] }[]): number {
  let max = 0
  for (const ring of rings) {
    const pts = ring.points
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length
      max = Math.max(max, distance(pts[i], pts[j]))
    }
  }
  return max
}

describe('fill rings with multiple holes', () => {
  it('no spike segments far outside board', async () => {
    const outer = rectPolygon(0, 0, 80, 60)
    const h1 = rectPolygon(20, 20, 15, 12)
    const h2 = rectPolygon(50, 35, 10, 10)
    const poly = [{ id: 0, outer, holes: [h1, h2], toolpathKind: 'fill' as const }]
    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 0.15, passes: 1 }
    const rings = await generateRings(poly, settings)
    expect(rings.length).toBeGreaterThan(10)

    const board = bboxOfPoints(outer)
    const margin = 5
    for (const ring of rings) {
      const bb = bboxOfPoints(ring.points)
      expect(bb.minX).toBeGreaterThan(board.minX - margin)
      expect(bb.minY).toBeGreaterThan(board.minY - margin)
      expect(bb.maxX).toBeLessThan(board.maxX + margin)
      expect(bb.maxY).toBeLessThan(board.maxY + margin)
    }
    expect(maxCutSegmentMm(rings)).toBeLessThanOrEqual(85)

    const outerRings = rings.filter((r) => !r.isHole)
    for (const ring of outerRings) {
      const rbb = bboxOfPoints(ring.points)
      for (const h of [h1, h2]) {
        expect(bboxContained(rbb, bboxOfPoints(h), 0.01)).toBe(false)
      }
      const pts = ring.points
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        if (Math.abs(a.y - b.y) > 0.02) continue
        const y = (a.y + b.y) / 2
        const xMin = Math.min(a.x, b.x)
        const xMax = Math.max(a.x, b.x)
        for (const hole of [h1, h2]) {
          const hb = bboxOfPoints(hole)
          const eps = 0.1
          if (y <= hb.minY + eps || y >= hb.maxY - eps) continue
          const spanInside =
            Math.min(xMax, hb.maxX - eps) - Math.max(xMin, hb.minX + eps)
          expect(spanInside).toBeLessThan(0.2)
        }
      }
    }
  })
})
