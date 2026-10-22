import type {
  BedLayout,
  LayoutValidation,
  Move,
  ParseResult,
  Point
} from '@shared/types'
import { bboxOfPolygons, translatePoint } from './geometry'
import { appendRapid, cloneMove, totalRapidLength } from './toolpath'
import { nearestNeighborOrder } from './geometry'

export function getBoardSize(
  parse: ParseResult,
  layout: BedLayout
): { widthMm: number; heightMm: number } {
  if (layout.boardSizeOverride) return layout.boardSizeOverride
  const b = parse.boardBBox
  return { widthMm: b.maxX - b.minX, heightMm: b.maxY - b.minY }
}

/** Сдвиг board → blank local; bboxMin совмещает нижний левый bbox SVG с margin. */
export function boardAnchorOffset(parse: ParseResult, layout: BedLayout): Point {
  const b = parse.boardBBox
  if (layout.boardAnchor === 'svgOrigin') return { x: 0, y: 0 }
  return { x: -b.minX, y: -b.minY }
}

/** Точка контура SVG (mm) → machine mm, как в `generateFromParse` / `moves`. */
export function boardToMachinePoint(
  p: Point,
  parse: ParseResult,
  layout: BedLayout,
  copyCol = 0,
  copyRow = 0
): Point {
  const board = getBoardSize(parse, layout)
  const anchor = boardAnchorOffset(parse, layout)
  const off = panelCopyOffset(layout, board.widthMm, board.heightMm, copyCol, copyRow)
  return {
    x: layout.blank.offsetX + anchor.x + off.x + p.x,
    y: layout.blank.offsetY + anchor.y + off.y + p.y
  }
}

export function panelCopyOffset(
  layout: BedLayout,
  boardW: number,
  boardH: number,
  col: number,
  row: number
): Point {
  const { marginX, marginY, gapX, gapY } = layout.panel
  return {
    x: marginX + col * (boardW + gapX),
    y: marginY + row * (boardH + gapY)
  }
}

export function validateLayout(
  parse: ParseResult,
  layout: BedLayout,
  moves?: Move[]
): LayoutValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const { workArea, blank, panel } = layout
  const board = getBoardSize(parse, layout)

  if (blank.offsetX < 0 || blank.offsetY < 0) {
    errors.push('Смещение текстолита не может быть отрицательным')
  }
  if (blank.offsetX + blank.widthMm > workArea.widthMm) {
    errors.push('Текстолит выходит за рабочую область по X')
  }
  if (blank.offsetY + blank.heightMm > workArea.heightMm) {
    errors.push('Текстолит выходит за рабочую область по Y')
  }

  const copyFits: boolean[][] = []
  for (let r = 0; r < panel.rows; r++) {
    copyFits[r] = []
    for (let c = 0; c < panel.columns; c++) {
      const off = panelCopyOffset(layout, board.widthMm, board.heightMm, c, r)
      const fits =
        off.x >= 0 &&
        off.y >= 0 &&
        off.x + board.widthMm <= blank.widthMm &&
        off.y + board.heightMm <= blank.heightMm
      copyFits[r][c] = fits
      if (!fits) errors.push(`Копия col=${c} row=${r} не влезает в текстолит`)
    }
  }

  if (panel.columns * panel.rows > 100) {
    warnings.push('Более 100 копий на панели — проверьте параметры')
  }

  if (moves) {
    for (const m of moves) {
      if (m.to.x < 0 || m.to.y < 0 || m.to.x > workArea.widthMm || m.to.y > workArea.heightMm) {
        warnings.push('Траектория выходит за рабочую область станка')
        break
      }
    }
  }

  const bbox = bboxOfPolygons(parse.polygons)
  if (bbox.maxX - bbox.minX > 300 || bbox.maxY - bbox.minY > 300) {
    warnings.push('SVG больше 300 мм — проверьте масштаб')
  }

  return { ok: errors.length === 0, errors, warnings, copyFits }
}

function joinCopySequences(sequences: Move[][], rapidFeed: number): Move[] {
  const out: Move[] = []
  let cursor: Point | null = null
  const feed = { rapidFeed }

  for (const seq of sequences) {
    if (seq.length === 0) continue
    const start = seq.find((m) => m.type === 'cut')?.from ?? seq[0].from
    if (cursor !== null) {
      appendRapid(out, cursor, start, feed)
    }
    out.push(...seq)
    cursor = seq[seq.length - 1].to
  }
  return out
}

export function expandPanel(
  localMoves: Move[],
  layout: BedLayout,
  boardW: number,
  boardH: number,
  travelOptimize: boolean,
  rapidFeed: number
): Move[] {
  const { columns, rows } = layout.panel
  const copies: Move[][] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const off = panelCopyOffset(layout, boardW, boardH, c, r)
      copies.push(
        localMoves.map((m) => ({
          ...cloneMove(m, off.x, off.y),
          copyCol: c,
          copyRow: r
        }))
      )
    }
  }

  if (copies.length === 1) return copies[0]

  let sequences = copies
  if (travelOptimize) {
    const segments = copies.map((cm, idx) => ({
      idx,
      start: cm.find((m) => m.type === 'cut')?.from ?? cm[0]?.from ?? { x: 0, y: 0 }
    }))
    const ordered = nearestNeighborOrder(segments, (s) => s.start, { x: 0, y: 0 })
    sequences = ordered.map((s) => copies[s.idx])
  }

  return joinCopySequences(sequences, rapidFeed)
}

export function toMachineCoords(moves: Move[], blankOffset: Point): Move[] {
  return moves.map((m) => cloneMove(m, blankOffset.x, blankOffset.y))
}

export function layoutCopyRects(
  parse: ParseResult,
  layout: BedLayout
): { col: number; row: number; x: number; y: number; w: number; h: number; fits: boolean }[] {
  const board = getBoardSize(parse, layout)
  const anchor = boardAnchorOffset(parse, layout)
  const validation = validateLayout(parse, layout)
  const rects: { col: number; row: number; x: number; y: number; w: number; h: number; fits: boolean }[] =
    []

  for (let r = 0; r < layout.panel.rows; r++) {
    for (let c = 0; c < layout.panel.columns; c++) {
      const off = panelCopyOffset(layout, board.widthMm, board.heightMm, c, r)
      rects.push({
        col: c,
        row: r,
        // x,y — нижний левый угол копии в machine mm
        x: layout.blank.offsetX + anchor.x + off.x,
        y: layout.blank.offsetY + anchor.y + off.y,
        w: board.widthMm,
        h: board.heightMm,
        fits: validation.copyFits[r]?.[c] ?? false
      })
    }
  }
  return rects
}

export { totalRapidLength }
