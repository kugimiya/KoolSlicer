import type { BedLayout, Move, ParseResult, Point } from '@shared/types'
import type { PcbLayerSide } from '@shared/layers'

/**
 * Board/SVG mm → координаты внутри слота копии (ноль = min-угол bbox до panel offset).
 * Верх и низ используют одинаковую локальную систему: SVG низа уже зеркальный.
 * Смещение «от правого края платы» задаётся в `panelCopyOffset(..., side)`.
 */
export function boardPointToCopyLocal(
  p: Point,
  parse: ParseResult,
  _layout: BedLayout,
  _side: PcbLayerSide
): Point {
  const b = parse.boardBBox
  if (_layout.boardAnchor === 'svgOrigin') {
    return { x: p.x, y: p.y }
  }
  return { x: p.x - b.minX, y: p.y - b.minY }
}

export function anchorMovesForPcbSide(
  moves: Move[],
  parse: ParseResult,
  layout: BedLayout,
  side: PcbLayerSide
): Move[] {
  return moves.map((m) => ({
    ...m,
    from: boardPointToCopyLocal(m.from, parse, layout, side),
    to: boardPointToCopyLocal(m.to, parse, layout, side)
  }))
}
