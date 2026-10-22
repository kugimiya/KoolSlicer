import type { Point, PolygonToolpathKind } from '@shared/types'

/** Ожидаемый размер платы в mm (из viewBox / width / height SVG). */
export type BoardRef = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  widthMm: number
  heightMm: number
}

export type Contour = Point[]

/** Замкнутая заливка одного SVG-shape: outer + внутренние subpath как дырки. */
export type FilledCompound = {
  outer: Contour
  holes: Contour[]
}

export type ElementGeometry = {
  key: string
  /** Открытые/обводка (stroke corridor). */
  contours: Contour[]
  /** Залитые замкнутые области (path/rect/… с fill). */
  compounds: FilledCompound[]
}

export type Region = {
  id: number
  outer: Contour
  holes: Contour[]
  toolpathKind: PolygonToolpathKind
}

export const GEO_LIMITS = {
  MAX_REGIONS: 2000,
  MAX_VERTICES_PER_CONTOUR: 50_000,
  MAX_TOTAL_VERTICES: 2_000_000,
  BOARD_MARGIN_MM: 2,
  MAX_BBOX_SCALE: 2
} as const

export const MIN_CONTOUR_AREA_MM2 = 1e-8
