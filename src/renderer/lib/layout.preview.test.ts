import { describe, expect, it } from 'vitest'
import { DEFAULT_BED_LAYOUT } from '@shared/types'
import { boardAnchorOffset, boardToMachinePoint } from './layout'
import type { ParseResult } from '@shared/types'

describe('boardAnchorOffset', () => {
  it('non-zero when PCB inset in viewBox', () => {
    const parse: ParseResult = {
      polygons: [{ id: 0, outer: [{ x: 25, y: 30 }, { x: 75, y: 30 }, { x: 75, y: 80 }, { x: 25, y: 80 }], holes: [] }],
      boardBBox: { minX: 25, minY: 30, maxX: 75, maxY: 80 },
      warnings: []
    }
    const anchor = boardAnchorOffset(parse, DEFAULT_BED_LAYOUT)
    expect(anchor.x).toBe(-25)
    expect(anchor.y).toBe(-30)
  })

  it('boardToMachinePoint matches anchor + blank + panel margin', () => {
    const parse: ParseResult = {
      polygons: [{ id: 0, outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], holes: [] }],
      boardBBox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      warnings: []
    }
    const m = boardToMachinePoint({ x: 3, y: 4 }, parse, DEFAULT_BED_LAYOUT)
    expect(m.x).toBe(DEFAULT_BED_LAYOUT.blank.offsetX + DEFAULT_BED_LAYOUT.panel.marginX + 3)
    expect(m.y).toBe(DEFAULT_BED_LAYOUT.blank.offsetY + DEFAULT_BED_LAYOUT.panel.marginY + 4)
  })
})
