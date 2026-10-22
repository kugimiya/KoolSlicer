import type { SvgElementRules } from '@shared/types'

import {
  bboxOfPoints,
  differenceCompoundFromFilledClips,
  intersectionCompoundFromFilledClips,
  getClipper,
  polygonArea,
  unionPaths
} from '../geometry'

import type { BoardRef, Contour, ElementGeometry, FilledCompound, Region } from './types'

import { assertVertexBudget, filterContoursForBoard } from './validateContour'

const MIN_LAYER = 1
const MAX_LAYER = 99

function elementMode(key: string, rules: SvgElementRules): 'skip' | 'isolation' | 'fill' | 'subtract' {
  return rules[key]?.mode ?? 'skip'
}

function elementLayer(key: string, rules: SvgElementRules): number {
  const n = rules[key]?.layer ?? 1
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_LAYER, Math.max(MIN_LAYER, Math.round(n)))
}

function validLoop(path: Contour): boolean {
  return path.length >= 3 && polygonArea(path) > 1e-8
}

function bboxesOverlap(
  a: ReturnType<typeof bboxOfPoints>,
  b: ReturnType<typeof bboxOfPoints>
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

type FillPiece = { outer: Contour; holes: Contour[] }

function fillPieceBbox(piece: FillPiece): ReturnType<typeof bboxOfPoints> {
  return bboxOfPoints([...piece.outer, ...piece.holes.flat()])
}

function compoundsToFillPieces(el: ElementGeometry, board: BoardRef): FillPiece[] {
  const pieces: FillPiece[] = []
  for (const c of el.compounds) {
    const outer = filterContoursForBoard([c.outer], board)[0]
    if (!outer || !validLoop(outer)) continue
    const holes = c.holes.flatMap((h) => filterContoursForBoard([h], board)).filter(validLoop)
    pieces.push({ outer, holes })
  }
  return pieces
}

/** Заливка path или коридор stroke (offset обводки). */
function materialPiecesFromElement(el: ElementGeometry, board: BoardRef): FillPiece[] {
  const fromCompounds = compoundsToFillPieces(el, board)
  if (fromCompounds.length > 0) return fromCompounds
  return filterContoursForBoard(el.contours, board)
    .filter(validLoop)
    .map((outer) => ({ outer, holes: [] as Contour[] }))
}

function collectIsolationStrokeLoops(
  elements: ElementGeometry[],
  rules: SvgElementRules,
  board: BoardRef
): Contour[] {
  const loops: Contour[] = []
  for (const el of elements) {
    if (elementMode(el.key, rules) !== 'isolation') continue
    loops.push(...filterContoursForBoard(el.contours, board))
  }
  return loops.filter(validLoop)
}

function collectIsolationCompounds(
  elements: ElementGeometry[],
  rules: SvgElementRules,
  board: BoardRef
): FillPiece[] {
  const pieces: FillPiece[] = []
  for (const el of elements) {
    if (elementMode(el.key, rules) !== 'isolation') continue
    pieces.push(...compoundsToFillPieces(el, board))
  }
  return pieces
}

function fillElementsOnLayer(
  elements: ElementGeometry[],
  rules: SvgElementRules,
  layer: number
): ElementGeometry[] {
  return elements.filter(
    (el) => elementMode(el.key, rules) === 'fill' && elementLayer(el.key, rules) === layer
  )
}

function maxFillSubtractLayer(elements: ElementGeometry[], rules: SvgElementRules): number {
  let max = 0
  for (const el of elements) {
    const mode = elementMode(el.key, rules)
    if (mode !== 'fill' && mode !== 'subtract') continue
    max = Math.max(max, elementLayer(el.key, rules))
  }
  return max
}

function subtractInvert(key: string, rules: SvgElementRules): boolean {
  return rules[key]?.subtractInvert === true
}

async function subtractOneFromPiece(
  clipper: Awaited<ReturnType<typeof getClipper>>,
  piece: FillPiece,
  subtract: FillPiece,
  invert: boolean
): Promise<FillPiece[]> {
  if (invert) {
    const holeClips = subtract.holes
      .filter((h) => h.length >= 3)
      .map((h) => ({ outer: h, holes: [] as Contour[] }))
    if (holeClips.length === 0) return [piece]
    const diff = await differenceCompoundFromFilledClips(clipper, piece, holeClips)
    const out: FillPiece[] = []
    for (const p of diff) {
      if (p.outer.length >= 3) out.push({ outer: p.outer, holes: p.holes })
    }
    return out.length > 0 ? out : []
  }

  const out: FillPiece[] = []
  const diff = await differenceCompoundFromFilledClips(clipper, piece, [subtract])
  for (const p of diff) {
    if (p.outer.length >= 3) out.push({ outer: p.outer, holes: p.holes })
  }
  for (const h of subtract.holes) {
    if (h.length < 3) continue
    const islands = await intersectionCompoundFromFilledClips(clipper, piece, [
      { outer: h, holes: [] }
    ])
    for (const isl of islands) {
      if (isl.outer.length >= 3) out.push({ outer: isl.outer, holes: isl.holes })
    }
  }
  return out
}

async function applySubtractOnLayer(
  clipper: Awaited<ReturnType<typeof getClipper>>,
  pieces: FillPiece[],
  elements: ElementGeometry[],
  rules: SvgElementRules,
  board: BoardRef,
  layer: number
): Promise<FillPiece[]> {
  if (pieces.length === 0) return pieces

  let next = pieces
  for (const el of elements) {
    if (elementMode(el.key, rules) !== 'subtract') continue
    if (elementLayer(el.key, rules) !== layer) continue
    const invert = subtractInvert(el.key, rules)
    for (const sub of materialPiecesFromElement(el, board)) {
      const clipBbox = bboxOfPoints([...sub.outer, ...sub.holes.flat()])
      const batch: FillPiece[] = []
      for (const piece of next) {
        if (!bboxesOverlap(fillPieceBbox(piece), clipBbox)) {
          batch.push(piece)
          continue
        }
        batch.push(...(await subtractOneFromPiece(clipper, piece, sub, invert)))
      }
      next = batch
    }
  }
  return next
}

function allElementContoursForBudget(elements: ElementGeometry[], rules: SvgElementRules): Contour[] {
  const out: Contour[] = []
  for (const el of elements) {
    if (elementMode(el.key, rules) === 'skip') continue
    out.push(...el.contours)
    for (const c of el.compounds) {
      out.push(c.outer, ...c.holes)
    }
  }
  return out
}

export async function assembleRegions(
  elements: ElementGeometry[],
  board: BoardRef,
  elementRules: SvgElementRules = {}
): Promise<Region[]> {
  const isolationStrokes = collectIsolationStrokeLoops(elements, elementRules, board)
  const isolationCompounds = collectIsolationCompounds(elements, elementRules, board)
  const maxLayer = maxFillSubtractLayer(elements, elementRules)
  const hasFillOrSub = maxLayer > 0

  if (isolationStrokes.length === 0 && isolationCompounds.length === 0 && !hasFillOrSub) {
    throw new Error('Нет контуров для обработки. Проверьте SVG.')
  }

  assertVertexBudget([
    ...isolationStrokes,
    ...allElementContoursForBudget(elements, elementRules)
  ])

  const clipper = await getClipper()
  const regions: Region[] = []
  let id = 0

  for (const piece of isolationCompounds) {
    regions.push({ id: id++, ...piece, toolpathKind: 'isolation' })
  }

  if (isolationStrokes.length > 0) {
    const materialUnion = await unionPaths(clipper, isolationStrokes)
    for (const outer of materialUnion) {
      if (outer.length < 3) continue
      regions.push({ id: id++, outer, holes: [], toolpathKind: 'isolation' })
    }
  }

  let fillPieces: FillPiece[] = []

  for (let layer = MIN_LAYER; layer <= maxLayer; layer++) {
    for (const el of fillElementsOnLayer(elements, elementRules, layer)) {
      fillPieces.push(...compoundsToFillPieces(el, board))
    }

    fillPieces = await applySubtractOnLayer(
      clipper,
      fillPieces,
      elements,
      elementRules,
      board,
      layer
    )
  }

  for (const piece of fillPieces) {
    regions.push({ id: id++, ...piece, toolpathKind: 'fill' })
  }

  if (regions.length === 0) {
    throw new Error('После сборки не осталось полигонов')
  }

  return regions
}
