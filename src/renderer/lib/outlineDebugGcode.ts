import type { LaserSettings, Move, Point } from '@shared/types'
import { distance } from './geometry'
import { movesToGcode } from './gcode'

export type Bbox = { minX: number; minY: number; maxX: number; maxY: number }

/** Охватывающий прямоугольник всех cut-перемещений (machine mm). */
export function bboxFromCutMoves(moves: Move[]): Bbox | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let n = 0
  for (const m of moves) {
    if (m.type !== 'cut') continue
    for (const p of [m.from, m.to]) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
      n++
    }
  }
  if (n === 0 || !Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

function rectOutlinePoints(bb: Bbox): Point[] {
  const { minX, minY, maxX, maxY } = bb
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY }
  ]
}

/**
 * Один проход по внешнему прямоугольнику job: 5% maxS, подача rapid (для проверки позиции на столе).
 */
export function outlineDebugMoves(moves: Move[], settings: LaserSettings): Move[] | null {
  const bb = bboxFromCutMoves(moves)
  if (!bb || bb.maxX <= bb.minX || bb.maxY <= bb.minY) return null

  const power = Math.max(1, Math.round(settings.maxS * 0.05))
  const feed = settings.rapidFeed
  const corners = rectOutlinePoints(bb)
  const out: Move[] = []

  const start = corners[0]
  out.push({
    type: 'rapid',
    from: { ...start },
    to: start,
    feed,
    duration: 0,
    polygonId: -1,
    passIndex: -1
  })

  let from = start
  for (let i = 1; i < corners.length; i++) {
    const to = corners[i]
    const len = distance(from, to)
    out.push({
      type: 'cut',
      from,
      to,
      power,
      feed,
      duration: len > 0 ? len / (feed / 60) : 0,
      polygonId: -1,
      passIndex: -1
    })
    from = to
  }

  return out
}

export function outlineDebugGcode(moves: Move[], settings: LaserSettings): string | null {
  const outline = outlineDebugMoves(moves, settings)
  if (!outline) return null
  return movesToGcode(outline, settings).text
}
