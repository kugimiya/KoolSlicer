import { describe, expect, it } from 'vitest'

import { importSvgGeometry } from './importSvg'

import { parseSvgGeo } from './pipeline'



describe('geo import', () => {

  it('splits disjoint multi-subpath into two filled compounds', async () => {
    const svg = `<svg viewBox="0 0 120 120" width="120mm" height="120mm">
      <path fill="#000" d="M 0 0 L 10 0 L 10 10 L 0 10 Z M 100 100 L 110 100 L 110 110 L 100 110 Z"/>
    </svg>`
    const { elements } = await importSvgGeometry(svg)
    expect(elements.length).toBe(1)
    expect(elements[0].compounds.length).toBe(2)
    expect(elements[0].contours.length).toBe(0)
  })

  it('nested subpath becomes outer with hole', async () => {
    const svg = `<svg viewBox="0 0 100 100" width="100mm" height="100mm">
      <path fill="#000" d="M 0 0 L 100 0 L 100 100 L 0 100 Z M 20 20 L 80 20 L 80 80 L 20 80 Z"/>
    </svg>`
    const { elements } = await importSvgGeometry(svg)
    expect(elements[0].compounds.length).toBe(1)
    expect(elements[0].compounds[0].holes.length).toBe(1)
  })



  it('imports polyline stroke as closed corridor', async () => {

    const svg = `<svg viewBox="0 0 50 50" width="50mm" height="50mm">

      <polyline points="10 10 40 10" stroke="#000" stroke-width="2" fill="none"/>

    </svg>`

    const { elements } = await importSvgGeometry(svg)

    expect(elements.length).toBe(1)

    expect(elements[0].contours.length).toBeGreaterThan(0)

  })

  it('imports polyline with stroke-width only (EasyEDA export)', async () => {
    const svg = `<svg viewBox="0 0 50 50" width="50mm" height="50mm">
      <polyline points="10 10 40 10" stroke-width="3" fill="none" layerid="1" id="track"/>
    </svg>`
    const { elements } = await importSvgGeometry(svg)
    expect(elements.length).toBe(1)
    expect(elements[0].contours.length).toBeGreaterThan(0)
  })



  it('fill with subtract cuts hole in fill region', async () => {
    const svg = `<svg viewBox="0 0 10 10" width="10mm" height="10mm">
      <rect id="board" fill="#000" x="0" y="0" width="10" height="10"/>
      <rect id="hole" fill="#000" x="3" y="3" width="4" height="4"/>
    </svg>`
    const shapes = await import('../svgDomWalk').then((m) => {
      const { svg: root } = m.parseSvgDocument(svg)
      return m.collectShapeElements(root)
    })
    const boardKey = shapes.find((s) => s.element.getAttribute('id') === 'board')!.key
    const holeKey = shapes.find((s) => s.element.getAttribute('id') === 'hole')!.key
    const { result } = await parseSvgGeo(svg, {
      [boardKey]: { mode: 'fill' },
      [holeKey]: { mode: 'subtract' }
    })
    const fillPoly = result.polygons.find((p) => p.toolpathKind === 'fill')
    expect(fillPoly?.holes.length).toBe(1)
  })

})


