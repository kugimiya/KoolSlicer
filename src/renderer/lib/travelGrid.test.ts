import { describe, expect, it } from 'vitest'
import { gridCellKey, orderByGridSerpentine, orderGroupsByTravelGrid } from './travelGrid'

describe('travelGrid', () => {
  it('orders cells in serpentine rows', () => {
    const items = [
      { id: 'A', x: 1, y: 9 },
      { id: 'B', x: 11, y: 9 },
      { id: 'C', x: 1, y: 1 },
      { id: 'D', x: 11, y: 1 }
    ]
    const cell = 5
    const ordered = orderByGridSerpentine(
      items,
      (i) => ({ x: i.x, y: i.y }),
      cell
    )
    expect(ordered.map((i) => i.id)).toEqual(['A', 'B', 'D', 'C'])
  })

  it('clusters groups by cell before ordering', () => {
    const groups = [{ x: 1 }, { x: 2 }, { x: 12 }]
    const ordered = orderGroupsByTravelGrid(
      groups,
      (g) => ({ x: g.x, y: 0 }),
      5,
      { x: 0, y: 0 }
    )
    expect(ordered[0].x).toBeLessThan(5)
    expect(ordered[1].x).toBeLessThan(5)
    expect(ordered[2].x).toBeGreaterThan(10)
  })

  it('gridCellKey is stable', () => {
    expect(gridCellKey({ x: 7, y: 3 }, 5)).toBe('1:0')
  })
})
