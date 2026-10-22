import { bboxOfPoints } from '../geometry'
import type { BoardRef, Region } from './types'
import { GEO_LIMITS } from './types'

export function validateRegions(regions: Region[], board: BoardRef): void {
  if (regions.length > GEO_LIMITS.MAX_REGIONS) {
    throw new Error(
      `Слишком много полигонов (${regions.length}). Проверьте SVG или правила «−»/«∅» (лимит ${GEO_LIMITS.MAX_REGIONS}).`
    )
  }

  const allContours: typeof regions[0]['outer'][] = []
  for (const r of regions) {
    allContours.push(r.outer, ...r.holes)
  }
  assertVertexBudgetRegions(allContours)

  const bb = bboxOfPoints(regions.flatMap((r) => r.outer))
  const w = bb.maxX - bb.minX
  const h = bb.maxY - bb.minY
  if (w > board.widthMm * GEO_LIMITS.MAX_BBOX_SCALE || h > board.heightMm * GEO_LIMITS.MAX_BBOX_SCALE) {
    throw new Error(
      `BBox результата (${w.toFixed(0)}×${h.toFixed(0)} mm) не согласуется с платой (${board.widthMm.toFixed(0)}×${board.heightMm.toFixed(0)} mm).`
    )
  }
}

function assertVertexBudgetRegions(contours: { length: number }[]): void {
  let n = 0
  for (const c of contours) n += c.length
  if (n > GEO_LIMITS.MAX_TOTAL_VERTICES) {
    throw new Error(`Слишком много вершин после сборки (${n}).`)
  }
}
