import { describe, expect, it } from 'vitest'

import { existsSync, readFileSync } from 'fs'

import { resolve } from 'path'

import { parseSvg, parseSvgAllIsolation } from './svgParser'

import { bboxOfPoints } from './geometry'



const samplePath = resolve(__dirname, '../assets/sample.svg')

const pcbPath = resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg')



describe('svgParser', () => {

  it('parses sample.svg in mm', async () => {

    const svg = readFileSync(samplePath, 'utf8')

    expect((await parseSvg(svg)).polygons.length).toBe(0)

    const result = await parseSvgAllIsolation(svg)

    expect(result.polygons.length).toBeGreaterThan(0)

    const b = result.boardBBox

    expect(b.maxX - b.minX).toBeGreaterThan(10)

  })



  it('finds ~0.6mm track height', async () => {

    const svg = readFileSync(samplePath, 'utf8')

    const result = await parseSvgAllIsolation(svg)

    const narrow = result.polygons.find((p) => {

      const bb = bboxOfPoints(p.outer)

      const h = bb.maxY - bb.minY

      return h > 0.55 && h < 0.65

    })

    expect(narrow).toBeTruthy()

  })



  it.runIf(existsSync(pcbPath))('parses EasyEDA pwm555 export', async () => {

    const svg = readFileSync(pcbPath, 'utf8')

    const result = await parseSvgAllIsolation(svg)

    expect(result.polygons.length).toBeGreaterThan(0)
    expect(result.polygons.length).toBeLessThan(500)

    const b = result.boardBBox

    expect(b.maxX - b.minX).toBeGreaterThan(25)

    expect(b.maxY - b.minY).toBeGreaterThan(20)

    expect(b.maxX - b.minX).toBeLessThan(80)

  })

})


