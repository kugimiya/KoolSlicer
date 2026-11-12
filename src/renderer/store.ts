import { create } from 'zustand'

import {
  DEFAULT_BED_LAYOUT,
  DEFAULT_LASER_SETTINGS,
  type BedLayout,
  type LaserSettings,
  type SvgElementMode,
  type SvgElementRules
} from '@shared/types'
import type { PcbLayerSide } from '@shared/layers'

import { getClipper } from './lib/clipperInstance'

import { buildSvgElementTree, parseSvgDocument } from './lib/svgParser'

import { generateFromParse } from './lib/pipeline'

import { createDebounced } from './lib/autoRebuild'

import { parseSvgGeo } from './lib/geo/pipeline'

import { parseProjectFile } from '@shared/project'

import { emptyPcbLayerJob, type PcbLayerJob } from './store/layerTypes'

let rebuildGeneration = 0

const scheduleGeometryRebuild = createDebounced(280, () => {
  void useAppStore.getState().rebuildJob({ skipConfirm: true })
})

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

type ViewTab = 'preview' | 'polygons'

type AppState = {
  clipperReady: boolean
  settings: LaserSettings
  bedLayout: BedLayout
  topLayer: PcbLayerJob
  bottomLayer: PcbLayerJob
  previewShowTop: boolean
  previewShowBottom: boolean
  svgPanelTab: PcbLayerSide
  errors: string[]
  warnings: string[]
  statusMessage: string
  busyCount: number
  viewTab: ViewTab
  playerTime: number
  playerSpeed: number
  playerPlaying: boolean
  currentGcodeLine: number

  initClipper: () => Promise<void>
  setSettings: (patch: Partial<LaserSettings>) => void
  setBedLayout: (patch: Partial<BedLayout>) => void
  setViewTab: (tab: ViewTab) => void
  setStatus: (msg: string) => void
  setPreviewShowTop: (v: boolean) => void
  setPreviewShowBottom: (v: boolean) => void
  setSvgPanelTab: (tab: PcbLayerSide) => void
  setSvgElementMode: (side: PcbLayerSide, elementId: string, mode: SvgElementMode | 'skip') => void
  setSvgElementLayer: (side: PcbLayerSide, elementId: string, layer: number) => void
  setSvgElementSubtractInvert: (side: PcbLayerSide, elementId: string, invert: boolean) => void
  loadLayerSvg: (side: PcbLayerSide, name: string, text: string) => Promise<void>
  loadProject: (projectFileName: string, jsonText: string) => Promise<void>
  generate: (opts?: { skipConfirm?: boolean }) => Promise<boolean>
  rebuildJob: (opts?: {
    skipConfirm?: boolean
    rebuildGeometryCache?: boolean
    skipGenerate?: boolean
  }) => Promise<void>
  setPlayerTime: (t: number) => void
  setPlayerSpeed: (s: number) => void
  setPlayerPlaying: (p: boolean) => void
  setCurrentGcodeLine: (n: number) => void
  resetPlayer: () => void
}

function incBusy(set: (fn: (s: AppState) => Partial<AppState>) => void): void {
  set((s) => ({ busyCount: s.busyCount + 1 }))
}

function decBusy(set: (fn: (s: AppState) => Partial<AppState>) => void): void {
  set((s) => ({ busyCount: Math.max(0, s.busyCount - 1) }))
}

function layerKey(side: PcbLayerSide): 'topLayer' | 'bottomLayer' {
  return side === 'top' ? 'topLayer' : 'bottomLayer'
}

function getLayer(state: AppState, side: PcbLayerSide): PcbLayerJob {
  return state[layerKey(side)]
}

function patchLayer(
  side: PcbLayerSide,
  patch: Partial<PcbLayerJob>
): (s: AppState) => Partial<AppState> {
  const key = layerKey(side)
  return (s) => ({ [key]: { ...s[key], ...patch } } as Partial<AppState>)
}

export function singlePreviewLayer(state: Pick<AppState, 'previewShowTop' | 'previewShowBottom'>): PcbLayerSide | null {
  const { previewShowTop, previewShowBottom } = state
  if (previewShowTop && !previewShowBottom) return 'top'
  if (previewShowBottom && !previewShowTop) return 'bottom'
  return null
}

export function activePlayerLayer(state: AppState): PcbLayerJob | null {
  const side = singlePreviewLayer(state)
  if (!side) return null
  return getLayer(state, side)
}

export const useAppStore = create<AppState>((set, get) => ({
  clipperReady: false,
  settings: { ...DEFAULT_LASER_SETTINGS },
  bedLayout: { ...DEFAULT_BED_LAYOUT },
  topLayer: emptyPcbLayerJob(),
  bottomLayer: emptyPcbLayerJob(),
  previewShowTop: true,
  previewShowBottom: false,
  svgPanelTab: 'top',
  errors: [],
  warnings: [],
  statusMessage: 'Загрузите SVG верхнего слоя',
  busyCount: 0,
  viewTab: 'preview',
  playerTime: 0,
  playerSpeed: 1,
  playerPlaying: false,
  currentGcodeLine: 0,

  initClipper: async () => {
    incBusy(set)
    try {
      await getClipper()
      set({ clipperReady: true })
    } finally {
      decBusy(set)
    }
  },

  setSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    scheduleGeometryRebuild()
  },

  setBedLayout: (patch) => {
    set((s) => ({
      bedLayout: {
        ...s.bedLayout,
        ...patch,
        workArea: { ...s.bedLayout.workArea, ...patch.workArea },
        blank: { ...s.bedLayout.blank, ...patch.blank },
        panel: { ...s.bedLayout.panel, ...patch.panel }
      }
    }))
    scheduleGeometryRebuild()
  },

  setViewTab: (tab) => set({ viewTab: tab }),
  setStatus: (msg) => set({ statusMessage: msg }),
  setPreviewShowTop: (v) => {
    set({ previewShowTop: v, playerPlaying: false, playerTime: 0, currentGcodeLine: 0 })
  },
  setPreviewShowBottom: (v) => {
    set({ previewShowBottom: v, playerPlaying: false, playerTime: 0, currentGcodeLine: 0 })
  },
  setSvgPanelTab: (tab) => set({ svgPanelTab: tab }),

  setSvgElementMode: (side, elementId, mode) => {
    set((s) => {
      const key = layerKey(side)
      const layer = s[key]
      const next = { ...layer.svgElementRules }
      const l = next[elementId]?.layer ?? 1
      if (mode === 'skip') delete next[elementId]
      else {
        const prev = next[elementId]
        next[elementId] = {
          mode,
          layer: l,
          subtractInvert: mode === 'subtract' ? prev?.subtractInvert : undefined
        }
      }
      return { [key]: { ...layer, svgElementRules: next } } as Partial<AppState>
    })
    scheduleGeometryRebuild()
  },

  setSvgElementSubtractInvert: (side, elementId, invert) => {
    set((s) => {
      const key = layerKey(side)
      const layer = s[key]
      const next = { ...layer.svgElementRules }
      const cur = next[elementId]
      if (!cur || cur.mode !== 'subtract') return s
      next[elementId] = { ...cur, subtractInvert: invert }
      return { [key]: { ...layer, svgElementRules: next } } as Partial<AppState>
    })
    scheduleGeometryRebuild()
  },

  setSvgElementLayer: (side, elementId, layerNum) => {
    const n = Math.min(99, Math.max(1, Math.round(layerNum) || 1))
    set((s) => {
      const key = layerKey(side)
      const layer = s[key]
      const next = { ...layer.svgElementRules }
      const cur = next[elementId]
      if (!cur) return s
      next[elementId] = { ...cur, layer: n }
      return { [key]: { ...layer, svgElementRules: next } } as Partial<AppState>
    })
    scheduleGeometryRebuild()
  },

  rebuildJob: async (opts = {}) => {
    const skipConfirm = opts.skipConfirm ?? true
    const gen = ++rebuildGeneration
    const state = get()
    const sides: PcbLayerSide[] = ['top', 'bottom']
    const toRebuild = sides.filter((side) => getLayer(state, side).svgText)
    if (toRebuild.length === 0) return

    incBusy(set)
    set({ statusMessage: 'Пересчёт полигонов…' })
    await yieldToUi()

    const allWarnings: string[] = []
    try {
      for (const side of toRebuild) {
        let layer = getLayer(get(), side)
        let importCache = layer.geometryImportCache
        let assembleCache = layer.assembleCache
        if (opts.rebuildGeometryCache) {
          importCache = null
          assembleCache = null
        }
        if (!layer.svgText) continue

        const { result, importCache: nextImport, assembleCache: nextAssemble } = await parseSvgGeo(
          layer.svgText,
          layer.svgElementRules,
          importCache,
          assembleCache
        )
        if (gen !== rebuildGeneration) return

        set(
          patchLayer(side, {
            parseResult: result,
            geometryImportCache: nextImport,
            assembleCache: nextAssemble,
            boardRef: nextImport.boardRef,
            moves: [],
            gcode: '',
            gcodeLines: [],
            timeline: null
          })
        )
        allWarnings.push(...result.warnings.map((w) => w.message))
        layer = getLayer(get(), side)
      }

      if (gen !== rebuildGeneration) return
      const top = get().topLayer
      const polyCount = (top.parseResult?.polygons.length ?? 0) + (get().bottomLayer.parseResult?.polygons.length ?? 0)
      set({
        errors: [],
        warnings: allWarnings,
        statusMessage:
          polyCount > 0
            ? `Полигонов: ${polyCount}`
            : 'Отметьте элементы для гравировки (изоляция / ▣ / −)'
      })
    } catch (err) {
      if (gen !== rebuildGeneration) return
      set({
        errors: [err instanceof Error ? err.message : 'Ошибка парсинга'],
        statusMessage: 'Нет контуров для обработки'
      })
      return
    } finally {
      decBusy(set)
    }

    if (gen !== rebuildGeneration || opts.skipGenerate) return

    const anyPoly =
      (get().topLayer.parseResult?.polygons.length ?? 0) > 0 ||
      (get().bottomLayer.parseResult?.polygons.length ?? 0) > 0
    if (!anyPoly) return

    await yieldToUi()
    await get().generate({ skipConfirm })
  },

  loadLayerSvg: async (side, name, text) => {
    incBusy(set)
    try {
      const { svg } = parseSvgDocument(text)
      const svgElementTree = buildSvgElementTree(svg)
      set(
        patchLayer(side, {
          svgName: name,
          svgText: text,
          svgElementTree,
          svgElementRules: {},
          geometryImportCache: null,
          assembleCache: null,
          boardRef: null,
          parseResult: null,
          moves: [],
          gcode: '',
          gcodeLines: [],
          timeline: null
        })
      )
      const label = side === 'top' ? 'верхний' : 'нижний'
      set({ statusMessage: `Загружен ${label} слой: ${name}, построение кэша…` })
      await get().rebuildJob({ skipConfirm: true, rebuildGeometryCache: true, skipGenerate: true })
      set({ statusMessage: `Загружен ${label} слой: ${name}. Отметьте элементы для гравировки.` })
    } catch (err) {
      set(
        patchLayer(side, {
          parseResult: null,
          geometryImportCache: null
        })
      )
      set({
        errors: [err instanceof Error ? err.message : 'Ошибка парсинга SVG'],
        statusMessage: 'Ошибка загрузки SVG'
      })
    } finally {
      decBusy(set)
    }
  },

  loadProject: async (projectFileName, jsonText) => {
    incBusy(set)
    try {
      const project = parseProjectFile(jsonText)
      const loadSide = async (side: PcbLayerSide, bundle: typeof project.layers.top) => {
        if (!bundle) return emptyPcbLayerJob()
        const { svg } = parseSvgDocument(bundle.svgText)
        return {
          ...emptyPcbLayerJob(),
          svgName: bundle.svgName,
          svgText: bundle.svgText,
          svgElementTree: buildSvgElementTree(svg),
          svgElementRules: bundle.svgElementRules
        } satisfies PcbLayerJob
      }
      const topLayer = await loadSide('top', project.layers.top)
      const bottomLayer = await loadSide('bottom', project.layers.bottom)

      set({
        settings: project.settings,
        bedLayout: project.bedLayout,
        topLayer,
        bottomLayer,
        errors: [],
        warnings: [],
        playerTime: 0,
        playerPlaying: false,
        currentGcodeLine: 0,
        statusMessage: `Проект ${projectFileName}, построение…`
      })

      await get().rebuildJob({ skipConfirm: true, rebuildGeometryCache: true, skipGenerate: true })
      set({ statusMessage: `Загружен проект ${projectFileName}` })
    } catch (err) {
      set({
        errors: [err instanceof Error ? err.message : 'Ошибка проекта'],
        statusMessage: 'Ошибка загрузки проекта'
      })
    } finally {
      decBusy(set)
    }
  },

  generate: async (opts) => {
    const skipConfirm = opts?.skipConfirm ?? false
    const { settings, bedLayout } = get()

    for (const side of ['top', 'bottom'] as const) {
      const layer = getLayer(get(), side)
      if (!layer.parseResult && layer.svgText) {
        await get().rebuildJob({ skipConfirm: true, rebuildGeometryCache: !layer.geometryImportCache })
      }
    }

    if (settings.beamSize <= 0) {
      set({ errors: ['beamSize должен быть > 0'], statusMessage: 'Неверные настройки' })
      return false
    }
    if (settings.power <= 0) {
      set({ errors: ['Мощность (S) должна быть > 0'], statusMessage: 'Неверные настройки' })
      return false
    }
    if (
      !skipConfirm &&
      settings.passes > 10_000 &&
      !window.confirm('Более 10000 проходов — продолжить?')
    ) {
      return false
    }
    if (
      !skipConfirm &&
      bedLayout.panel.columns * bedLayout.panel.rows > 100 &&
      !window.confirm('Более 100 копий — продолжить?')
    ) {
      return false
    }

    incBusy(set)
    set({ statusMessage: 'Генерация G-code…' })

    const errors: string[] = []
    const warnings: string[] = []
    let anyOk = false
  try {
      for (const side of ['top', 'bottom'] as const) {
        const layer = getLayer(get(), side)
        const fresh = layer.parseResult
        if (!fresh || fresh.polygons.length === 0) {
          set(patchLayer(side, { moves: [], gcode: '', gcodeLines: [], timeline: null }))
          continue
        }

        const result = await generateFromParse(fresh, settings, bedLayout, layer.boardRef, side)
        errors.push(...result.errors)
        warnings.push(...result.warnings)
        if (result.ok) anyOk = true

        const playable = singlePreviewLayer(get())
        let playerTime = get().playerTime
        if (playable === side && result.timeline) {
          playerTime = result.timeline.totalTime
        }

        set(
          patchLayer(side, {
            moves: result.moves,
            gcode: result.gcode,
            gcodeLines: result.gcodeLines,
            timeline: result.timeline
          })
        )
        if (playable === side) {
          set({ playerTime, playerPlaying: false })
        }
      }

      set({
        errors,
        warnings,
        statusMessage: anyOk ? 'G-code сгенерирован для загруженных слоёв' : 'Ошибки генерации'
      })
      return anyOk
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка генерации'
      set({
        errors: [msg],
        statusMessage: 'Сбой генерации'
      })
      return false
    } finally {
      decBusy(set)
    }
  },

  setPlayerTime: (t) => set({ playerTime: t }),
  setPlayerSpeed: (s) => set({ playerSpeed: s }),
  setPlayerPlaying: (p) => set({ playerPlaying: p }),
  setCurrentGcodeLine: (n) => set({ currentGcodeLine: n }),
  resetPlayer: () => set({ playerTime: 0, playerPlaying: false, currentGcodeLine: 0 })
}))
