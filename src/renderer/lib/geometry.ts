import type { Point, PolygonWithHoles } from '@shared/types'
import { clipperLib, getClipper, type ClipperInstance } from './clipperInstance'

export const CLIPPER_SCALE = 1000

export function toClipper(p: Point): clipperLib.IntPoint {
  return { x: Math.round(p.x * CLIPPER_SCALE), y: Math.round(p.y * CLIPPER_SCALE) }
}

export function fromClipper(p: clipperLib.IntPoint): Point {
  return { x: p.x / CLIPPER_SCALE, y: p.y / CLIPPER_SCALE }
}

export function pathToClipper(path: Point[]): clipperLib.Path {
  return path.map(toClipper)
}

export function pathFromClipper(path: clipperLib.Path): Point[] {
  return path.map(fromClipper)
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function polygonArea(path: Point[]): number {
  let sum = 0
  for (let i = 0; i < path.length; i++) {
    const j = (i + 1) % path.length
    sum += path[i].x * path[j].y - path[j].x * path[i].y
  }
  return Math.abs(sum) / 2
}

export function bboxOfPoints(points: Point[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  return { minX, minY, maxX, maxY }
}

export function bboxOfPolygons(polygons: { outer: Point[]; holes: Point[][] }[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const all: Point[] = []
  for (const poly of polygons) {
    all.push(...poly.outer)
    for (const h of poly.holes) all.push(...h)
  }
  return bboxOfPoints(all)
}

export function translatePath(path: Point[], dx: number, dy: number): Point[] {
  return path.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

export function translatePoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy }
}

export function nearestNeighborOrder<T>(
  items: T[],
  getStart: (item: T) => Point,
  startFrom: Point
): T[] {
  if (items.length <= 1) return [...items]
  const remaining = [...items]
  const ordered: T[] = []
  let cursor = startFrom
  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = distance(cursor, getStart(remaining[i]))
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next)
    cursor = getStart(next)
  }
  return ordered
}

export async function simplifyPath(
  clipper: ClipperInstance,
  path: Point[],
  toleranceMm = 0.01
): Promise<Point[]> {
  if (path.length < 3) return path
  const dist = Math.max(1, Math.round(toleranceMm * CLIPPER_SCALE))
  const cleaned = clipper.cleanPolygon(pathToClipper(path), dist)
  if (!cleaned || cleaned.length < 3) return path
  const simplified = clipper.simplifyPolygon(cleaned, clipperLib.PolyFillType.NonZero)
  const best = simplified?.[0] ?? cleaned
  return pathFromClipper(best)
}

export function isClockwise(path: Point[]): boolean {
  let sum = 0
  for (let i = 0; i < path.length; i++) {
    const j = (i + 1) % path.length
    sum += (path[j].x - path[i].x) * (path[j].y + path[i].y)
  }
  return sum > 0
}

export function ensureOrientation(path: Point[], clockwise: boolean): Point[] {
  const cw = isClockwise(path)
  if (cw === clockwise) return path
  return [...path].reverse()
}

export function polygonCentroid(path: Point[]): Point {
  let sx = 0
  let sy = 0
  for (const p of path) {
    sx += p.x
    sy += p.y
  }
  const n = path.length || 1
  return { x: sx / n, y: sy / n }
}

/** Even-odd ray cast. */
export function pointInPolygon(p: Point, path: Point[]): boolean {
  if (path.length < 3) return false
  let inside = false
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const xi = path[i].x
    const yi = path[i].y
    const xj = path[j].x
    const yj = path[j].y
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInAnyHole(p: Point, holes: Point[][]): boolean {
  for (const h of holes) {
    if (pointInPolygon(p, h)) return true
  }
  return false
}

export function bboxesOverlap(
  a: ReturnType<typeof bboxOfPoints>,
  b: ReturnType<typeof bboxOfPoints>
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

export function bboxContained(
  inner: ReturnType<typeof bboxOfPoints>,
  outer: ReturnType<typeof bboxOfPoints>,
  marginMm = 0
): boolean {
  return (
    inner.minX >= outer.minX - marginMm &&
    inner.minY >= outer.minY - marginMm &&
    inner.maxX <= outer.maxX + marginMm &&
    inner.maxY <= outer.maxY + marginMm
  )
}

/** Offset полигона с дырками (outer CCW, holes CW) одним вызовом Clipper. */
export async function offsetPolygonWithHoles(
  clipper: ClipperInstance,
  outer: Point[],
  holes: Point[][],
  deltaMm: number
): Promise<Point[][]> {
  if (outer.length < 3) return []
  const paths: clipperLib.Path[] = [pathToClipper(ensureOrientation(outer, false))]
  for (const h of holes) {
    if (h.length < 3) continue
    paths.push(pathToClipper(ensureOrientation(h, true)))
  }
  const result = clipper.offsetToPaths({
    delta: deltaMm * CLIPPER_SCALE,
    miterLimit: 2,
    offsetInputs: [
      {
        data: paths,
        joinType: clipperLib.JoinType.Round,
        endType: clipperLib.EndType.ClosedPolygon
      }
    ]
  })
  if (!result) return []
  return result.map(pathFromClipper)
}

export async function offsetClosedPath(
  clipper: ClipperInstance,
  path: Point[],
  deltaMm: number,
  joinType = clipperLib.JoinType.Round
): Promise<Point[][]> {
  if (path.length < 3) return []
  const oriented = ensureOrientation(path, false)
  const result = clipper.offsetToPaths({
    delta: deltaMm * CLIPPER_SCALE,
    miterLimit: 2,
    offsetInputs: [
      {
        data: pathToClipper(oriented),
        joinType,
        endType: clipperLib.EndType.ClosedPolygon
      }
    ]
  })
  if (!result) return []
  return result.map(pathFromClipper)
}

/** Отбрасывает offset-«шипы» далеко от исходного контура. */
export function filterOffsetPathsNearSource(
  source: Point[],
  paths: Point[][],
  deltaMm: number
): Point[][] {
  if (paths.length === 0) return []
  const bb = bboxOfPoints(source)
  const margin = Math.max(0.05, Math.abs(deltaMm) * 2 + 0.25)
  const minX = bb.minX - margin
  const minY = bb.minY - margin
  const maxX = bb.maxX + margin
  const maxY = bb.maxY + margin
  const sourceArea = polygonArea(source)
  return paths.filter((path) => {
    if (path.length < 3) return false
    const pb = bboxOfPoints(path)
    if (pb.minX < minX || pb.minY < minY || pb.maxX > maxX || pb.maxY > maxY) return false
    const area = polygonArea(path)
    if (sourceArea > 1e-6 && area > sourceArea * 4) return false
    return true
  })
}

export async function unionPaths(clipper: ClipperInstance, paths: Point[][]): Promise<Point[][]> {
  if (paths.length === 0) return []
  if (paths.length === 1) return paths
  const subjectInputs = paths.map((data) => ({ data: pathToClipper(data), closed: true }))
  const result = clipper.clipToPaths({
    clipType: clipperLib.ClipType.Union,
    subjectInputs,
    subjectFillType: clipperLib.PolyFillType.NonZero
  })
  if (!result) return []
  return result.map(pathFromClipper)
}

/** Объединяет пересекающиеся контуры выреза/void в один набор без «восстановления» в пересечении. */
export async function mergeVoidContours(
  clipper: ClipperInstance,
  contours: Point[][]
): Promise<Point[][]> {
  const valid = contours.filter((c) => c.length >= 3)
  if (valid.length <= 1) return valid
  return unionPaths(clipper, valid)
}

export type SvgFillRule = 'evenodd' | 'nonzero'

function fillRuleToClipper(rule: SvgFillRule): clipperLib.PolyFillType {
  return rule === 'nonzero' ? clipperLib.PolyFillType.NonZero : clipperLib.PolyFillType.EvenOdd
}

/** Subpath одного SVG path → полигоны с дырками по fill-rule. */
export async function unionContoursToFilledPolygons(
  clipper: ClipperInstance,
  contours: Point[][],
  fillRule: SvgFillRule = 'evenodd'
): Promise<{ outer: Point[]; holes: Point[][] }[]> {
  const valid = contours.filter((c) => c.length >= 3)
  if (valid.length === 0) return []
  const tree = clipper.clipToPolyTree({
    clipType: clipperLib.ClipType.Union,
    subjectInputs: valid.map((data) => ({ data: pathToClipper(data), closed: true })),
    subjectFillType: fillRuleToClipper(fillRule)
  })
  return polyTreeToPolygons(tree).map((p) => ({ outer: p.outer, holes: p.holes }))
}

function polyTreeToPolygons(tree: clipperLib.PolyTree): PolygonWithHoles[] {
  const out: PolygonWithHoles[] = []
  let id = 0

  const addOuter = (node: clipperLib.PolyNode): void => {
    if (node.isOpen || node.contour.length < 3 || node.isHole) return
    const holes: Point[][] = []
    for (const child of node.childs) {
      if (child.isOpen || child.contour.length < 3) continue
      if (child.isHole) holes.push(pathFromClipper(child.contour))
      else addOuter(child)
    }
    out.push({ id: id++, outer: pathFromClipper(node.contour), holes })
  }

  for (const top of tree.childs) addOuter(top)
  return out
}

export async function intersectionToPolygons(
  clipper: ClipperInstance,
  subjectPaths: Point[][],
  clipPaths: Point[][]
): Promise<PolygonWithHoles[]> {
  if (subjectPaths.length === 0 || clipPaths.length === 0) return []
  const tree = clipper.clipToPolyTree({
    clipType: clipperLib.ClipType.Intersection,
    subjectInputs: subjectPaths.map((data) => ({ data: pathToClipper(data), closed: true })),
    clipInputs: clipPaths.map((data) => ({ data: pathToClipper(data), closed: true })),
    subjectFillType: clipperLib.PolyFillType.EvenOdd,
    clipFillType: clipperLib.PolyFillType.EvenOdd
  })
  return polyTreeToPolygons(tree)
}

export async function differenceToPolygons(
  clipper: ClipperInstance,
  subjectPaths: Point[][],
  clipPaths: Point[][]
): Promise<PolygonWithHoles[]> {
  if (subjectPaths.length === 0) return []
  if (clipPaths.length === 0) {
    const unioned = await unionPaths(clipper, subjectPaths)
    return unioned
      .filter((o) => o.length >= 3)
      .map((outer, idx) => ({ id: idx, outer, holes: [] as Point[][] }))
  }
  const tree = clipper.clipToPolyTree({
    clipType: clipperLib.ClipType.Difference,
    subjectInputs: subjectPaths.map((data) => ({ data: pathToClipper(data), closed: true })),
    clipInputs: clipPaths.map((data) => ({ data: pathToClipper(data), closed: true })),
    subjectFillType: clipperLib.PolyFillType.NonZero,
    clipFillType: clipperLib.PolyFillType.NonZero
  })
  return polyTreeToPolygons(tree)
}

function filledClipInputs(clips: { outer: Point[]; holes: Point[][] }[]): clipperLib.Path[] {
  const paths: clipperLib.Path[] = []
  for (const c of clips) {
    if (c.outer.length < 3) continue
    paths.push(pathToClipper(ensureOrientation(c.outer, false)))
    for (const h of c.holes) {
      if (h.length >= 3) paths.push(pathToClipper(ensureOrientation(h, true)))
    }
  }
  return paths
}

/** (subject fill) − (union filled clip regions). Clip задаётся outer+holes, без merge «solid». */
export async function differenceCompoundFromFilledClips(
  clipper: ClipperInstance,
  subject: { outer: Point[]; holes: Point[][] },
  clips: { outer: Point[]; holes: Point[][] }[]
): Promise<PolygonWithHoles[]> {
  if (subject.outer.length < 3) return []
  if (clips.length === 0) {
    return [{ id: 0, outer: subject.outer, holes: subject.holes }]
  }
  const subjectPaths = [
    ensureOrientation(subject.outer, false),
    ...subject.holes.filter((h) => h.length >= 3).map((h) => ensureOrientation(h, true))
  ]
  const clipPaths = filledClipInputs(clips)
  if (clipPaths.length === 0) {
    return [{ id: 0, outer: subject.outer, holes: subject.holes }]
  }
  const tree = clipper.clipToPolyTree({
    clipType: clipperLib.ClipType.Difference,
    subjectInputs: subjectPaths.map((data) => ({ data: pathToClipper(data), closed: true })),
    clipInputs: clipPaths.map((data) => ({ data, closed: true })),
    subjectFillType: clipperLib.PolyFillType.NonZero,
    clipFillType: clipperLib.PolyFillType.NonZero
  })
  const polys = polyTreeToPolygons(tree)
  const out: PolygonWithHoles[] = []
  for (const p of polys) {
    const holes = await mergeVoidContours(clipper, p.holes)
    out.push({ ...p, holes })
  }
  return out
}

/** Пересечение залитых областей subject ∩ clip (outer+holes). */
export async function intersectionCompoundFromFilledClips(
  clipper: ClipperInstance,
  subject: { outer: Point[]; holes: Point[][] },
  clips: { outer: Point[]; holes: Point[][] }[]
): Promise<PolygonWithHoles[]> {
  if (subject.outer.length < 3 || clips.length === 0) return []
  const subjectPaths = [
    ensureOrientation(subject.outer, false),
    ...subject.holes.filter((h) => h.length >= 3).map((h) => ensureOrientation(h, true))
  ]
  const clipPaths = filledClipInputs(clips)
  if (clipPaths.length === 0) return []
  const tree = clipper.clipToPolyTree({
    clipType: clipperLib.ClipType.Intersection,
    subjectInputs: subjectPaths.map((data) => ({ data: pathToClipper(data), closed: true })),
    clipInputs: clipPaths.map((data) => ({ data, closed: true })),
    subjectFillType: clipperLib.PolyFillType.NonZero,
    clipFillType: clipperLib.PolyFillType.NonZero
  })
  const polys = polyTreeToPolygons(tree)
  const out: PolygonWithHoles[] = []
  for (const p of polys) {
    const holes = await mergeVoidContours(clipper, p.holes)
    out.push({ ...p, holes })
  }
  return out
}

/** Difference для полигона с дырками: (outer − holes) − clip (только внешние контуры clip). */
export async function differenceCompoundFromClip(
  clipper: ClipperInstance,
  subject: { outer: Point[]; holes: Point[][] },
  clipPaths: Point[][]
): Promise<PolygonWithHoles[]> {
  const clips = clipPaths.filter((p) => p.length >= 3).map((outer) => ({ outer, holes: [] as Point[][] }))
  return differenceCompoundFromFilledClips(clipper, subject, clips)
}

export function rectPolygon(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ]
}

export { getClipper }
