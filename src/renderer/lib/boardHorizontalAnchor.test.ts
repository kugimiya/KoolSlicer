import { describe, expect, it } from 'vitest'
import { DEFAULT_BED_LAYOUT } from '@shared/types'
import { boardPointToCopyLocal, anchorMovesForPcbSide } from './boardHorizontalAnchor'

describe('boardPointToCopyLocal', () => {
  const parse = {
    polygons: [],
    boardBBox: { minX: 10, minY: 5, maxX: 110, maxY: 55 },
    warnings: []
  }
  const layout = { ...DEFAULT_BED_LAYOUT, boardAnchor: 'bboxMin' as const }

  it('bboxMin: shifts by min corner only (no side-specific mirror in local space)', () => {
    expect(boardPointToCopyLocal({ x: 10, y: 5 }, parse, layout, 'top')).toEqual({ x: 0, y: 0 })
    expect(boardPointToCopyLocal({ x: 10, y: 5 }, parse, layout, 'bottom')).toEqual({ x: 0, y: 0 })
    expect(boardPointToCopyLocal({ x: 60, y: 20 }, parse, layout, 'top')).toEqual({ x: 50, y: 15 })
    expect(boardPointToCopyLocal({ x: 60, y: 20 }, parse, layout, 'bottom')).toEqual({ x: 50, y: 15 })
  })

  it('anchorMovesForPcbSide preserves cut geometry in copy-local coords', () => {
    const moves = [
      {
        type: 'cut' as const,
        from: { x: 20, y: 5 },
        to: { x: 30, y: 5 },
        feed: 100,
        duration: 1,
        polygonId: 0,
        passIndex: 0
      }
    ]
    const top = anchorMovesForPcbSide(moves, parse, layout, 'top')
    const bottom = anchorMovesForPcbSide(moves, parse, layout, 'bottom')
    expect(top[0].from).toEqual(bottom[0].from)
    expect(top[0].to).toEqual(bottom[0].to)
  })
})
