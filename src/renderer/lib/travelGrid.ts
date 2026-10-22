import type { Point } from '@shared/types'
import { distance } from './geometry'

export function travelGridCellSize(beamSize: number, travelGridMm: number): number {
  if (travelGridMm > 0) return travelGridMm
  return Math.max(beamSize * 10, 2)
}

export function gridCellIndex(p: Point, cellSize: number): { gx: number; gy: number } {
  return {
    gx: Math.floor(p.x / cellSize),
    gy: Math.floor(p.y / cellSize)
  }
}

export function gridCellKey(p: Point, cellSize: number): string {
  const { gx, gy } = gridCellIndex(p, cellSize)
  return `${gx}:${gy}`
}

/**
 * Ячейки сетки: сверху вниз, в строке — змейка (чётные строки слева направо).
 */
export function orderByGridSerpentine<T>(
  items: T[],
  anchor: (item: T) => Point,
  cellSize: number
): T[] {
  if (items.length <= 1) return [...items]

  type RowItem = { item: T; gx: number; gy: number }
  const rows = new Map<number, RowItem[]>()

  for (const item of items) {
    const p = anchor(item)
    const { gx, gy } = gridCellIndex(p, cellSize)
    const list = rows.get(gy) ?? []
    list.push({ item, gx, gy })
    rows.set(gy, list)
  }

  const rowKeys = [...rows.keys()].sort((a, b) => b - a)
  const out: T[] = []
  for (let ri = 0; ri < rowKeys.length; ri++) {
    let row = rows.get(rowKeys[ri])!
    row = [...row].sort((a, b) => a.gx - b.gx)
    if (ri % 2 === 1) row.reverse()
    out.push(...row.map((e) => e.item))
  }
  return out
}

/** Внутри одной ячейки — nearest-neighbor от текущей позиции. */
export function orderByNearestInCell<T>(
  items: T[],
  anchor: (item: T) => Point,
  start: Point
): { ordered: T[]; end: Point } {
  if (items.length === 0) return { ordered: [], end: start }
  const remaining = [...items]
  const ordered: T[] = []
  let cursor = start

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestD = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = distance(cursor, anchor(remaining[i]))
      if (d < bestD) {
        bestD = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next)
    cursor = anchor(next)
  }
  return { ordered, end: cursor }
}

/**
 * Группы якорятся в ячейках сетки; порядок ячеек — змейка, внутри ячейки — NN.
 */
export function orderGroupsByTravelGrid<T>(
  groups: T[],
  anchor: (item: T) => Point,
  cellSize: number,
  start: Point
): T[] {
  if (groups.length <= 1) return [...groups]

  const byCell = new Map<string, T[]>()
  for (const g of groups) {
    const key = gridCellKey(anchor(g), cellSize)
    const list = byCell.get(key) ?? []
    list.push(g)
    byCell.set(key, list)
  }

  const cellReps: { key: string; p: Point; items: T[] }[] = []
  for (const [key, items] of byCell) {
    const p = anchor(items[0])
    cellReps.push({ key, p, items })
  }

  const cellOrder = orderByGridSerpentine(cellReps, (c) => c.p, cellSize)
  const out: T[] = []
  let cursor = start

  for (const cell of cellOrder) {
    const { ordered, end } = orderByNearestInCell(cell.items, anchor, cursor)
    out.push(...ordered)
    cursor = end
  }
  return out
}
