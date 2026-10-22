import type { LaserSettings, Point, PolygonWithHoles, RingPath } from '@shared/types'

import {
  bboxContained,
  bboxOfPoints,
  filterOffsetPathsNearSource,
  getClipper,
  mergeVoidContours,
  offsetClosedPath,
  offsetPolygonWithHoles,
  polygonArea,
  simplifyPath,
  unionPaths,
  type ClipperInstance
} from './geometry'
import {
  generateDualScanlineFillRingsForPolygon,
  generateScanlineFillRingsForPolygon
} from './scanlineFill'

const MIN_AREA_FACTOR = 0.01

async function insetPath(
  clipper: ClipperInstance,
  path: Point[],
  insetMm: number,
  expandHole: boolean
): Promise<Point[][]> {
  const delta = expandHole ? insetMm : -insetMm
  const raw = await offsetClosedPath(clipper, path, delta)
  return filterOffsetPathsNearSource(path, raw, delta)
}

function maxInsetStepsForContour(path: Point[], stepMm: number): number {
  const bb = bboxOfPoints(path)
  const span = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY)
  if (span <= 0 || stepMm <= 0) return 1
  return Math.ceil(span / stepMm) + 4
}

async function narrowFallbackRing(
  clipper: ClipperInstance,
  path: Point[],
  beamSize: number,
  polygonId: number
): Promise<RingPath[]> {
  const simplified = await simplifyPath(clipper, path, beamSize)
  const outs = await offsetClosedPath(clipper, simplified, beamSize / 2)
  const ringPath = outs.sort((a, b) => polygonArea(b) - polygonArea(a))[0]
  if (!ringPath || ringPath.length < 3) return []

  return [
    {
      points: ringPath,
      polygonId,
      passIndex: 0,
      narrow: true,
      isHole: false,
      repeatPass: 0
    }
  ]
}

async function generateContourFillRingsForPolygon(
  clipper: ClipperInstance,
  poly: PolygonWithHoles,
  settings: LaserSettings
): Promise<RingPath[]> {
  const { outer, holes, id: polygonId } = poly
  const step = settings.beamSize
  if (step <= 0 || outer.length < 3) return []

  const maxRingIndex = maxInsetStepsForContour(outer, step)
  const minArea = Math.pow(settings.beamSize * MIN_AREA_FACTOR, 2)

  const rings: RingPath[] = []

  const pushRing = (points: Point[], ringIndex: number, isHole: boolean): void => {
    if (points.length < 3 || polygonArea(points) < minArea) return
    for (let repeatPass = 0; repeatPass < settings.passes; repeatPass++) {
      rings.push({
        points,
        polygonId,
        passIndex: ringIndex,
        narrow: false,
        isHole,
        repeatPass
      })
    }
  }

  const voidClip =
    holes.length === 0 ? ([] as Point[][]) : holes.length === 1 ? holes : await unionPaths(clipper, holes)

  for (let ringIndex = 0; ringIndex < maxRingIndex; ringIndex++) {
    const depth = ringIndex * step
    let loops: Point[][]

    if (holes.length === 0) {
      loops = await insetPath(clipper, outer, depth, false)
    } else {
      const raw = await offsetPolygonWithHoles(clipper, outer, holes, -depth)
      loops = filterOffsetPathsNearSource(outer, raw, depth)
    }

    if (loops.length === 0) break

    let added = false
    for (const loop of loops) {
      if (polygonArea(loop) < minArea) continue
      if (voidClip.length > 0) {
        const cbb = bboxOfPoints(loop)
        const insideVoid = voidClip.some((h) => bboxContained(cbb, bboxOfPoints(h), step * 0.5))
        if (insideVoid) continue
      }
      pushRing(loop, ringIndex, false)
      added = true
    }
    if (!added) break
  }

  for (const h of holes) {
    if (h.length < 3) continue
    const iso = await generateIsolationRingsForContour(clipper, h, settings, polygonId)
    for (const r of iso) rings.push({ ...r, isHole: true })
  }

  return rings
}

async function generateIsolationRingsForContour(
  clipper: ClipperInstance,
  path: Point[],
  settings: LaserSettings,
  polygonId: number
): Promise<RingPath[]> {
  if (path.length < 3) return []
  const half = settings.beamSize / 2
  const outs = await offsetClosedPath(clipper, path, half)
  const ringPath = outs.sort((a, b) => polygonArea(b) - polygonArea(a))[0]
  if (!ringPath || ringPath.length < 3) {
    return narrowFallbackRing(clipper, path, settings.beamSize, polygonId)
  }

  const rings: RingPath[] = []
  for (let repeatPass = 0; repeatPass < settings.passes; repeatPass++) {
    rings.push({
      points: ringPath,
      polygonId,
      passIndex: 0,
      narrow: false,
      isHole: false,
      repeatPass
    })
  }
  return rings
}

export async function generateRings(
  polygons: PolygonWithHoles[],
  settings: LaserSettings
): Promise<RingPath[]> {
  const clipper = await getClipper()
  const all: RingPath[] = []

  for (const poly of polygons) {
    if (poly.toolpathKind === 'fill') {
      const holes =
        poly.holes.length <= 1 ? poly.holes : await mergeVoidContours(clipper, poly.holes)
      const fillPoly = { ...poly, holes }
      if (settings.fillStrategy === 'scanline' || settings.fillStrategy === 'dual-scanline') {
        const fillRings =
          settings.fillStrategy === 'dual-scanline'
            ? generateDualScanlineFillRingsForPolygon(fillPoly, settings)
            : generateScanlineFillRingsForPolygon(fillPoly, settings)
        all.push(...fillRings)
        for (const h of holes) {
          if (h.length < 3) continue
          const iso = await generateIsolationRingsForContour(clipper, h, settings, poly.id)
          for (const r of iso) all.push({ ...r, isHole: true })
        }
      } else {
        all.push(...(await generateContourFillRingsForPolygon(clipper, fillPoly, settings)))
      }
      continue
    }
    all.push(...(await generateIsolationRingsForContour(clipper, poly.outer, settings, poly.id)))
    for (const hole of poly.holes) {
      all.push(...(await generateIsolationRingsForContour(clipper, hole, settings, poly.id)))
    }
  }

  return all
}

export function countDistinctPassIndices(rings: RingPath[], polygonId?: number): number {
  const set = new Set<number>()
  for (const r of rings) {
    if (polygonId !== undefined && r.polygonId !== polygonId) continue
    set.add(r.passIndex)
  }
  return set.size
}

export function ringsForPolygon(rings: RingPath[], polygonId: number): RingPath[] {
  return rings.filter((r) => r.polygonId === polygonId)
}
