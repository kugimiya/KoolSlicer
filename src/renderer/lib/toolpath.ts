import type { LaserSettings, Move, Point, RingPath } from '@shared/types'
import { distance } from './geometry'
import { orderGroupsByTravelGrid, travelGridCellSize } from './travelGrid'
import { assignScanColumnIds, type ScanSegment } from './scanlineStripes'

function ringCentroid(ring: RingPath): Point {
  const pts = ring.points
  if (pts.length === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  for (const p of pts) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / pts.length, y: sy / pts.length }
}

function rotateRingNearest(ring: RingPath, cursor: Point): Point[] {
  const pts = ring.points
  if (pts.length < 2) return pts
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = distance(cursor, pts[i])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return [...pts.slice(best), ...pts.slice(0, best)]
}

function isScanFillSegment(ring: RingPath): boolean {
  return ring.closed === false && ring.points.length === 2 && !ring.isHole
}

function scanAxisOf(ring: RingPath): 'h' | 'v' {
  if (ring.scanAxis === 'h' || ring.scanAxis === 'v') return ring.scanAxis
  if (ring.points.length < 2) return 'h'
  return Math.abs(ring.points[0].x - ring.points[1].x) < 1e-9 ? 'v' : 'h'
}

function isScanFillStrategy(s: LaserSettings): boolean {
  return s.fillStrategy === 'scanline' || s.fillStrategy === 'dual-scanline'
}

/** Пересчёт полос на toolpath — если на части Y нет сегментов, старый union-find рвал колонки. */
function ensureScanStripesOnRings(rings: RingPath[], beamSize: number): RingPath[] {
  const segments: ScanSegment[] = []
  const ringAt: number[] = []
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i]
    if (!isScanFillSegment(r)) continue
    const axis = scanAxisOf(r)
    if (axis === 'h') {
      const x0 = Math.min(r.points[0].x, r.points[1].x)
      const x1 = Math.max(r.points[0].x, r.points[1].x)
      segments.push({ lineIndex: r.passIndex, y: r.points[0].y, x0, x1 })
    } else {
      const y0 = Math.min(r.points[0].y, r.points[1].y)
      const y1 = Math.max(r.points[0].y, r.points[1].y)
      segments.push({ lineIndex: r.passIndex, y: r.points[0].x, x0: y0, x1: y1 })
    }
    ringAt.push(i)
  }
  if (segments.length === 0) return rings
  const stripeIds = assignScanColumnIds(segments, beamSize)
  const out = rings.map((r) => ({ ...r }))
  for (let j = 0; j < ringAt.length; j++) {
    out[ringAt[j]] = { ...out[ringAt[j]], scanStripe: stripeIds[j] }
  }
  return out
}

function compareRings(a: RingPath, b: RingPath): number {
  if (a.polygonId !== b.polygonId) return a.polygonId - b.polygonId
  if (a.passIndex !== b.passIndex) return a.passIndex - b.passIndex
  if (a.repeatPass !== b.repeatPass) return a.repeatPass - b.repeatPass
  const ca = ringCentroid(a)
  const cb = ringCentroid(b)
  return ca.y - cb.y || ca.x - cb.x
}

function segmentSortKey(ring: RingPath): number {
  if (ring.points.length === 0) return 0
  if (scanAxisOf(ring) === 'v') {
    return Math.min(ring.points[0].y, ring.points[ring.points.length - 1].y)
  }
  return Math.min(ring.points[0].x, ring.points[ring.points.length - 1].x)
}

function ringEndpoints(ring: RingPath): [Point, Point] {
  const a = ring.points[0]
  const b = ring.points[ring.points.length - 1]
  return [a, b]
}

/** Открытый сегмент: ближайший конец к cursor — в начало резки. */
function orientOpenRingToCursor(ring: RingPath, cursor: Point): RingPath {
  if (ring.closed !== false || ring.points.length < 2) return ring
  const [a, b] = ringEndpoints(ring)
  if (distance(cursor, b) < distance(cursor, a)) {
    return { ...ring, points: [...ring.points].reverse() }
  }
  return ring
}

function stripeAnchor(rings: RingPath[]): Point {
  const top = rings.reduce((best, r) => {
    const c = ringCentroid(r)
    return !best || c.y > best.y || (c.y === best.y && c.x < best.x) ? c : best
  }, null as Point | null)
  return top ?? { x: 0, y: 0 }
}

function orderRingsWithinStripe(rings: RingPath[], start: Point): { rings: RingPath[]; end: Point } {
  const byPass = new Map<number, RingPath[]>()
  for (const r of rings) {
    const list = byPass.get(r.passIndex) ?? []
    list.push(r)
    byPass.set(r.passIndex, list)
  }
  const passKeys = [...byPass.keys()].sort((a, b) => a - b)
  let cursor = start
  const out: RingPath[] = []
  for (const pass of passKeys) {
    const atPass = [...(byPass.get(pass) ?? [])].sort((a, b) => {
      const da = Math.min(distance(cursor, ringEndpoints(a)[0]), distance(cursor, ringEndpoints(a)[1]))
      const db = Math.min(distance(cursor, ringEndpoints(b)[0]), distance(cursor, ringEndpoints(b)[1]))
      return da - db || segmentSortKey(a) - segmentSortKey(b)
    })
    for (const r of atPass) {
      const oriented = orientOpenRingToCursor(r, cursor)
      out.push(oriented)
      const pts = oriented.points
      cursor = pts[pts.length - 1] ?? cursor
    }
  }
  return { rings: out, end: cursor }
}

function orderScanAxisPhase(
  scan: RingPath[],
  settings: LaserSettings,
  axis: 'h' | 'v',
  cursor: Point
): { rings: RingPath[]; end: Point } {
  const subset = scan.filter((r) => scanAxisOf(r) === axis)
  if (subset.length === 0) return { rings: [], end: cursor }

  const groups = new Map<string, RingPath[]>()
  for (const r of subset) {
    const key = `${r.polygonId}:${r.repeatPass}:${r.scanStripe}`
    const list = groups.get(key) ?? []
    list.push(r)
    groups.set(key, list)
  }

  type StripeGroup = { key: string; rings: RingPath[] }
  const stripeGroups: StripeGroup[] = [...groups.entries()].map(([key, rs]) => ({ key, rings: rs }))

  const cellSize = travelGridCellSize(settings.beamSize, settings.travelGridMm)
  let pos = cursor
  const orderedStripes = orderGroupsByTravelGrid(
    stripeGroups,
    (g) => stripeAnchor(g.rings),
    cellSize,
    pos
  )

  const out: RingPath[] = []
  for (const g of orderedStripes) {
    const step = orderRingsWithinStripe(g.rings, pos)
    out.push(...step.rings)
    pos = step.end
  }
  return { rings: out, end: pos }
}

/** Scan-line: колонка целиком; dual — сначала ось V, затем H. */
function orderScanlineStripes(rings: RingPath[], settings: LaserSettings): RingPath[] {
  const scan = rings.filter((r) => r.scanStripe != null)
  const rest = rings.filter((r) => r.scanStripe == null)
  if (scan.length === 0) return orderWithinPassGroups(rings, settings)

  let cursor = stripeAnchor(scan)
  const out: RingPath[] = []

  const axes: ('h' | 'v')[] =
    settings.fillStrategy === 'dual-scanline' ? ['v', 'h'] : ['h']

  for (const axis of axes) {
    const phase = orderScanAxisPhase(scan, settings, axis, cursor)
    out.push(...phase.rings)
    cursor = phase.end
  }

  if (rest.length > 0) {
    out.push(...orderWithinPassGroups(rest, settings))
  }
  return out
}

/** Внутри passIndex — сетка + NN; между pass — по порядку прохода. */
function orderWithinPassGroups(rings: RingPath[], settings: LaserSettings): RingPath[] {
  const byPass = new Map<string, RingPath[]>()
  for (const r of rings) {
    const key = `${r.polygonId}:${r.passIndex}:${r.repeatPass}`
    const list = byPass.get(key) ?? []
    list.push(r)
    byPass.set(key, list)
  }
  const keys = [...byPass.keys()].sort((a, b) => {
    const pa = a.split(':').map(Number)
    const pb = b.split(':').map(Number)
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2]
  })

  const cellSize = travelGridCellSize(settings.beamSize, settings.travelGridMm)
  const out: RingPath[] = []
  let cursor = ringCentroid(rings[0] ?? { points: [{ x: 0, y: 0 }] } as RingPath)

  for (const key of keys) {
    const batch = [...(byPass.get(key) ?? [])]
    if (batch.length === 0) continue
    if (batch.length === 1) {
      out.push(batch[0])
      const last = batch[0].points[batch[0].points.length - 1]
      if (last) cursor = last
      continue
    }
    const ordered = orderGroupsByTravelGrid(batch, (r) => ringCentroid(r), cellSize, cursor)
    for (const r of ordered) {
      const oriented = orientOpenRingToCursor(r, cursor)
      out.push(oriented)
      const pts = oriented.points
      cursor = pts[pts.length - 1] ?? cursor
    }
  }
  return out
}

function appendCutMoves(
  moves: Move[],
  ring: RingPath,
  points: Point[],
  settings: LaserSettings,
  from: Point
): Point {
  let cursor = from
  if (points.length < 2) return cursor

  for (let i = 0; i < points.length; i++) {
    const to = points[i]
    const len = distance(cursor, to)
    if (len < 1e-9) continue
    moves.push({
      type: 'cut',
      from: cursor,
      to,
      power: settings.power,
      feed: settings.cutFeed,
      duration: len / (settings.cutFeed / 60),
      polygonId: ring.polygonId,
      passIndex: ring.passIndex,
      narrow: ring.narrow
    })
    cursor = to
  }

  if (ring.closed !== false) {
    const closeLen = distance(cursor, points[0])
    if (closeLen > 1e-9) {
      moves.push({
        type: 'cut',
        from: cursor,
        to: points[0],
        power: settings.power,
        feed: settings.cutFeed,
        duration: closeLen / (settings.cutFeed / 60),
        polygonId: ring.polygonId,
        passIndex: ring.passIndex,
        narrow: ring.narrow
      })
      cursor = points[0]
    }
  }
  return cursor
}

export function appendRapid(
  moves: Move[],
  from: Point,
  to: Point,
  settings: Pick<LaserSettings, 'rapidFeed'>
): void {
  const len = distance(from, to)
  if (len < 1e-9) return
  moves.push({
    type: 'rapid',
    from,
    to,
    feed: settings.rapidFeed,
    duration: len / (settings.rapidFeed / 60),
    polygonId: -1,
    passIndex: -1
  })
}

export function buildToolpathFromRings(rings: RingPath[], settings: LaserSettings): Move[] {
  if (rings.length === 0) return []

  const working =
    settings.travelOptimize && isScanFillStrategy(settings)
      ? ensureScanStripesOnRings(rings, settings.beamSize)
      : rings

  let ordered = [...working].sort(compareRings)
  if (settings.travelOptimize) {
    ordered =
      isScanFillStrategy(settings) && working.some(isScanFillSegment)
        ? orderScanlineStripes(working, settings)
        : orderWithinPassGroups(ordered, settings)
  }

  const moves: Move[] = []
  let cursor: Point | null = null

  for (const ring of ordered) {
    const from = cursor ?? ringCentroid(ring)
    const points = rotateRingNearest(ring, from)
    const start = points[0]

    if (cursor !== null) {
      appendRapid(moves, cursor, start, settings)
    }
    cursor = appendCutMoves(moves, ring, points, settings, start)
  }

  return moves
}

export function totalRapidLength(moves: Move[]): number {
  return moves.filter((m) => m.type === 'rapid').reduce((s, m) => s + distance(m.from, m.to), 0)
}

export function cloneMove(m: Move, dx: number, dy: number): Move {
  return {
    ...m,
    from: { x: m.from.x + dx, y: m.from.y + dy },
    to: { x: m.to.x + dx, y: m.to.y + dy }
  }
}
