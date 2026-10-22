import { describe, expect, it } from 'vitest'
import { polygonArea } from '../geometry'
import { parseSvgGeo } from './pipeline'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'

const svg = `<svg viewBox="0 0 10 10" width="10mm" height="10mm">
  <rect id="board" fill="#000" x="0" y="0" width="10" height="10"/>
  <rect id="h1" fill="#000" x="1" y="1" width="2" height="2"/>
  <rect id="h2" fill="#000" x="6" y="6" width="2" height="2"/>
</svg>`

async function keys() {
  const { svg: root } = parseSvgDocument(svg)
  const shapes = collectShapeElements(root)
  return {
    board: shapes.find((s) => s.element.getAttribute('id') === 'board')!.key,
    h1: shapes.find((s) => s.element.getAttribute('id') === 'h1')!.key,
    h2: shapes.find((s) => s.element.getAttribute('id') === 'h2')!.key
  }
}

describe('multiple subtract on fill', () => {
  it('keeps both holes after two subtracts on same layer', async () => {
    const { board, h1, h2 } = await keys()
    const { result } = await parseSvgGeo(svg, {
      [board]: { mode: 'fill', layer: 1 },
      [h1]: { mode: 'subtract', layer: 1 },
      [h2]: { mode: 'subtract', layer: 1 }
    })
    const fill = result.polygons.find((p) => p.toolpathKind === 'fill')
    expect(fill?.holes.length).toBe(2)
    const holeArea = fill!.holes.reduce((s, h) => s + polygonArea(h), 0)
    expect(holeArea).toBeCloseTo(8, 0.5)
  })

  it('merges overlapping subtracts on same layer into one void', async () => {
    const { board, h1, h2 } = await keys()
    const overlapSvg = `<svg viewBox="0 0 20 20" width="20mm" height="20mm">
      <rect id="board" fill="#000" x="0" y="0" width="20" height="20"/>
      <rect id="h1" fill="#000" x="5" y="5" width="8" height="8"/>
      <rect id="h2" fill="#000" x="10" y="10" width="8" height="8"/>
    </svg>`
    const { svg: root } = parseSvgDocument(overlapSvg)
    const shapes = collectShapeElements(root)
    const bKey = shapes.find((s) => s.element.getAttribute('id') === 'board')!.key
    const k1 = shapes.find((s) => s.element.getAttribute('id') === 'h1')!.key
    const k2 = shapes.find((s) => s.element.getAttribute('id') === 'h2')!.key
    const { result } = await parseSvgGeo(overlapSvg, {
      [bKey]: { mode: 'fill', layer: 1 },
      [k1]: { mode: 'subtract', layer: 1 },
      [k2]: { mode: 'subtract', layer: 1 }
    })
    const fill = result.polygons.find((p) => p.toolpathKind === 'fill')
    expect(fill?.holes.length).toBe(1)
  })

  it('keeps both holes when subtracts on different layers', async () => {
    const { board, h1, h2 } = await keys()
    const { result } = await parseSvgGeo(svg, {
      [board]: { mode: 'fill', layer: 1 },
      [h1]: { mode: 'subtract', layer: 2 },
      [h2]: { mode: 'subtract', layer: 3 }
    })
    const fill = result.polygons.find((p) => p.toolpathKind === 'fill')
    expect(fill?.holes.length).toBe(2)
  })
})
