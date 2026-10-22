import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LASER_SETTINGS } from '@shared/types'
import { collectShapeElements, parseSvgDocument } from './svgDomWalk'
import { parseSvgGeo } from './geo/pipeline'
import { generateFromParse } from './pipeline'
import { DEFAULT_BED_LAYOUT } from '@shared/types'
import { totalRapidLength } from './toolpath'

const pcbPath = resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg')

describe.runIf(existsSync(pcbPath))('pwm555 scanline travel', () => {
  it('no same-row rapids longer than 5mm on rect1 scan fill', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { svg: root } = parseSvgDocument(svg)
    const shapes = collectShapeElements(root)
    const rectKey = shapes.find((s) => s.element.getAttribute('id') === 'rect1')!.key
    const rules = { [rectKey]: { mode: 'fill' as const, layer: 1 } }
    const settings = {
      ...DEFAULT_LASER_SETTINGS,
      fillStrategy: 'scanline' as const,
      beamSize: 0.15,
      travelOptimize: true
    }
    const { importCache, result } = await parseSvgGeo(svg, rules)
    const gen = await generateFromParse(result, settings, DEFAULT_BED_LAYOUT, importCache.boardRef)
    expect(gen.ok, gen.errors.join('; ')).toBe(true)
    const bad = gen.moves.filter(
      (m) =>
        m.type === 'rapid' &&
        Math.abs(m.to.y - m.from.y) < 0.02 &&
        Math.abs(m.to.x - m.from.x) > 5
    )
    expect(bad.length, `worst=${bad[0] ? Math.abs(bad[0].to.x - bad[0].from.x) : 0}`).toBe(0)
    expect(totalRapidLength(gen.moves)).toBeLessThan(5000)
  })

  it('no long same-row rapids with rect1 fill and subtract tracks', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { svg: root } = parseSvgDocument(svg)
    const shapes = collectShapeElements(root)
    const id = (name: string) => shapes.find((s) => s.element.getAttribute('id') === name)!.key
    const rules = {
      [id('rect1')]: { mode: 'fill' as const, layer: 1 },
      [id('gge1299_4')]: { mode: 'subtract' as const, layer: 1 },
      [id('gge3498')]: { mode: 'subtract' as const, layer: 1 }
    }
    const settings = {
      ...DEFAULT_LASER_SETTINGS,
      fillStrategy: 'scanline' as const,
      beamSize: 0.15,
      travelOptimize: true
    }
    const { importCache, result } = await parseSvgGeo(svg, rules)
    const gen = await generateFromParse(result, settings, DEFAULT_BED_LAYOUT, importCache.boardRef)
    expect(gen.ok, gen.errors.join('; ')).toBe(true)
    const bad = gen.moves.filter(
      (m) =>
        m.type === 'rapid' &&
        Math.abs(m.to.y - m.from.y) < 0.02 &&
        Math.abs(m.to.x - m.from.x) > 5
    )
    expect(bad.length, `count=${bad.length} sample=${bad[0]?.from.x}-${bad[0]?.to.x}`).toBe(0)
  })
})
