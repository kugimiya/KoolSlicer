import { existsSync, readFileSync } from 'fs'

import { resolve } from 'path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_BED_LAYOUT, DEFAULT_LASER_SETTINGS } from '@shared/types'

import { isolationRulesForAllElements } from './elementRules'
import { parseSvgGeo } from './pipeline'

import { generateFromParse } from '../pipeline'



const pcbPath = resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg')



const GEO_LIMITS_MAX = 2000



describe.runIf(existsSync(pcbPath))('geo pwm555', () => {

  it('parse bbox and region count', async () => {

    const svg = readFileSync(pcbPath, 'utf8')

    const { importCache } = await parseSvgGeo(svg, {})
    expect(
      importCache.elements.some((e) => e.contours.length > 0 || e.compounds.length > 0)
    ).toBe(true)

    const rules = isolationRulesForAllElements(importCache.elements)
    const { result } = await parseSvgGeo(svg, rules, importCache)

    const b = result.boardBBox

    expect(b.maxX - b.minX).toBeLessThan(80)

    expect(b.maxY - b.minY).toBeLessThan(80)

    expect(result.polygons.length).toBeLessThan(GEO_LIMITS_MAX)

  })



  it('isolation rings bounded', async () => {

    const svg = readFileSync(pcbPath, 'utf8')

    const { importCache } = await parseSvgGeo(svg, {})
    const rules = isolationRulesForAllElements(importCache.elements)
    const { result } = await parseSvgGeo(svg, rules, importCache)

    const layout = {

      ...DEFAULT_BED_LAYOUT,

      blank: { widthMm: 100, heightMm: 100, offsetX: 1, offsetY: 1 }

    }

    const gen = await generateFromParse(result, DEFAULT_LASER_SETTINGS, layout, importCache.boardRef)

    expect(gen.ok, gen.errors.join('; ')).toBe(true)

    expect(gen.ringsCount).toBeLessThan(800)

  })

})


