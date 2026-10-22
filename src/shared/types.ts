export type Point = { x: number; y: number }



export type LaserMode = 'M3' | 'M4'

/** Заливка меди: контур, scan-line, dual (сначала вертикаль, потом горизонталь). */
export type FillStrategy = 'contour' | 'scanline' | 'dual-scanline'

export type BoardAnchor = 'svgOrigin' | 'bboxMin'



export type LaserSettings = {

  beamSize: number

  passes: number

  rapidFeed: number

  cutFeed: number

  power: number

  maxS: number

  laserMode: LaserMode

  travelOptimize: boolean

  /** Шаг сетки для travelOptimize (mm); 0 — авто (~10× beamSize). */
  travelGridMm: number

  fillStrategy: FillStrategy

  showBurnZone: boolean

}



/** offsetX/offsetY blank — нижний левый угол заготовки на столе (machine mm). */

export type BedLayout = {

  workArea: { widthMm: number; heightMm: number }

  blank: { widthMm: number; heightMm: number; offsetX: number; offsetY: number }

  panel: {

    columns: number

    rows: number

    gapX: number

    gapY: number

    marginX: number

    marginY: number

  }

  boardAnchor: BoardAnchor

  boardSizeOverride: { widthMm: number; heightMm: number } | null

}



export type PolygonToolpathKind = 'isolation' | 'fill'

export type PolygonWithHoles = {
  id: number
  outer: Point[]
  holes: Point[][]
  toolpathKind: PolygonToolpathKind
}



export type RingPath = {

  points: Point[]

  polygonId: number

  passIndex: number

  narrow: boolean

  isHole: boolean

  repeatPass: number

  /** false — открытая линия (scan-line); по умолчанию замкнутый контур. */
  closed?: boolean

  /** Вертикально связанная полоса scan-line (одна «грань» заливки). */
  scanStripe?: number

  /** Ось scan-line сегмента (dual: сначала v, потом h). */
  scanAxis?: 'h' | 'v'

}



export type Move = {

  type: 'rapid' | 'cut'

  from: Point

  to: Point

  power?: number

  feed: number

  duration: number

  polygonId: number

  passIndex: number

  narrow?: boolean

  copyCol?: number

  copyRow?: number

  gcodeLineStart?: number

  gcodeLineEnd?: number

}



export type ParseWarning = { message: string }



export type ParseResult = {

  polygons: PolygonWithHoles[]

  boardBBox: { minX: number; minY: number; maxX: number; maxY: number }

  warnings: ParseWarning[]

}



/** Режим траектории для одного SVG-элемента. */
export type SvgElementMode = 'isolation' | 'fill' | 'subtract'

export type SvgElementRule = {
  mode: SvgElementMode
  /** Слой заливки/выреза (1…99). Вырез слоя N действует на заливки слоёв 1…N. */
  layer?: number
  /**
   * Только для subtract: false — вырезать залитую область path (outer − дырки);
   * true — вырезать subpath-дырки, заливка остаётся в «поле» между ними.
   */
  subtractInvert?: boolean
}

export type SvgElementRules = Record<string, SvgElementRule>

export type SvgElementNode = {

  /** Стабильный ключ: индексный путь от корня svg, напр. `0/2/1` */

  id: string

  tag: string

  label: string

  shape: boolean

  children: SvgElementNode[]

}



export type LayoutValidation = {

  ok: boolean

  errors: string[]

  warnings: string[]

  copyFits: boolean[][]

}



export type GcodeResult = {

  text: string

  lines: string[]

}



export type KoolSlicerApi = {

  pickSvgFile: () => Promise<{ name: string; content: string } | null>

  saveGcodeFile: (defaultName: string, content: string) => Promise<boolean>

  openProjectFile: () => Promise<{ name: string; content: string } | null>

  saveProjectFile: (defaultName: string, content: string) => Promise<boolean>

}



export const DEFAULT_LASER_SETTINGS: LaserSettings = {

  beamSize: 0.1,

  passes: 1,

  rapidFeed: 3000,

  cutFeed: 500,

  power: 800,

  maxS: 1000,

  laserMode: 'M3',

  travelOptimize: true,

  travelGridMm: 0,

  fillStrategy: 'contour',

  showBurnZone: false

}



export const DEFAULT_BED_LAYOUT: BedLayout = {

  workArea: { widthMm: 300, heightMm: 200 },

  blank: { widthMm: 100, heightMm: 100, offsetX: 10, offsetY: 10 },

  panel: { columns: 1, rows: 1, gapX: 2, gapY: 2, marginX: 5, marginY: 5 },

  boardAnchor: 'bboxMin',

  boardSizeOverride: null

}


