import type { LaserSettings, Point, PolygonWithHoles, RingPath } from '@shared/types'
import { bboxOfPoints } from './geometry'
import { assignScanColumnIds, type ScanSegment } from './scanlineStripes'

type Interval = { a0: number; a1: number }

const EPS = 1e-9

export type ScanFillAxis = 'h' | 'v'

function jitterAlongSweep(base: number, step: number, lineIndex: number): number {
  return base + step * 1e-7 * ((lineIndex % 17) + 1)
}

function collectHorizontalCrossings(path: Point[], y: number): number[] {
  const xs: number[] = []
  const n = path.length
  if (n < 3) return xs
  for (let i = 0; i < n; i++) {
    const a = path[i]
    const b = path[(i + 1) % n]
    if (Math.abs(a.y - b.y) < EPS) continue
    const yMin = Math.min(a.y, b.y)
    const yMax = Math.max(a.y, b.y)
    if (y <= yMin + EPS || y > yMax - EPS) continue
    const t = (y - a.y) / (b.y - a.y)
    xs.push(a.x + t * (b.x - a.x))
  }
  return xs
}

function collectVerticalCrossings(path: Point[], x: number): number[] {
  const ys: number[] = []
  const n = path.length
  if (n < 3) return ys
  for (let i = 0; i < n; i++) {
    const a = path[i]
    const b = path[(i + 1) % n]
    if (Math.abs(a.x - b.x) < EPS) continue
    const xMin = Math.min(a.x, b.x)
    const xMax = Math.max(a.x, b.x)
    if (x <= xMin + EPS || x > xMax - EPS) continue
    const t = (x - a.x) / (b.x - a.x)
    ys.push(a.y + t * (b.y - a.y))
  }
  return ys
}

function intervalsFromCrossings(coords: number[]): Interval[] {
  if (coords.length < 2) return []
  const sorted = [...coords].sort((a, b) => a - b)
  const out: Interval[] = []
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const a0 = sorted[i]
    const a1 = sorted[i + 1]
    if (a1 - a0 > EPS) out.push({ a0, a1 })
  }
  return out
}

function mergeIntervals(list: Interval[]): Interval[] {
  if (list.length === 0) return []
  const sorted = [...list].sort((a, b) => a.a0 - b.a0 || a.a1 - b.a1)
  const out: Interval[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const last = out[out.length - 1]
    if (cur.a0 <= last.a1 + EPS) {
      last.a1 = Math.max(last.a1, cur.a1)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

function subtractIntervals(base: Interval[], cut: Interval[]): Interval[] {
  let out = [...base]
  for (const c of cut) {
    const next: Interval[] = []
    for (const b of out) {
      if (c.a1 <= b.a0 + EPS || c.a0 >= b.a1 - EPS) {
        next.push(b)
        continue
      }
      if (c.a0 > b.a0 + EPS) next.push({ a0: b.a0, a1: c.a0 })
      if (c.a1 < b.a1 - EPS) next.push({ a0: c.a1, a1: b.a1 })
    }
    out = next
  }
  return out
}

function insetInterval(iv: Interval, inset: number): Interval | null {
  const a0 = iv.a0 + inset
  const a1 = iv.a1 - inset
  if (a1 - a0 > EPS) return { a0, a1 }
  return null
}

/** Горизонтальные интервалы меди на линии Y (outer − holes). */
export function fillIntervalsAtY(
  outer: Point[],
  holes: Point[][],
  y: number
): { x0: number; x1: number }[] {
  let fill = intervalsFromCrossings(collectHorizontalCrossings(outer, y))
  for (const h of holes) {
    fill = subtractIntervals(fill, intervalsFromCrossings(collectHorizontalCrossings(h, y)))
  }
  return mergeIntervals(fill).map((iv) => ({ x0: iv.a0, x1: iv.a1 }))
}

/** Вертикальные интервалы меди на линии X (outer − holes). */
export function fillIntervalsAtX(
  outer: Point[],
  holes: Point[][],
  x: number
): { y0: number; y1: number }[] {
  let fill = intervalsFromCrossings(collectVerticalCrossings(outer, x))
  for (const h of holes) {
    fill = subtractIntervals(fill, intervalsFromCrossings(collectVerticalCrossings(h, x)))
  }
  return mergeIntervals(fill).map((iv) => ({ y0: iv.a0, y1: iv.a1 }))
}

type PendingSeg = {
  lineIndex: number
  cross: number
  span0: number
  span1: number
  forward: boolean
}

function generateScanFillForPolygon(
  poly: PolygonWithHoles,
  settings: LaserSettings,
  axis: ScanFillAxis
): RingPath[] {
  const { id: polygonId, outer, holes } = poly
  const step = settings.beamSize
  if (step <= 0 || outer.length < 3) return []

  const half = step / 2
  const bb = bboxOfPoints(poly.outer)
  const minLen = step * 0.25
  const pending: PendingSeg[] = []
  let lineIndex = 0

  if (axis === 'h') {
    const yTop = bb.maxY - half
    const yBottom = bb.minY + half
    if (yTop <= yBottom) return []

    for (let y = yTop; y >= yBottom - EPS; y -= step, lineIndex++) {
      const yScan = jitterAlongSweep(y, step, lineIndex)
      const raw = fillIntervalsAtY(outer, holes, yScan)
      const intervals = raw
        .map((iv) => insetInterval({ a0: iv.x0, a1: iv.x1 }, half))
        .filter((iv): iv is Interval => iv !== null && iv.a1 - iv.a0 >= minLen)
      if (intervals.length === 0) continue

      const forward = lineIndex % 2 === 0
      const ordered = forward ? intervals : [...intervals].reverse()
      for (const iv of ordered) {
        pending.push({
          lineIndex,
          cross: y,
          span0: iv.a0,
          span1: iv.a1,
          forward
        })
      }
    }
  } else {
    const xLeft = bb.minX + half
    const xRight = bb.maxX - half
    if (xRight <= xLeft) return []

    for (let x = xLeft; x <= xRight + EPS; x += step, lineIndex++) {
      const xScan = jitterAlongSweep(x, step, lineIndex)
      const raw = fillIntervalsAtX(outer, holes, xScan)
      const intervals = raw
        .map((iv) => insetInterval({ a0: iv.y0, a1: iv.y1 }, half))
        .filter((iv): iv is Interval => iv !== null && iv.a1 - iv.a0 >= minLen)
      if (intervals.length === 0) continue

      const forward = lineIndex % 2 === 0
      const ordered = forward ? intervals : [...intervals].reverse()
      for (const iv of ordered) {
        pending.push({
          lineIndex,
          cross: x,
          span0: iv.a0,
          span1: iv.a1,
          forward
        })
      }
    }
  }

  const segments: ScanSegment[] = pending.map((p) => ({
    lineIndex: p.lineIndex,
    y: p.cross,
    x0: p.span0,
    x1: p.span1
  }))
  const stripeIds = assignScanColumnIds(segments, step)

  const rings: RingPath[] = []
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i]
    let points: Point[]
    if (axis === 'h') {
      points = p.forward
        ? [
            { x: p.span0, y: p.cross },
            { x: p.span1, y: p.cross }
          ]
        : [
            { x: p.span1, y: p.cross },
            { x: p.span0, y: p.cross }
          ]
    } else {
      points = p.forward
        ? [
            { x: p.cross, y: p.span0 },
            { x: p.cross, y: p.span1 }
          ]
        : [
            { x: p.cross, y: p.span1 },
            { x: p.cross, y: p.span0 }
          ]
    }

    for (let repeatPass = 0; repeatPass < settings.passes; repeatPass++) {
      rings.push({
        points,
        polygonId,
        passIndex: p.lineIndex,
        narrow: false,
        isHole: false,
        repeatPass,
        closed: false,
        scanStripe: stripeIds[i],
        scanAxis: axis
      })
    }
  }

  return rings
}

export function generateScanlineFillRingsForPolygon(
  poly: PolygonWithHoles,
  settings: LaserSettings
): RingPath[] {
  return generateScanFillForPolygon(poly, settings, 'h')
}

/** Сначала вертикальные scan-line, затем горизонтальные (крест-накрест). */
export function generateDualScanlineFillRingsForPolygon(
  poly: PolygonWithHoles,
  settings: LaserSettings
): RingPath[] {
  return [
    ...generateScanFillForPolygon(poly, settings, 'v'),
    ...generateScanFillForPolygon(poly, settings, 'h')
  ]
}
