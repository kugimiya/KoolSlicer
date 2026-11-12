import {
  DEFAULT_BED_LAYOUT,
  DEFAULT_LASER_SETTINGS,
  type BedLayout,
  type LaserSettings,
  type SvgElementRules
} from './types'
import type { LayerSvgBundle, PcbLayerSide } from './layers'

export const PROJECT_FORMAT_VERSION = 2

export type KoolSlicerProjectFile = {
  formatVersion: typeof PROJECT_FORMAT_VERSION
  app: 'koolslicer'
  settings: LaserSettings
  bedLayout: BedLayout
  layers: Record<PcbLayerSide, LayerSvgBundle | null>
}

export function buildProjectFile(input: {
  settings: LaserSettings
  bedLayout: BedLayout
  layers: Record<PcbLayerSide, LayerSvgBundle | null>
}): KoolSlicerProjectFile {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    app: 'koolslicer',
    settings: { ...input.settings },
    bedLayout: {
      workArea: { ...input.bedLayout.workArea },
      blank: { ...input.bedLayout.blank },
      panel: { ...input.bedLayout.panel },
      boardAnchor: input.bedLayout.boardAnchor,
      boardSizeOverride: input.bedLayout.boardSizeOverride
        ? { ...input.bedLayout.boardSizeOverride }
        : null
    },
    layers: {
      top: input.layers.top ? { ...input.layers.top, svgElementRules: { ...input.layers.top.svgElementRules } } : null,
      bottom: input.layers.bottom
        ? { ...input.layers.bottom, svgElementRules: { ...input.layers.bottom.svgElementRules } }
        : null
    }
  }
}

export function serializeProjectFile(project: KoolSlicerProjectFile): string {
  return JSON.stringify(project, null, 2)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mergeBedLayout(raw: unknown): BedLayout {
  const base = {
    workArea: { ...DEFAULT_BED_LAYOUT.workArea },
    blank: { ...DEFAULT_BED_LAYOUT.blank },
    panel: { ...DEFAULT_BED_LAYOUT.panel },
    boardAnchor: DEFAULT_BED_LAYOUT.boardAnchor,
    boardSizeOverride: DEFAULT_BED_LAYOUT.boardSizeOverride
  }
  if (!isRecord(raw)) return base
  if (isRecord(raw.workArea)) {
    base.workArea = { ...base.workArea, ...raw.workArea } as BedLayout['workArea']
  }
  if (isRecord(raw.blank)) {
    base.blank = { ...base.blank, ...raw.blank } as BedLayout['blank']
  }
  if (isRecord(raw.panel)) {
    base.panel = { ...base.panel, ...raw.panel } as BedLayout['panel']
  }
  if (raw.boardAnchor === 'svgOrigin' || raw.boardAnchor === 'bboxMin') {
    base.boardAnchor = raw.boardAnchor
  }
  if (raw.boardSizeOverride === null) {
    base.boardSizeOverride = null
  } else if (isRecord(raw.boardSizeOverride)) {
    const w = Number(raw.boardSizeOverride.widthMm)
    const h = Number(raw.boardSizeOverride.heightMm)
    if (Number.isFinite(w) && Number.isFinite(h)) {
      base.boardSizeOverride = { widthMm: w, heightMm: h }
    }
  }
  return base
}

function parseLayerBundle(raw: unknown): LayerSvgBundle | null {
  if (!isRecord(raw)) return null
  const svgName = typeof raw.svgName === 'string' ? raw.svgName : 'layer.svg'
  const svgText = typeof raw.svgText === 'string' ? raw.svgText : ''
  if (!svgText.trim()) return null
  const svgElementRules: SvgElementRules = isRecord(raw.svgElementRules)
    ? (raw.svgElementRules as SvgElementRules)
    : {}
  return { svgName, svgText, svgElementRules }
}

function parseV1Layer(raw: Record<string, unknown>): Record<PcbLayerSide, LayerSvgBundle | null> {
  const svgName = typeof raw.svgName === 'string' ? raw.svgName : 'project.svg'
  const svgText = typeof raw.svgText === 'string' ? raw.svgText : ''
  const svgElementRules: SvgElementRules = isRecord(raw.svgElementRules)
    ? (raw.svgElementRules as SvgElementRules)
    : {}
  if (!svgText.trim()) {
    return { top: null, bottom: null }
  }
  return {
    top: { svgName, svgText, svgElementRules },
    bottom: null
  }
}

export function parseProjectFile(json: string): KoolSlicerProjectFile {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Файл проекта: неверный JSON')
  }
  if (!isRecord(raw)) throw new Error('Файл проекта: ожидается объект')
  if (raw.app !== 'koolslicer') {
    throw new Error('Файл проекта: это не проект KoolSlicer')
  }

  const version = raw.formatVersion
  if (version !== 1 && version !== PROJECT_FORMAT_VERSION) {
    throw new Error(`Файл проекта: неподдерживаемая версия (${String(version)})`)
  }

  const settings = {
    ...DEFAULT_LASER_SETTINGS,
    ...(isRecord(raw.settings) ? raw.settings : {})
  } as LaserSettings

  const bedLayout = mergeBedLayout(raw.bedLayout)

  let layers: Record<PcbLayerSide, LayerSvgBundle | null>
  if (version === 1) {
    layers = parseV1Layer(raw)
  } else if (isRecord(raw.layers)) {
    layers = {
      top: parseLayerBundle(raw.layers.top),
      bottom: parseLayerBundle(raw.layers.bottom)
    }
  } else {
    layers = { top: null, bottom: null }
  }

  if (!layers.top && !layers.bottom) {
    throw new Error('Файл проекта: нет SVG ни для одного слоя')
  }

  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    app: 'koolslicer',
    settings,
    bedLayout,
    layers
  }
}

export function defaultProjectFileName(primarySvgName: string | null): string {
  const base = (primarySvgName ?? 'project').replace(/\.svg$/i, '')
  return `${base}.koolslicer`
}

export function defaultGcodeFileName(svgName: string | null, side: PcbLayerSide): string {
  const base = (svgName ?? 'job').replace(/\.svg$/i, '')
  const suffix = side === 'top' ? 'top' : 'bottom'
  return `${base}-${suffix}.gcode`
}
