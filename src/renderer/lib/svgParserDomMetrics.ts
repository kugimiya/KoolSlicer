import type { Point } from '@shared/types'
import { toRootSvgCoords } from './svgTransform'

export type SvgMetrics = {
  scaleX: number
  scaleY: number
  vbMinX: number
  vbMinY: number
  docHeightMm: number
}

function parseLengthToMm(value: string | null, fallback: number): number {
  if (!value) return fallback
  const m = value.trim().match(/^([\d.]+)\s*(mm|cm|in|px)?$/i)
  if (!m) return fallback
  const num = parseFloat(m[1])
  const unit = (m[2] ?? 'user').toLowerCase()
  if (unit === 'mm' || unit === 'user') return num
  if (unit === 'cm') return num * 10
  if (unit === 'in') return num * 25.4
  if (unit === 'px') return (num / 96) * 25.4
  return num
}

export function svgMetricsFromRoot(svg: Element, svgText: string): SvgMetrics {
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
  const wMm = parseLengthToMm(svg.getAttribute('width'), vbW)
  const hMm = parseLengthToMm(svg.getAttribute('height'), vbH)
  const scaleX = vbW > 0 ? wMm / vbW : 1
  const scaleY = vbH > 0 ? hMm / vbH : 1
  return { scaleX, scaleY, vbMinX, vbMinY, docHeightMm: hMm }
}

/** SVG user units (after viewBox offset) → machine mm, bottom-left origin. */
export function userToMm(p: Point, m: SvgMetrics): Point {
  const ux = p.x - m.vbMinX
  const uy = p.y - m.vbMinY
  return {
    x: ux * m.scaleX,
    y: m.docHeightMm - uy * m.scaleY
  }
}

export function mapElementPointsFromEl(el: Element, pts: Point[], metrics: SvgMetrics): Point[] {
  return pts.map((p) => userToMm(toRootSvgCoords(el, p), metrics))
}
