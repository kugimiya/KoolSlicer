import type { Point } from '@shared/types'

import { flattenSvgPathContours, isClosedPath } from '../svgPathData'

import { getElementStyle, getSvgFillRule, shapeHasFill, shapeHasStroke } from '../svgStyle'

import { clipperLib, type ClipperInstance } from '../clipperInstance'

import { pathFromClipper, pathToClipper, unionContoursToFilledPolygons } from '../geometry'

import { mapElementPointsFromEl, type SvgMetrics } from '../svgParserDomMetrics'

import type { Contour, FilledCompound } from './types'



export type ImportShapeResult = {

  contours: Contour[]

  compounds: FilledCompound[]

}



async function strokeToContours(

  clipper: ClipperInstance,

  path: Point[],

  strokeWidthUser: number,

  metrics: SvgMetrics

): Promise<Contour[]> {

  const halfMm = (strokeWidthUser / 2) * ((metrics.scaleX + metrics.scaleY) / 2)

  if (path.length < 2 || halfMm <= 0) return []

  const expanded = clipper.offsetToPaths({

    delta: halfMm * 1000,

    offsetInputs: [

      {

        data: pathToClipper(path),

        joinType: clipperLib.JoinType.Round,

        endType: clipperLib.EndType.OpenRound

      }

    ]

  })

  if (!expanded) return []

  return expanded.map(pathFromClipper)

}



function rectToPoly(el: Element, metrics: SvgMetrics): Point[] {

  const x = parseFloat(el.getAttribute('x') ?? '0')

  const y = parseFloat(el.getAttribute('y') ?? '0')

  const w = parseFloat(el.getAttribute('width') ?? '0')

  const h = parseFloat(el.getAttribute('height') ?? '0')

  const pts = [

    { x, y: y + h },

    { x: x + w, y: y + h },

    { x: x + w, y },

    { x, y }

  ]

  return mapElementPointsFromEl(el, pts, metrics)

}



function circleToPoly(el: Element, metrics: SvgMetrics, segments = 64): Point[] {

  const cx = parseFloat(el.getAttribute('cx') ?? '0')

  const cy = parseFloat(el.getAttribute('cy') ?? '0')

  const r = parseFloat(el.getAttribute('r') ?? '0')

  const rx = parseFloat(el.getAttribute('rx') ?? String(r))

  const ry = parseFloat(el.getAttribute('ry') ?? String(r))

  const pts: Point[] = []

  for (let i = 0; i < segments; i++) {

    const a = (i / segments) * Math.PI * 2

    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })

  }

  return mapElementPointsFromEl(el, pts, metrics)

}



function parsePointsAttribute(ptsAttr: string): Point[] {

  const nums = ptsAttr.trim().split(/[\s,]+/).map(Number)

  const pts: Point[] = []

  for (let j = 0; j + 1 < nums.length; j += 2) pts.push({ x: nums[j], y: nums[j + 1] })

  return pts

}



function lineToPoly(el: Element): Point[] {

  const x1 = parseFloat(el.getAttribute('x1') ?? '0')

  const y1 = parseFloat(el.getAttribute('y1') ?? '0')

  const x2 = parseFloat(el.getAttribute('x2') ?? '0')

  const y2 = parseFloat(el.getAttribute('y2') ?? '0')

  return [

    { x: x1, y: y1 },

    { x: x2, y: y2 }

  ]

}



async function filledCompoundsFromContours(

  clipper: ClipperInstance,

  loops: Contour[],

  fillRule: 'evenodd' | 'nonzero'

): Promise<FilledCompound[]> {

  const polys = await unionContoursToFilledPolygons(clipper, loops, fillRule)

  return polys.map((p) => ({ outer: p.outer, holes: p.holes }))

}



/** Контуры одного SVG-элемента в mm (без фильтра ролей). */

export async function importShapeContours(

  el: Element,

  metrics: SvgMetrics,

  clipper: ClipperInstance

): Promise<ImportShapeResult> {

  const tag = el.localName

  const style = getElementStyle(el)

  const layerid = el.getAttribute('layerid')

  const contours: Contour[] = []

  const compounds: FilledCompound[] = []

  const curveTol = 0.02 / metrics.scaleX



  if (tag === 'path') {

    const d = el.getAttribute('d')

    if (!d) return { contours, compounds }

    const closed = isClosedPath(d) || d.toLowerCase().includes('z')

    const flat = flattenSvgPathContours(d, curveTol)

    const mapped = flat.map((c) => mapElementPointsFromEl(el, c, metrics)).filter((c) => c.length >= 3)

    if (closed && shapeHasFill(style, closed, layerid) && mapped.length > 0) {

      const fillRule = getSvgFillRule(el)

      compounds.push(...(await filledCompoundsFromContours(clipper, mapped, fillRule)))

    } else if (shapeHasStroke(style)) {

      const strokeSource = flat[0]

      if (strokeSource && strokeSource.length >= 2) {

        const mm = mapElementPointsFromEl(el, strokeSource, metrics)

        const sw = style.strokeWidth ?? 1

        contours.push(...(await strokeToContours(clipper, mm, sw, metrics)))

      }

    }

    return { contours, compounds }

  }



  if (tag === 'rect') {

    if (shapeHasFill(style, true, layerid)) {

      compounds.push({ outer: rectToPoly(el, metrics), holes: [] })

    }

    return { contours, compounds }

  }



  if (tag === 'circle' || tag === 'ellipse') {

    if (shapeHasFill(style, true, layerid)) {

      compounds.push({ outer: circleToPoly(el, metrics), holes: [] })

    }

    return { contours, compounds }

  }



  if (tag === 'polygon') {

    const ptsAttr = el.getAttribute('points')

    if (ptsAttr) {

      const pts = parsePointsAttribute(ptsAttr)

      if (pts.length >= 3 && shapeHasFill(style, true, layerid)) {

        compounds.push({ outer: mapElementPointsFromEl(el, pts, metrics), holes: [] })

      }

    }

    return { contours, compounds }

  }



  if (tag === 'polyline' || tag === 'line') {

    if (!shapeHasStroke(style)) return { contours, compounds }

    const ptsUser =

      tag === 'line'

        ? lineToPoly(el)

        : el.getAttribute('points')

          ? parsePointsAttribute(el.getAttribute('points')!)

          : []

    if (ptsUser.length < 2) return { contours, compounds }

    const mm = mapElementPointsFromEl(el, ptsUser, metrics)

    const sw = style.strokeWidth ?? 1

    contours.push(...(await strokeToContours(clipper, mm, sw, metrics)))

    return { contours, compounds }

  }



  return { contours, compounds }

}


