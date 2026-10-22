import { describe, expect, it } from 'vitest'
import { bboxOfPoints } from './geometry'
import { flattenSvgPath, flattenSvgPathContours, isClosedPath } from './svgPathData'

describe('svgPathData', () => {
  it('parses M H V Z rect path', () => {
    const pts = flattenSvgPath('m 10,20 h 50 v 30 h -50 z')
    expect(pts.length).toBeGreaterThan(3)
    expect(isClosedPath('m 10,20 h 50 v 30 h -50 z')).toBe(true)
  })

  it('splits multiple subpaths instead of connecting them', () => {
    const d = 'M 0 0 L 10 0 L 10 10 L 0 10 Z M 100 100 L 110 100 L 110 110 L 100 110 Z'
    const contours = flattenSvgPathContours(d)
    expect(contours.length).toBe(2)
    const merged = flattenSvgPath(d)
    const bb = bboxOfPoints(merged)
    expect(bb.maxX - bb.minX).toBeLessThan(15)
  })
})
