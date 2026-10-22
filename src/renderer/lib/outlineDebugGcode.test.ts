import { describe, expect, it } from 'vitest'
import { DEFAULT_LASER_SETTINGS } from '@shared/types'
import type { Move } from '@shared/types'
import { bboxFromCutMoves, outlineDebugGcode, outlineDebugMoves } from './outlineDebugGcode'

describe('outline debug gcode', () => {
  const job: Move[] = [
    {
      type: 'cut',
      from: { x: 10, y: 20 },
      to: { x: 30, y: 20 },
      power: 800,
      feed: 500,
      duration: 1,
      polygonId: 0,
      passIndex: 0
    },
    {
      type: 'cut',
      from: { x: 30, y: 20 },
      to: { x: 30, y: 50 },
      power: 800,
      feed: 500,
      duration: 1,
      polygonId: 0,
      passIndex: 1
    }
  ]

  it('bbox from cut moves', () => {
    expect(bboxFromCutMoves(job)).toEqual({ minX: 10, minY: 20, maxX: 30, maxY: 50 })
  })

  it('outline uses 5% maxS and rapid feed', () => {
    const settings = { ...DEFAULT_LASER_SETTINGS, maxS: 1000, rapidFeed: 2400 }
    const outline = outlineDebugMoves(job, settings)!
    expect(outline.length).toBe(5)
    expect(outline.filter((m) => m.type === 'cut').every((m) => m.power === 50)).toBe(true)
    expect(outline.every((m) => m.feed === 2400)).toBe(true)
  })

  it('produces valid gcode text', () => {
    const text = outlineDebugGcode(job, DEFAULT_LASER_SETTINGS)
    expect(text).toContain('G21')
    expect(text).toContain('M3 S50')
    expect(text).toMatch(/G1 X10\.000 Y20\.000/)
    expect(text).toMatch(/G1 X30\.000 Y50\.000/)
  })
})
