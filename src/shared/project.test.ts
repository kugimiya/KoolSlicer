import { describe, expect, it } from 'vitest'
import { DEFAULT_BED_LAYOUT, DEFAULT_LASER_SETTINGS } from './types'
import { buildProjectFile, parseProjectFile, serializeProjectFile } from './project'

describe('project file', () => {
  it('round-trips dual layers without gcode', () => {
    const proper = buildProjectFile({
      settings: { ...DEFAULT_LASER_SETTINGS, beamSize: 0.2, fillStrategy: 'scanline' },
      bedLayout: {
        ...DEFAULT_BED_LAYOUT,
        blank: { widthMm: 50, heightMm: 50, offsetX: 1, offsetY: 2 },
        panel: { ...DEFAULT_BED_LAYOUT.panel, columns: 2 }
      },
      layers: {
        top: {
          svgName: 'board-top.svg',
          svgText: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
          svgElementRules: { '0': { mode: 'fill', layer: 1 } }
        },
        bottom: {
          svgName: 'board-bottom.svg',
          svgText: '<svg viewBox="0 0 8 8"><rect width="8" height="8"/></svg>',
          svgElementRules: { '1': { mode: 'isolation', layer: 1 } }
        }
      }
    })
    const json = serializeProjectFile(proper)
    expect(json.toLowerCase()).not.toContain('"gcode"')
    const loaded = parseProjectFile(json)
    expect(loaded.layers.top?.svgName).toBe('board-top.svg')
    expect(loaded.layers.bottom?.svgName).toBe('board-bottom.svg')
    expect(loaded.settings.beamSize).toBe(0.2)
    expect(loaded.layers.top?.svgElementRules['0']?.mode).toBe('fill')
    expect(loaded.bedLayout.panel.columns).toBe(2)
  })

  it('migrates format v1 to top layer only', () => {
    const v1 = {
      formatVersion: 1,
      app: 'koolslicer',
      svgName: 'legacy.svg',
      svgText: '<svg viewBox="0 0 5 5"><rect width="5" height="5"/></svg>',
      settings: DEFAULT_LASER_SETTINGS,
      bedLayout: DEFAULT_BED_LAYOUT,
      svgElementRules: {}
    }
    const loaded = parseProjectFile(JSON.stringify(v1))
    expect(loaded.layers.top?.svgName).toBe('legacy.svg')
    expect(loaded.layers.bottom).toBeNull()
  })
})
