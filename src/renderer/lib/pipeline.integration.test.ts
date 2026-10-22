import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_BED_LAYOUT, DEFAULT_LASER_SETTINGS } from '@shared/types'
import { countDistinctPassIndices, generateRings } from './offset'
import { parseSvg, parseSvgAllIsolation } from './svgParser'
import { generateFromParse } from './pipeline'
import { rectPolygon, bboxOfPoints } from './geometry'

const samplePath = resolve(__dirname, '../assets/sample.svg')

describe('pipeline integration', () => {
  it('parses sample.svg', async () => {
    const svg = readFileSync(samplePath, 'utf8')
    const parsed = await parseSvgAllIsolation(svg)
    expect(parsed.polygons.length).toBeGreaterThan(0)
    expect((await parseSvg(svg)).polygons.length).toBe(0)
  })

  it('track 2mm produces one isolation ring', async () => {
    const poly = [{ id: 0, outer: rectPolygon(0, 0, 20, 2), holes: [] as never[], toolpathKind: 'isolation' as const }]
    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 0.1 }
    const rings = await generateRings(poly, settings)
    expect(countDistinctPassIndices(rings)).toBe(1)
  })

  it('gcode wrapper from full pipeline', async () => {
    const svg = readFileSync(samplePath, 'utf8')
    const parsed = await parseSvgAllIsolation(svg)
    const layout = {
      ...DEFAULT_BED_LAYOUT,
      workArea: { widthMm: 300, heightMm: 250 },
      blank: { widthMm: 200, heightMm: 200, offsetX: 10, offsetY: 20 },
      panel: { ...DEFAULT_BED_LAYOUT.panel, columns: 2, rows: 3 }
    }
    const result = await generateFromParse(parsed, DEFAULT_LASER_SETTINGS, layout)
    expect(result.moves.length).toBeGreaterThan(0)
    expect(result.gcodeLines[0]).toBe('G21')
    expect(result.gcodeLines.includes('M2')).toBe(true)
    const rapids = result.moves.filter((m) => m.type === 'rapid')
    expect(rapids.length).toBeGreaterThan(0)
    for (let i = 0; i < result.gcodeLines.length - 1; i++) {
      if (result.gcodeLines[i].startsWith('G0 ')) {
        expect(result.gcodeLines[i - 1]).toBe('M5')
      }
    }
    for (const m of result.moves) {
      expect(m.to.x).toBeLessThanOrEqual(layout.workArea.widthMm + 1)
      expect(m.to.y).toBeLessThanOrEqual(layout.workArea.heightMm + 1)
    }
  })

  it('narrow track in sample produces non-empty toolpath', async () => {
    const svg = readFileSync(samplePath, 'utf8')
    const parsed = await parseSvgAllIsolation(svg)
    const narrow = parsed.polygons.find((p) => {
      const b = bboxOfPoints(p.outer)
      const h = b.maxY - b.minY
      return h > 0.55 && h < 0.65
    })
    expect(narrow).toBeTruthy()
    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 1 }
    const rings = await generateRings([narrow!], settings)
    expect(rings.length).toBeGreaterThan(0)
  })
})
