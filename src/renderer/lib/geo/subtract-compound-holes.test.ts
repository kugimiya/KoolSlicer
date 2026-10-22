import { describe, expect, it } from 'vitest'
import {
  differenceCompoundFromFilledClips,
  getClipper,
  intersectionCompoundFromFilledClips,
  pointInAnyHole,
  pointInPolygon,
  rectPolygon
} from '../geometry'
import { parseSvgGeo } from './pipeline'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'

describe('subtract compound keeps fill in path holes', () => {
  it('simple rect fill minus frame path leaves fill in inner hole', async () => {
    const clipper = await getClipper()
    const board = rectPolygon(0, 0, 100, 100)
    const outer = rectPolygon(20, 20, 60, 60)
    const hole = rectPolygon(35, 35, 10, 10)
    const probe = { x: 40, y: 40 }

    const diff = await differenceCompoundFromFilledClips(
      clipper,
      { outer: board, holes: [] },
      [{ outer, holes: [hole] }]
    )
    const islands = await intersectionCompoundFromFilledClips(clipper, { outer: board, holes: [] }, [
      { outer: hole, holes: [] }
    ])
    const all = [...diff, ...islands]
    const copper = all.some(
      (p) => pointInPolygon(probe, p.outer) && !pointInAnyHole(probe, p.holes)
    )
    expect(copper).toBe(true)
  })

  it('parseSvgGeo rect1 + gge1299_4 keeps fill in subtract path holes', async () => {
    const svg = `<svg viewBox="0 0 100 100" width="100mm" height="100mm">
      <path id="rect1" fill="#fff" d="M 0 0 L 100 0 L 100 100 L 0 100 Z"/>
      <path id="cut" fill="#fff" d="M 20 20 L 80 20 L 80 80 L 20 80 Z M 35 35 L 65 35 L 65 65 L 35 65 Z"/>
    </svg>`
    const { svg: root } = parseSvgDocument(svg)
    const shapes = collectShapeElements(root)
    const rectKey = shapes.find((s) => s.element.getAttribute('id') === 'rect1')!.key
    const cutKey = shapes.find((s) => s.element.getAttribute('id') === 'cut')!.key
    const { result } = await parseSvgGeo(svg, {
      [rectKey]: { mode: 'fill', layer: 1 },
      [cutKey]: { mode: 'subtract', layer: 1 }
    })
    const probe = { x: 50, y: 50 }
    const fills = result.polygons.filter((p) => p.toolpathKind === 'fill')
    const copper = fills.some(
      (p) => pointInPolygon(probe, p.outer) && !pointInAnyHole(probe, p.holes)
    )
    expect(copper).toBe(true)
  })

  it('subtractInvert cuts holes and keeps fill in pour window', async () => {
    const svg = `<svg viewBox="0 0 100 100" width="100mm" height="100mm">
      <path id="rect1" fill="#fff" d="M 0 0 L 100 0 L 100 100 L 0 100 Z"/>
      <path id="cut" fill="#fff" d="M 20 20 L 80 20 L 80 80 L 20 80 Z M 35 35 L 65 35 L 65 65 L 35 65 Z"/>
    </svg>`
    const { svg: root } = parseSvgDocument(svg)
    const shapes = collectShapeElements(root)
    const rectKey = shapes.find((s) => s.element.getAttribute('id') === 'rect1')!.key
    const cutKey = shapes.find((s) => s.element.getAttribute('id') === 'cut')!.key
    const { result } = await parseSvgGeo(svg, {
      [rectKey]: { mode: 'fill', layer: 1 },
      [cutKey]: { mode: 'subtract', layer: 1, subtractInvert: true }
    })
    const windowProbe = { x: 50, y: 25 }
    const holeProbe = { x: 50, y: 50 }
    const fills = result.polygons.filter((p) => p.toolpathKind === 'fill')
    const copperWindow = fills.some(
      (p) => pointInPolygon(windowProbe, p.outer) && !pointInAnyHole(windowProbe, p.holes)
    )
    const copperHole = fills.some(
      (p) => pointInPolygon(holeProbe, p.outer) && !pointInAnyHole(holeProbe, p.holes)
    )
    expect(copperWindow).toBe(true)
    expect(copperHole).toBe(false)
  })
})
