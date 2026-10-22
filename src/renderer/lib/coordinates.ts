import type { Point } from '@shared/types'

/**
 * Единая система координат KoolSlicer:
 * - начало (0, 0) — **нижний левый** угол;
 * - +X вправо, +Y вверх (как G-code / станок);
 * - SVG при импорте переводится из Y-down в эту систему.
 *
 * Пробелы:
 * - machine — стол (home в нижнем левом углу рабочей области);
 * - blank — текстолит (ноль = нижний левый угол заготовки на столе);
 * - board — геометрия SVG после anchor (bbox min → 0,0 blank local).
 */
export type WorldRect = {
  /** Нижний левый угол */
  x: number
  y: number
  widthMm: number
  heightMm: number
}

export function bottomLeftToTopLeftY(yBottom: number, heightMm: number): number {
  return yBottom + heightMm
}

/** Вершины обхода CCW в мировых координатах (нижний левый → …). */
export function worldRectRing(rect: WorldRect): Point[] {
  const { x, y, widthMm, heightMm } = rect
  const yt = y + heightMm
  return [
    { x, y },
    { x: x + widthMm, y },
    { x: x + widthMm, y: yt },
    { x, y: yt }
  ]
}
