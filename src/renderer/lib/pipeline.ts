import type { BedLayout, LaserSettings, Move, ParseResult } from '@shared/types'
import type { BoardRef } from './geo/types'
import { generateRingsFromRegions } from './geo/toolpathRegions'
import { buildToolpathFromRings } from './toolpath'
import { boardAnchorOffset, expandPanel, getBoardSize, toMachineCoords, validateLayout } from './layout'
import { cloneMove } from './toolpath'
import { movesToGcode } from './gcode'
import { buildTimeline, type SimulationTimeline } from './simulate'

export type GenerateResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
  moves: Move[]
  gcode: string
  gcodeLines: string[]
  timeline: SimulationTimeline
  ringsCount: number
}

export async function generateFromParse(
  parse: ParseResult,
  settings: LaserSettings,
  layout: BedLayout,
  boardRef?: BoardRef | null
): Promise<GenerateResult> {
  const validation = validateLayout(parse, layout)
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
      moves: [],
      gcode: '',
      gcodeLines: [],
      timeline: buildTimeline([]),
      ringsCount: 0
    }
  }

  const regions = parse.polygons.map((p) => ({
    id: p.id,
    outer: p.outer,
    holes: p.holes,
    toolpathKind: p.toolpathKind
  }))

  const ref: BoardRef = boardRef ?? {
    minX: parse.boardBBox.minX,
    minY: parse.boardBBox.minY,
    maxX: parse.boardBBox.maxX,
    maxY: parse.boardBBox.maxY,
    widthMm: parse.boardBBox.maxX - parse.boardBBox.minX,
    heightMm: parse.boardBBox.maxY - parse.boardBBox.minY
  }
  const rings = await generateRingsFromRegions(regions, settings, ref)
  let localMoves = buildToolpathFromRings(rings, settings)

  const anchor = boardAnchorOffset(parse, layout)
  localMoves = localMoves.map((m) => cloneMove(m, anchor.x, anchor.y))

  const board = getBoardSize(parse, layout)
  let moves = expandPanel(
    localMoves,
    layout,
    board.widthMm,
    board.heightMm,
    settings.travelOptimize,
    settings.rapidFeed
  )
  moves = toMachineCoords(moves, { x: layout.blank.offsetX, y: layout.blank.offsetY })

  const postValidation = validateLayout(parse, layout, moves)
  const { text, lines } = movesToGcode(moves, settings)

  return {
    ok: postValidation.ok,
    errors: postValidation.errors,
    warnings: [...validation.warnings, ...postValidation.warnings],
    moves,
    gcode: text,
    gcodeLines: lines,
    timeline: buildTimeline(moves),
    ringsCount: rings.length
  }
}
