import { describe, expect, it } from 'vitest'
import { DEFAULT_BED_LAYOUT } from '@shared/types'
import type { ParseResult } from '@shared/types'
import { boardPointToCopyLocal } from './boardHorizontalAnchor'
import { boardToMachinePoint, layoutCopyRects, panelCopyOffset } from './layout'

/**
 * Root cause (fixed in pcbLayerPlacement): bottom used x_local = boardW-(maxX-p.x),
 * which equals p.x-minX — same as top. Placement must differ via panelCopyOffset(side).
 */
describe('PCB layer placement (top left vs bottom right of blank)', () => {
  const parse: ParseResult = {
    polygons: [],
    boardBBox: { minX: 0, minY: 0, maxX: 50, maxY: 30 },
    warnings: []
  }
  const layout = { ...DEFAULT_BED_LAYOUT, boardAnchor: 'bboxMin' as const }
  const boardW = 50

  it('copy-local X is identical for top and bottom (SVG already mirrored)', () => {
    const p = { x: 12, y: 7 }
    const topLocal = boardPointToCopyLocal(p, parse, layout, 'top')
    const bottomLocal = boardPointToCopyLocal(p, parse, layout, 'bottom')
    expect(topLocal).toEqual(bottomLocal)
    expect(topLocal.x).toBe(12)
    expect(topLocal.y).toBe(7)
  })

  it('panelCopyOffset places bottom copy against right inner margin of blank', () => {
    const top = panelCopyOffset(layout, boardW, 30, 0, 0, 'top')
    const bottom = panelCopyOffset(layout, boardW, 30, 0, 0, 'bottom')
    expect(top.x).toBe(layout.panel.marginX)
    expect(bottom.x).toBe(layout.blank.widthMm - layout.panel.marginX - boardW)
    expect(top.x).not.toBe(bottom.x)
  })

  it('boardToMachinePoint: same SVG point lands left vs right on blank', () => {
    const p = { x: 0, y: 0 }
    const topM = boardToMachinePoint(p, parse, layout, 0, 0, 'top')
    const bottomM = boardToMachinePoint(p, parse, layout, 0, 0, 'bottom')
    const leftEdge = layout.blank.offsetX + layout.panel.marginX
    const rightEdge = layout.blank.offsetX + layout.blank.widthMm - layout.panel.marginX - boardW
    expect(topM.x).toBeCloseTo(leftEdge, 6)
    expect(bottomM.x).toBeCloseTo(rightEdge, 6)
    expect(bottomM.x - topM.x).toBeCloseTo(layout.blank.widthMm - layout.panel.marginX * 2 - boardW, 6)
  })

  it('maxX of bbox meets right inner margin for bottom layer', () => {
    const p = { x: 50, y: 0 }
    const bottomM = boardToMachinePoint(p, parse, layout, 0, 0, 'bottom')
    const rightInner = layout.blank.offsetX + layout.blank.widthMm - layout.panel.marginX
    expect(bottomM.x).toBeCloseTo(rightInner, 6)
  })

  it('layoutCopyRects bottom-left corner is on right half of blank', () => {
    const topRect = layoutCopyRects(parse, layout, 'top')[0]
    const bottomRect = layoutCopyRects(parse, layout, 'bottom')[0]
    expect(topRect.x).toBeCloseTo(layout.blank.offsetX + layout.panel.marginX, 6)
    expect(bottomRect.x).toBeCloseTo(
      layout.blank.offsetX + layout.blank.widthMm - layout.panel.marginX - boardW,
      6
    )
    expect(bottomRect.x + bottomRect.w).toBeCloseTo(
      layout.blank.offsetX + layout.blank.widthMm - layout.panel.marginX,
      6
    )
  })
})
