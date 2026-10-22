import { describe, expect, it } from 'vitest'
import { DEFAULT_LASER_SETTINGS } from '@shared/types'
import { bboxOfPoints, pointInPolygon, rectPolygon } from './geometry'
import {
  fillIntervalsAtX,
  fillIntervalsAtY,
  generateDualScanlineFillRingsForPolygon,
  generateScanlineFillRingsForPolygon
} from './scanlineFill'
import { generateRings } from './offset'

describe('scanline fill', () => {
  it('fills a rectangle with horizontal segments', () => {
    const outer = rectPolygon(0, 0, 10, 4)
    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 1, passes: 1, fillStrategy: 'scanline' as const }
    const rings = generateScanlineFillRingsForPolygon(
      { id: 0, outer, holes: [], toolpathKind: 'fill' },
      settings
    )
    expect(rings.length).toBeGreaterThan(2)
    expect(rings.every((r) => r.closed === false)).toBe(true)
    for (const r of rings) {
      expect(r.points.length).toBe(2)
      expect(Math.abs(r.points[0].y - r.points[1].y)).toBeLessThan(1e-6)
    }
  })

  it('splits scan line around a hole but keeps sweeping full height', () => {
    const outer = rectPolygon(0, 0, 20, 10)
    const hole = rectPolygon(8, 3, 4, 4)
    const yMid = 5
    const iv = fillIntervalsAtY(outer, [hole], yMid)
    expect(iv.length).toBe(2)
    expect(iv[0].x1).toBeLessThanOrEqual(8)
    expect(iv[1].x0).toBeGreaterThanOrEqual(12)

    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 1, passes: 1, fillStrategy: 'scanline' as const }
    const rings = generateScanlineFillRingsForPolygon(
      { id: 0, outer, holes: [hole], toolpathKind: 'fill' },
      settings
    )
    const ys = new Set(rings.map((r) => r.points[0].y))
    expect(ys.size).toBeGreaterThan(5)
    const throughHoleBand = rings.filter((r) => {
      const y = r.points[0].y
      return y > 3 && y < 7
    })
    expect(throughHoleBand.length).toBeGreaterThan(0)
    for (const r of throughHoleBand) {
      const x0 = Math.min(r.points[0].x, r.points[1].x)
      const x1 = Math.max(r.points[0].x, r.points[1].x)
      const mid = { x: (x0 + x1) / 2, y: r.points[0].y }
      expect(pointInPolygon(mid, hole)).toBe(false)
    }
  })

  it('even-odd at apex vertex and concave notch (no spurious bridge)', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 }
    ]
    expect(fillIntervalsAtY(tri, [], 5)).toEqual([])
    const mid = fillIntervalsAtY(tri, [], 2.5)
    expect(mid.length).toBe(1)
    expect(mid[0].x0).toBeGreaterThan(2)
    expect(mid[0].x1).toBeLessThan(8)

    const cShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 8, y: 10 },
      { x: 8, y: 3 },
      { x: 2, y: 3 },
      { x: 2, y: 10 },
      { x: 0, y: 10 }
    ]
    const iv = fillIntervalsAtY(cShape, [], 5)
    expect(iv.length).toBe(2)
    expect(iv[0].x1).toBeLessThanOrEqual(2 + 1e-6)
    expect(iv[1].x0).toBeGreaterThanOrEqual(8 - 1e-6)
  })

  it('dual scan-line produces vertical and horizontal segments', () => {
    const outer = rectPolygon(0, 0, 10, 8)
    const settings = {
      ...DEFAULT_LASER_SETTINGS,
      beamSize: 1,
      passes: 1,
      fillStrategy: 'dual-scanline' as const
    }
    const rings = generateDualScanlineFillRingsForPolygon(
      { id: 0, outer, holes: [], toolpathKind: 'fill' },
      settings
    )
    expect(rings.some((r) => r.scanAxis === 'v')).toBe(true)
    expect(rings.some((r) => r.scanAxis === 'h')).toBe(true)
    const v = rings.find((r) => r.scanAxis === 'v')!
    expect(Math.abs(v.points[0].x - v.points[1].x)).toBeLessThan(1e-6)
    const h = rings.find((r) => r.scanAxis === 'h')!
    expect(Math.abs(h.points[0].y - h.points[1].y)).toBeLessThan(1e-6)
  })

  it('fillIntervalsAtX on a rectangle', () => {
    const outer = rectPolygon(0, 0, 10, 6)
    const iv = fillIntervalsAtX(outer, [], 5)
    expect(iv.length).toBe(1)
    expect(iv[0].y1 - iv[0].y0).toBeGreaterThan(4)
  })

  it('generateRings uses scanline when fillStrategy is scanline', async () => {
    const outer = rectPolygon(0, 0, 6, 6)
    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 1, passes: 1, fillStrategy: 'scanline' as const }
    const rings = await generateRings([{ id: 0, outer, holes: [], toolpathKind: 'fill' }], settings)
    expect(rings.some((r) => r.closed === false)).toBe(true)
    const bb = bboxOfPoints(outer)
    const maxSeg = Math.max(
      ...rings.flatMap((r) =>
        r.points.length >= 2 ? [Math.abs(r.points[1].x - r.points[0].x)] : []
      )
    )
    expect(maxSeg).toBeLessThanOrEqual(bb.maxX - bb.minX + 0.01)
  })
})
