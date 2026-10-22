import { getClipper } from '../clipperInstance'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'
import { svgMetricsFromRoot } from '../svgParserDomMetrics'
import type { BoardRef, ElementGeometry } from './types'
import { importShapeContours } from './importShape'

export function boardRefFromSvg(svg: Element, svgText: string, metrics: ReturnType<typeof svgMetricsFromRoot>): BoardRef {
  const vbRaw = svg.getAttribute('viewBox') ?? svgText.match(/viewBox=["']([^"']+)["']/i)?.[1]
  let vbMinX = 0
  let vbMinY = 0
  let vbW = 100
  let vbH = 100
  if (vbRaw) {
    const parts = vbRaw.trim().split(/[\s,]+/).map(Number)
    if (parts.length >= 4) {
      vbMinX = parts[0]
      vbMinY = parts[1]
      vbW = parts[2]
      vbH = parts[3]
    }
  }
  const corners = [
    { x: vbMinX, y: vbMinY },
    { x: vbMinX + vbW, y: vbMinY },
    { x: vbMinX + vbW, y: vbMinY + vbH },
    { x: vbMinX, y: vbMinY + vbH }
  ].map((p) => ({
    x: (p.x - metrics.vbMinX) * metrics.scaleX,
    y: metrics.docHeightMm - (p.y - metrics.vbMinY) * metrics.scaleY
  }))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of corners) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    widthMm: maxX - minX,
    heightMm: maxY - minY
  }
}

export async function importSvgGeometry(svgText: string): Promise<{
  elements: ElementGeometry[]
  boardRef: BoardRef
}> {
  const { svg } = parseSvgDocument(svgText)
  const metrics = svgMetricsFromRoot(svg, svgText)
  const boardRef = boardRefFromSvg(svg, svgText, metrics)
  const clipper = await getClipper()
  const shapes = collectShapeElements(svg)
  const elements: ElementGeometry[] = []

  for (const { key, element } of shapes) {
    const { contours, compounds } = await importShapeContours(element, metrics, clipper)
    if (contours.length === 0 && compounds.length === 0) continue
    elements.push({ key, contours, compounds })
  }

  return { elements, boardRef }
}
