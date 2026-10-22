import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_BED_LAYOUT, DEFAULT_LASER_SETTINGS } from '@shared/types'
import { isolationRulesForAllElements } from './elementRules'
import { parseSvgGeo } from './pipeline'
import { generateFromParse } from '../pipeline'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'

const pcbPath = resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg')

describe.runIf(existsSync(pcbPath))('fill rect subtract path', () => {
  it('isolation polys unchanged bbox vs base', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { svg: root } = parseSvgDocument(svg)
    const shapes = collectShapeElements(root)
    const rectKey = shapes.find((s) => s.element.localName === 'rect')!.key
    const pathKey = shapes.find((s) => s.element.getAttribute('id') === 'gge1299_0')!.key

    const { importCache } = await parseSvgGeo(svg, {})
    const baseRules = isolationRulesForAllElements(importCache.elements)
    const base = await parseSvgGeo(svg, baseRules, importCache)
    const mixedRules = { ...baseRules, [rectKey]: { mode: 'fill' as const }, [pathKey]: { mode: 'subtract' as const } }
    const mixed = await parseSvgGeo(svg, mixedRules, importCache)

    const baseIso = base.result.polygons.filter((p) => p.toolpathKind === 'isolation')
    const mixedIso = mixed.result.polygons.filter((p) => p.toolpathKind === 'isolation')
    // rect ушёл в заливку — в изоляции на один полигон меньше (фон платы)
    expect(mixedIso.length).toBe(baseIso.length - 1)

    const baseBb = base.result.boardBBox
    const mixedBb = mixed.result.boardBBox
    expect(mixedBb.minX).toBeCloseTo(baseBb.minX, 1)
    expect(mixedBb.minY).toBeCloseTo(baseBb.minY, 1)

    const fill = mixed.result.polygons.find((p) => p.toolpathKind === 'fill')
    expect(fill).toBeTruthy()
    expect(fill!.holes.length).toBeGreaterThan(0)

    const baseGen = await generateFromParse(
      base.result,
      DEFAULT_LASER_SETTINGS,
      DEFAULT_BED_LAYOUT,
      base.importCache.boardRef
    )
    const mixedGen = await generateFromParse(
      mixed.result,
      DEFAULT_LASER_SETTINGS,
      DEFAULT_BED_LAYOUT,
      mixed.importCache.boardRef
    )
    expect(mixedGen.ok).toBe(true)
    expect(mixedGen.ringsCount).toBeGreaterThan(baseGen.ringsCount + 50)
    expect(mixedGen.ringsCount).toBeLessThan(baseGen.ringsCount + 250)

    expect(mixedGen.moves.length).toBeGreaterThan(baseGen.moves.length)
  }, 120_000)
})
