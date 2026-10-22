import { describe, expect, it } from 'vitest'
import { DEFAULT_BED_LAYOUT, DEFAULT_LASER_SETTINGS } from './types'
import { buildProjectFile, parseProjectFile, serializeProjectFile } from './project'

describe('project file', () => {
  it('round-trips svg and settings without gcode', () => {
    const proper = buildProjectFile({
      svgName: 'board.svg',
      svgText: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
      settings: { ...DEFAULT_LASER_SETTINGS, beamSize: 0.2, fillStrategy: 'scanline' },
      bedLayout: {
        ...DEFAULT_BED_LAYOUT,
        blank: { widthMm: 50, heightMm: 50, offsetX: 1, offsetY: 2 },
        panel: { ...DEFAULT_BED_LAYOUT.panel, columns: 2 }
      },
      svgElementRules: { '0': { mode: 'fill', layer: 1 } }
    })
    const json = serializeProjectFile(proper)
    expect(json.toLowerCase()).not.toContain('"gcode"')
    const loaded = parseProjectFile(json)
    expect(loaded.svgName).toBe('board.svg')
    expect(loaded.settings.beamSize).toBe(0.2)
    expect(loaded.settings.fillStrategy).toBe('scanline')
    expect(loaded.svgElementRules['0']?.mode).toBe('fill')
    expect(loaded.bedLayout.panel.columns).toBe(2)
  })
})
