import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { collectShapeElements, parseSvgDocument } from '../svgDomWalk'
import { importSvgGeometry } from './importSvg'
import { importShapeContours } from './importShape'
import { svgMetricsFromRoot } from '../svgParserDomMetrics'
import { getClipper } from '../clipperInstance'

const paths = [
  resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-18.svg'),
  resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-19.svg'),
  resolve('C:/Users/kugichka/Downloads/PCB_PCB_pwm555_2026-10-19(1).svg')
].filter(existsSync)

describe.runIf(paths.length > 0)('gge3486 import', () => {
  for (const pcbPath of paths) {
    it(`imports geometry for gge3486 in ${pcbPath.split(/[/\\]/).pop()}`, async () => {
      const svgText = readFileSync(pcbPath, 'utf8')
      const hasId = svgText.includes('id="gge3486"')
      const { svg } = parseSvgDocument(svgText)
      const shapes = collectShapeElements(svg)
      const shape = shapes.find((s) => s.element.getAttribute('id') === 'gge3486')
      if (!hasId) {
        expect(shape).toBeUndefined()
        return
      }
      expect(shape, 'gge3486 in shape list').toBeDefined()
      const metrics = svgMetricsFromRoot(svg, svgText)
      const clipper = await getClipper()
      const imported = await importShapeContours(shape!.element, metrics, clipper)
      expect(
        imported.contours.length + imported.compounds.length,
        `raw import contours=${imported.contours.length} compounds=${imported.compounds.length} d=${shape!.element.getAttribute('d')?.slice(0, 80)}`
      ).toBeGreaterThan(0)

      const { elements } = await importSvgGeometry(svgText)
      const el = elements.find((e) => e.key === shape!.key)
      expect(el, 'present in importSvgGeometry elements').toBeDefined()
    })
  }
})
