import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { bboxOfPoints, pointInAnyHole, pointInPolygon } from '../geometry'
import { importSvgGeometry } from './importSvg'
import { parseSvgGeo } from './pipeline'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'

const pcbPath = resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg')

async function keys(svg: string) {
  const { svg: root } = parseSvgDocument(svg)
  const shapes = collectShapeElements(root)
  const id = (name: string) => shapes.find((s) => s.element.getAttribute('id') === name)!.key
  return { rect1: id('rect1'), gge1299_4: id('gge1299_4'), gge3498: id('gge3498') }
}

function hasCopperAt(
  fills: { outer: { x: number; y: number }[]; holes: { x: number; y: number }[][] }[],
  p: { x: number; y: number }
): boolean {
  return fills.some((f) => pointInPolygon(p, f.outer) && !pointInAnyHole(p, f.holes))
}

describe.runIf(existsSync(pcbPath))('rect1 + two subtracts', () => {
  it('gge3498 stroke is imported as contour for subtract', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { gge3498 } = await keys(svg)
    const { elements } = await importSvgGeometry(svg)
    const el = elements.find((e) => e.key === gge3498)!
    expect(el.compounds.length).toBe(0)
    expect(el.contours.length).toBeGreaterThan(0)
  })

  it('no rect1 fill under gge3498 stroke after both subtracts', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { rect1, gge1299_4, gge3498 } = await keys(svg)
    const { result, importCache } = await parseSvgGeo(svg, {
      [rect1]: { mode: 'fill', layer: 1 },
      [gge1299_4]: { mode: 'subtract', layer: 1 },
      [gge3498]: { mode: 'subtract', layer: 1 }
    })

    const el3498 = importCache.elements.find((e) => e.key === gge3498)!
    const allPts = [
      ...el3498.compounds.flatMap((c) => [c.outer, ...c.holes]),
      ...el3498.contours
    ]
    const bb = bboxOfPoints(allPts.flat())
    const probe = { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 }

    const fills = result.polygons.filter((p) => p.toolpathKind === 'fill')
    expect(hasCopperAt(fills, probe)).toBe(false)
  })
})
