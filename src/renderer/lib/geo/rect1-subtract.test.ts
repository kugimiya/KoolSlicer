import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { DEFAULT_LASER_SETTINGS } from '@shared/types'
import { bboxOfPoints, pointInAnyHole, pointInPolygon } from '../geometry'
import { generateRings } from '../offset'
import { parseSvgGeo } from './pipeline'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'

const pcbPath = resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg')

async function rect1Gge1299Rules(svg: string) {
  const { svg: root } = parseSvgDocument(svg)
  const shapes = collectShapeElements(root)
  const rectKey = shapes.find((s) => s.element.getAttribute('id') === 'rect1')!.key
  const pathKey = shapes.find((s) => s.element.getAttribute('id') === 'gge1299_4')!.key
  return {
    rectKey,
    pathKey,
    rules: {
      [rectKey]: { mode: 'fill' as const, layer: 1 },
      [pathKey]: { mode: 'subtract' as const, layer: 1 }
    }
  }
}

describe.runIf(existsSync(pcbPath))('rect1 fill + gge1299_4 subtract', () => {
  it('subtract alone does not emit isolation regions', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { rules } = await rect1Gge1299Rules(svg)
    const { result } = await parseSvgGeo(svg, rules)
    expect(result.polygons.filter((p) => p.toolpathKind === 'isolation').length).toBe(0)
  })

  it('rect1 fill remains inside holes of gge1299_4', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { rules, pathKey } = await rect1Gge1299Rules(svg)
    const { result, importCache } = await parseSvgGeo(svg, rules)
    const compound = importCache.elements.find((e) => e.key === pathKey)!.compounds[0]
    expect(compound.holes.length).toBeGreaterThan(0)

    const fills = result.polygons.filter((p) => p.toolpathKind === 'fill')
    const hole = compound.holes[0]
    const hb = bboxOfPoints(hole)
    const probe = { x: (hb.minX + hb.maxX) / 2, y: (hb.minY + hb.maxY) / 2 }

    expect(pointInPolygon(probe, compound.outer)).toBe(true)
    expect(pointInPolygon(probe, hole)).toBe(true)
    const copper = fills.some(
      (p) => pointInPolygon(probe, p.outer) && !pointInAnyHole(probe, p.holes)
    )
    expect(copper).toBe(true)
  })

  it('produces scan-line rings for restored fill in path holes', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { rules } = await rect1Gge1299Rules(svg)
    const { result } = await parseSvgGeo(svg, rules)
    const settings = { ...DEFAULT_LASER_SETTINGS, fillStrategy: 'scanline' as const, beamSize: 0.15 }
    const rings = await generateRings(result.polygons, settings)
    expect(rings.filter((r) => r.closed === false).length).toBeGreaterThan(10)
  })
})
