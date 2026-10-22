import { existsSync, readFileSync } from 'fs'

import { resolve } from 'path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_BED_LAYOUT, DEFAULT_LASER_SETTINGS } from '@shared/types'

import { parseSvgAllIsolation } from './svgParser'

import { generateFromParse } from './pipeline'



const pcbPath = resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg')



describe.runIf(existsSync(pcbPath))('pwm555 generate', () => {

  it('produces moves with isolation outline', async () => {

    const svg = readFileSync(pcbPath, 'utf8')

    const parsed = await parseSvgAllIsolation(svg)

    const layout = {

      ...DEFAULT_BED_LAYOUT,

      blank: { widthMm: 100, heightMm: 100, offsetX: 1, offsetY: 1 }

    }

    const b = parsed.boardBBox

    const boardW = b.maxX - b.minX

    const boardH = b.maxY - b.minY

    const result = await generateFromParse(parsed, DEFAULT_LASER_SETTINGS, layout)

    if (!result.ok) {

      console.log('board mm', boardW, boardH, 'errors', result.errors)

    }

    expect(result.ok, result.errors.join('; ')).toBe(true)

    expect(result.moves.length).toBeGreaterThan(0)

    expect(result.ringsCount).toBeLessThan(500)

  }, 120_000)

})

