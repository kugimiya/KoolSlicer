import { describe, expect, it } from 'vitest'
import { DEFAULT_LASER_SETTINGS } from '@shared/types'
import type { Move } from '@shared/types'
import { movesToGcode } from './gcode'

describe('gcode', () => {
  it('header footer and formatting', () => {
    const moves: Move[] = [
      {
        type: 'rapid',
        from: { x: 0, y: 0 },
        to: { x: 5, y: 0 },
        feed: 3000,
        duration: 0.1,
        polygonId: 0,
        passIndex: 0
      },
      {
        type: 'cut',
        from: { x: 5, y: 0 },
        to: { x: 5, y: 2 },
        power: 500,
        feed: 500,
        duration: 0.24,
        polygonId: 0,
        passIndex: 0
      }
    ]
    const { lines, text } = movesToGcode(moves, DEFAULT_LASER_SETTINGS)
    expect(lines[0]).toBe('G21')
    expect(lines[1]).toBe('G90')
    expect(lines[2]).toBe('G94')
    expect(lines[3]).toBe('M5')
    expect(lines[4]).toBe('G28 X0 Y0')
    expect(text).toContain('G1 X5.000 Y2.000 F500')
    expect(lines[lines.length - 3]).toBe('M5')
    expect(lines[lines.length - 2]).toBe('G0 X0.000 Y0.000')
    expect(lines[lines.length - 1]).toBe('M2')
  })

  it('homes then G0 to first cut start before M3', () => {
    const moves: Move[] = [
      {
        type: 'cut',
        from: { x: 2.175, y: 14.064 },
        to: { x: 2.5, y: 14.064 },
        power: 800,
        feed: 500,
        duration: 0.1,
        polygonId: 0,
        passIndex: 0
      }
    ]
    const { lines } = movesToGcode(moves, DEFAULT_LASER_SETTINGS)
    expect(lines.slice(0, 6)).toEqual([
      'G21',
      'G90',
      'G94',
      'M5',
      'G28 X0 Y0',
      'G0 X2.175 Y14.064'
    ])
    expect(lines[6]).toMatch(/^M3/)
    expect(lines[7]).toMatch(/^G1 X2\.500/)
    expect(lines.some((l) => l === 'G1 X2.175 Y14.064 F500')).toBe(false)
  })
})
