import { describe, expect, it } from 'vitest'
import { DEFAULT_LASER_SETTINGS } from '@shared/types'
import type { RingPath } from '@shared/types'
import { rectPolygon } from './geometry'
import { generateScanlineFillRingsForPolygon } from './scanlineFill'
import { buildToolpathFromRings, totalRapidLength } from './toolpath'

describe('toolpath', () => {
  it('creates cut and rapid moves with duration', () => {
    const ring: RingPath = {
      points: rectPolygon(5, 5, 2, 2),
      polygonId: 0,
      passIndex: 0,
      narrow: false,
      isHole: false,
      repeatPass: 0
    }
    const settings = { ...DEFAULT_LASER_SETTINGS, travelOptimize: false }
    const moves = buildToolpathFromRings([ring], settings)
    expect(moves.some((m) => m.type === 'cut')).toBe(true)
    expect(moves.some((m) => m.type === 'rapid')).toBe(false)
    const cut = moves.find((m) => m.type === 'cut')!
    expect(cut.duration).toBeGreaterThan(0)
  })

  it('travel optimize reduces rapid length', () => {
    const rings: RingPath[] = [
      {
        points: rectPolygon(0, 0, 1, 1),
        polygonId: 0,
        passIndex: 0,
        narrow: false,
        isHole: false,
        repeatPass: 0
      },
      {
        points: rectPolygon(10, 0, 1, 1),
        polygonId: 0,
        passIndex: 1,
        narrow: false,
        isHole: false,
        repeatPass: 0
      }
    ]
    const opt = buildToolpathFromRings(rings, { ...DEFAULT_LASER_SETTINGS, travelOptimize: true })
    const plain = buildToolpathFromRings(rings, { ...DEFAULT_LASER_SETTINGS, travelOptimize: false })
    expect(totalRapidLength(opt)).toBeLessThanOrEqual(totalRapidLength(plain))
  })

  it('scan-line stripe order avoids long cross-pour rapids', () => {
    const settings = {
      ...DEFAULT_LASER_SETTINGS,
      fillStrategy: 'scanline' as const,
      beamSize: 1,
      passes: 1,
      travelOptimize: true
    }
    const rings: RingPath[] = []
    for (let line = 0; line < 10; line++) {
      const y = 20 - line
      rings.push({
        points: [
          { x: 0, y },
          { x: 4, y }
        ],
        polygonId: 0,
        passIndex: line,
        narrow: false,
        isHole: false,
        repeatPass: 0,
        closed: false,
        scanStripe: 0
      })
      rings.push({
        points: [
          { x: 16, y },
          { x: 20, y }
        ],
        polygonId: 0,
        passIndex: line,
        narrow: false,
        isHole: false,
        repeatPass: 0,
        closed: false,
        scanStripe: 1
      })
    }

    const moves = buildToolpathFromRings(rings, settings)
    const horizontalJumps = moves.filter(
      (m) =>
        m.type === 'rapid' &&
        Math.abs(m.to.y - m.from.y) < 1e-6 &&
        Math.abs(m.to.x - m.from.x) > 8
    )
    expect(horizontalJumps.length).toBe(0)
  })

  it('no long same-row rapids on U-notch pour (two arms)', () => {
    const outer = [
      { x: 0, y: 0 },
      { x: 24, y: 0 },
      { x: 24, y: 6 },
      { x: 14, y: 6 },
      { x: 12, y: 10 },
      { x: 10, y: 6 },
      { x: 0, y: 6 }
    ]
    const settings = {
      ...DEFAULT_LASER_SETTINGS,
      fillStrategy: 'scanline' as const,
      beamSize: 1,
      passes: 1,
      travelOptimize: true
    }
    const rings = generateScanlineFillRingsForPolygon(
      { id: 0, outer, holes: [], toolpathKind: 'fill' },
      settings
    )
    const moves = buildToolpathFromRings(rings, settings)
    const bad = moves.filter(
      (m) =>
        m.type === 'rapid' &&
        Math.abs(m.to.y - m.from.y) < 0.05 &&
        Math.abs(m.to.x - m.from.x) > 5
    )
    expect(bad.length).toBe(0)
  })

  it('no long same-row rapids on multi-column scan fill', () => {
    const outer = rectPolygon(0, 0, 50, 8)
    const hole = rectPolygon(22, 0, 6, 8)
    const settings = {
      ...DEFAULT_LASER_SETTINGS,
      fillStrategy: 'scanline' as const,
      beamSize: 1,
      passes: 1,
      travelOptimize: true
    }
    const rings = generateScanlineFillRingsForPolygon(
      { id: 0, outer, holes: [hole], toolpathKind: 'fill' },
      settings
    )
    const moves = buildToolpathFromRings(rings, settings)
    const bad = moves.filter(
      (m) =>
        m.type === 'rapid' &&
        Math.abs(m.to.y - m.from.y) < 0.05 &&
        Math.abs(m.to.x - m.from.x) > 5
    )
    expect(bad.length).toBe(0)
  })

  it('assigns multiple scan stripes on U-shaped fill', () => {
    const outer = rectPolygon(0, 0, 20, 20)
    const hole = rectPolygon(6, 0, 8, 20)
    const settings = {
      ...DEFAULT_LASER_SETTINGS,
      fillStrategy: 'scanline' as const,
      beamSize: 1,
      passes: 1
    }
    const rings = generateScanlineFillRingsForPolygon(
      { id: 0, outer, holes: [hole], toolpathKind: 'fill' },
      settings
    )
    const stripes = new Set(rings.map((r) => r.scanStripe))
    expect(stripes.size).toBeGreaterThanOrEqual(2)
  })
})
