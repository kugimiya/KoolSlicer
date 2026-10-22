import { describe, expect, it } from 'vitest'
import { DEFAULT_BED_LAYOUT } from '@shared/types'
import type { Move, ParseResult } from '@shared/types'
import { panelCopyOffset, validateLayout, expandPanel, toMachineCoords } from './layout'
import { cloneMove } from './toolpath'
import { expectNear } from './__tests__/helpers/expectNear'

const parseStub: ParseResult = {
  polygons: [],
  boardBBox: { minX: 0, minY: 0, maxX: 10, maxY: 8 },
  warnings: []
}

describe('layout', () => {
  it('panel copy offsets', () => {
    const layout = { ...DEFAULT_BED_LAYOUT, panel: { ...DEFAULT_BED_LAYOUT.panel, columns: 2, rows: 3 } }
    const o = panelCopyOffset(layout, 10, 8, 1, 2)
    expectNear(o.x, layout.panel.marginX + 1 * (10 + layout.panel.gapX))
    expectNear(o.y, layout.panel.marginY + 2 * (8 + layout.panel.gapY))
  })

  it('blank outside work area fails validation', () => {
    const layout = {
      ...DEFAULT_BED_LAYOUT,
      workArea: { widthMm: 50, heightMm: 50 },
      blank: { widthMm: 60, heightMm: 10, offsetX: 0, offsetY: 0 }
    }
    const v = validateLayout(parseStub, layout)
    expect(v.ok).toBe(false)
  })

  it('expand panel multiplies copies', () => {
    const moves: Move[] = [
      {
        type: 'cut',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        feed: 100,
        duration: 1,
        polygonId: 0,
        passIndex: 0
      }
    ]
    const layout = { ...DEFAULT_BED_LAYOUT, panel: { ...DEFAULT_BED_LAYOUT.panel, columns: 2, rows: 3 } }
    const expanded = expandPanel(moves, layout, 10, 8, false, 3000)
    expect(expanded.length).toBe(11)
    expect(expanded.filter((m) => m.type === 'rapid').length).toBe(5)
  })

  it('inserts rapid between panel copies', () => {
    const moves: Move[] = [
      {
        type: 'cut',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        feed: 100,
        duration: 1,
        polygonId: 0,
        passIndex: 0
      }
    ]
    const layout = {
      ...DEFAULT_BED_LAYOUT,
      panel: { ...DEFAULT_BED_LAYOUT.panel, columns: 2, rows: 1, gapX: 2, marginX: 0, marginY: 0 }
    }
    const expanded = expandPanel(moves, layout, 10, 8, false, 3000)
    expect(expanded.length).toBe(3)
    expect(expanded[0].type).toBe('cut')
    expect(expanded[1].type).toBe('rapid')
    expect(expanded[1].from).toEqual({ x: 1, y: 0 })
    expect(expanded[1].to).toEqual({ x: 12, y: 0 })
    expect(expanded[2].type).toBe('cut')
  })

  it('machine coords add blank offset', () => {
    const moves = [cloneMove({
      type: 'rapid',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
      feed: 1,
      duration: 1,
      polygonId: 0,
      passIndex: 0
    }, 0, 0)]
    const out = toMachineCoords(moves, { x: 10, y: 20 })
    expectNear(out[0].to.x, 11)
    expectNear(out[0].to.y, 21)
  })
})
