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
    expect(text).toContain('G1 X5.000 Y2.000 F500')
    expect(lines[lines.length - 3]).toBe('M5')
    expect(lines[lines.length - 2]).toBe('G0 X0.000 Y0.000')
    expect(lines[lines.length - 1]).toBe('M2')
  })
})
