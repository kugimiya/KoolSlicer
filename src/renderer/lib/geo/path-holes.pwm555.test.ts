import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { importSvgGeometry } from './importSvg'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'

const pcbPath = resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg')

describe.runIf(existsSync(pcbPath))('pwm555 path with holes', () => {
  it('gge1299_4 imports inner subpaths as holes', async () => {
    const svg = readFileSync(pcbPath, 'utf8')
    const { elements } = await importSvgGeometry(svg)
    const { svg: root } = parseSvgDocument(svg)
    const shapes = collectShapeElements(root)
    const key = shapes.find((s) => s.element.getAttribute('id') === 'gge1299_4')!.key
    const el = elements.find((e) => e.key === key)
    expect(el).toBeTruthy()
    expect(el!.compounds.length).toBeGreaterThan(0)
    const holes = el!.compounds.reduce((n, c) => n + c.holes.length, 0)
    expect(holes).toBeGreaterThan(0)
  })
})
