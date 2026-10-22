import type { Point } from '@shared/types'
import { bboxOfPoints, polygonArea } from '../geometry'
import type { BoardRef, Contour } from './types'
import { GEO_LIMITS, MIN_CONTOUR_AREA_MM2 } from './types'

function bboxesOverlap(
  a: ReturnType<typeof bboxOfPoints>,
  b: ReturnType<typeof bboxOfPoints>
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

function expandBoard(board: BoardRef, marginMm: number): ReturnType<typeof bboxOfPoints> {
  return {
    minX: board.minX - marginMm,
    minY: board.minY - marginMm,
    maxX: board.maxX + marginMm,
    maxY: board.maxY + marginMm
  }
}

/** Отбрасывает битые/слишком большие контуры до boolean ops. */
export function filterContoursForBoard(contours: Contour[], board: BoardRef): Contour[] {
  const boardBox = expandBoard(board, GEO_LIMITS.BOARD_MARGIN_MM)
  const maxW = board.widthMm * GEO_LIMITS.MAX_BBOX_SCALE
  const maxH = board.heightMm * GEO_LIMITS.MAX_BBOX_SCALE
  const out: Contour[] = []

  for (const path of contours) {
    if (path.length < 3) continue
    if (path.length > GEO_LIMITS.MAX_VERTICES_PER_CONTOUR) continue
    if (polygonArea(path) < MIN_CONTOUR_AREA_MM2) continue
    const bb = bboxOfPoints(path)
    const w = bb.maxX - bb.minX
    const h = bb.maxY - bb.minY
    if (w > maxW || h > maxH) continue
    if (!bboxesOverlap(bb, boardBox)) continue
    out.push(path)
  }

  return out
}

export function countVertices(contours: Contour[]): number {
  let n = 0
  for (const c of contours) n += c.length
  return n
}

export function assertVertexBudget(contours: Contour[]): void {
  const n = countVertices(contours)
  if (n > GEO_LIMITS.MAX_TOTAL_VERTICES) {
    throw new Error(
      `Слишком много вершин в SVG (${n}). Упростите файл или уменьшите детализацию кривых.`
    )
  }
}
