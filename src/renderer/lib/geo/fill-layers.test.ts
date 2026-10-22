import { describe, expect, it } from 'vitest'
import { parseSvgGeo } from './pipeline'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'

const svg = `<svg viewBox="0 0 10 10" width="10mm" height="10mm">
  <rect id="board" fill="#000" x="0" y="0" width="10" height="10"/>
  <rect id="hole" fill="#000" x="3" y="3" width="4" height="4"/>
</svg>`

async function keys() {
  const { svg: root } = parseSvgDocument(svg)
  const shapes = collectShapeElements(root)
  const boardKey = shapes.find((s) => s.element.getAttribute('id') === 'board')!.key
  const holeKey = shapes.find((s) => s.element.getAttribute('id') === 'hole')!.key
  return { boardKey, holeKey }
}

describe('fill/subtract layers', () => {
  it('layer 1 fill + layer 2 subtract cuts fill', async () => {
    const { boardKey, holeKey } = await keys()
    const { result } = await parseSvgGeo(svg, {
      [boardKey]: { mode: 'fill', layer: 1 },
      [holeKey]: { mode: 'subtract', layer: 2 }
    })
    const fillPoly = result.polygons.find((p) => p.toolpathKind === 'fill')
    expect(fillPoly?.holes.length).toBe(1)
  })

  it('layer 2 fill + layer 1 subtract does not cut fill', async () => {
    const { boardKey, holeKey } = await keys()
    const { result } = await parseSvgGeo(svg, {
      [boardKey]: { mode: 'fill', layer: 2 },
      [holeKey]: { mode: 'subtract', layer: 1 }
    })
    const fillPoly = result.polygons.find((p) => p.toolpathKind === 'fill')
    expect(fillPoly?.holes.length ?? 0).toBe(0)
  })
})
