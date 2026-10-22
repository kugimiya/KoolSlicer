import { describe, expect, it } from 'vitest'
import { polygonArea, rectPolygon } from '../geometry'
import { parseSvgGeo } from './pipeline'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'

const svg = `<svg viewBox="0 0 20 20" width="20mm" height="20mm">
  <rect id="board" fill="#000" x="0" y="0" width="20" height="20"/>
  <rect id="a" fill="#000" x="5" y="5" width="8" height="8"/>
  <rect id="b" fill="#000" x="10" y="10" width="8" height="8"/>
</svg>`

async function keys() {
  const { svg: root } = parseSvgDocument(svg)
  const shapes = collectShapeElements(root)
  return {
    board: shapes.find((s) => s.element.getAttribute('id') === 'board')!.key,
    a: shapes.find((s) => s.element.getAttribute('id') === 'a')!.key,
    b: shapes.find((s) => s.element.getAttribute('id') === 'b')!.key
  }
}

describe('overlapping subtract contours', () => {
  it('union of subtracts leaves no copper in overlap', async () => {
    const { board, a, b } = await keys()
    const { result } = await parseSvgGeo(svg, {
      [board]: { mode: 'fill', layer: 1 },
      [a]: { mode: 'subtract', layer: 1 },
      [b]: { mode: 'subtract', layer: 1 }
    })
    const fill = result.polygons.find((p) => p.toolpathKind === 'fill')
    expect(fill).toBeTruthy()
    const boardArea = 20 * 20
    const voidArea = 8 * 8 + 8 * 8 - 3 * 3
    const copper = polygonArea(fill!.outer) - fill!.holes.reduce((s, h) => s + polygonArea(h), 0)
    expect(copper).toBeCloseTo(boardArea - voidArea, 0.5)

    const { pointInAnyHole } = await import('../geometry')
    const mid = { x: 11.5, y: 11.5 }
    expect(pointInAnyHole(mid, fill!.holes)).toBe(true)

    const mergedHoleCount = fill!.holes.length
    expect(mergedHoleCount).toBe(1)
  })
})
