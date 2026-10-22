import {
  DEFAULT_BED_LAYOUT,
  DEFAULT_LASER_SETTINGS,
  type BedLayout,
  type LaserSettings,
  type SvgElementRules
} from './types'

export const PROJECT_FORMAT_VERSION = 1

export type KoolSlicerProjectFile = {
  formatVersion: typeof PROJECT_FORMAT_VERSION
  app: 'koolslicer'
  svgName: string
  svgText: string
  settings: LaserSettings
  bedLayout: BedLayout
  svgElementRules: SvgElementRules
}

export function buildProjectFile(input: {
  svgName: string
  svgText: string
  settings: LaserSettings
  bedLayout: BedLayout
  svgElementRules: SvgElementRules
}): KoolSlicerProjectFile {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    app: 'koolslicer',
    svgName: input.svgName,
    svgText: input.svgText,
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
    svgElementRules: { ...input.svgElementRules }
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

export function parseProjectFile(json: string): KoolSlicerProjectFile {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Файл проекта: неверный JSON')
  }
  if (!isRecord(raw)) throw new Error('Файл проекта: ожидается объект')
  if (raw.formatVersion !== PROJECT_FORMAT_VERSION) {
    throw new Error(`Файл проекта: неподдерживаемая версия (${String(raw.formatVersion)})`)
  }
  if (raw.app !== 'koolslicer') {
    throw new Error('Файл проекта: это не проект KoolSlicer')
  }
  const svgName = typeof raw.svgName === 'string' ? raw.svgName : 'project.svg'
  const svgText = typeof raw.svgText === 'string' ? raw.svgText : ''
  if (!svgText.trim()) throw new Error('Файл проекта: пустой SVG')

  const settings = {
    ...DEFAULT_LASER_SETTINGS,
    ...(isRecord(raw.settings) ? raw.settings : {})
  } as LaserSettings

  const bedLayout = mergeBedLayout(raw.bedLayout)

  const svgElementRules: SvgElementRules = isRecord(raw.svgElementRules)
    ? (raw.svgElementRules as SvgElementRules)
    : {}

  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    app: 'koolslicer',
    svgName,
    svgText,
    settings,
    bedLayout,
    svgElementRules
  }
}

export function defaultProjectFileName(svgName: string | null): string {
  const base = (svgName ?? 'project').replace(/\.svg$/i, '')
  return `${base}.koolslicer`
}

export function defaultGcodeFileName(svgName: string | null): string {
  const base = (svgName ?? 'job').replace(/\.svg$/i, '')
  return `${base}.gcode`
}

export function defaultOutlineGcodeFileName(svgName: string | null): string {
  const base = (svgName ?? 'job').replace(/\.svg$/i, '')
  return `${base}-outline.gcode`
}
