import { create } from 'zustand'

import {

  DEFAULT_BED_LAYOUT,

  DEFAULT_LASER_SETTINGS,

  type BedLayout,

  type LaserSettings,

  type Move,

  type ParseResult,

  type SvgElementNode,
  type SvgElementMode,
  type SvgElementRules
} from '@shared/types'

import { getClipper } from './lib/clipperInstance'

import { buildSvgElementTree, parseSvgDocument } from './lib/svgParser'

import { generateFromParse } from './lib/pipeline'

import type { SimulationTimeline } from './lib/simulate'

import { createDebounced } from './lib/autoRebuild'

import { parseSvgGeo, type GeometryImportCache } from './lib/geo/pipeline'

import type { AssembleCache } from './lib/geo/cache'

import type { BoardRef } from './lib/geo/types'

import { parseProjectFile } from '@shared/project'



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

  svgName: string | null

  svgText: string | null

  svgElementTree: SvgElementNode | null

  svgElementRules: SvgElementRules

  geometryImportCache: GeometryImportCache | null

  assembleCache: AssembleCache | null

  boardRef: BoardRef | null

  parseResult: ParseResult | null

  moves: Move[]

  gcode: string

  gcodeLines: string[]

  timeline: SimulationTimeline | null

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

  setSvgElementMode: (elementId: string, mode: SvgElementMode | 'skip') => void
  setSvgElementLayer: (elementId: string, layer: number) => void
  setSvgElementSubtractInvert: (elementId: string, invert: boolean) => void

  reparseSvg: () => Promise<void>

  loadSvg: (name: string, text: string) => Promise<void>

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



export const useAppStore = create<AppState>((set, get) => ({

  clipperReady: false,

  settings: { ...DEFAULT_LASER_SETTINGS },

  bedLayout: { ...DEFAULT_BED_LAYOUT },

  svgName: null,

  svgText: null,

  svgElementTree: null,

  svgElementRules: {},

  geometryImportCache: null,

  assembleCache: null,

  boardRef: null,

  parseResult: null,

  moves: [],

  gcode: '',

  gcodeLines: [],

  timeline: null,

  errors: [],

  warnings: [],

  statusMessage: 'Загрузите SVG',

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

  setSvgElementMode: (elementId, mode) => {
    set((s) => {
      const next = { ...s.svgElementRules }
      const layer = next[elementId]?.layer ?? 1
      if (mode === 'skip') delete next[elementId]
      else {
        const prev = next[elementId]
        next[elementId] = {
          mode,
          layer,
          subtractInvert: mode === 'subtract' ? prev?.subtractInvert : undefined
        }
      }
      return { svgElementRules: next }
    })
    scheduleGeometryRebuild()
  },

  setSvgElementSubtractInvert: (elementId, invert) => {
    set((s) => {
      const next = { ...s.svgElementRules }
      const cur = next[elementId]
      if (!cur || cur.mode !== 'subtract') return s
      next[elementId] = { ...cur, subtractInvert: invert }
      return { svgElementRules: next }
    })
    scheduleGeometryRebuild()
  },

  setSvgElementLayer: (elementId, layer) => {
    const n = Math.min(99, Math.max(1, Math.round(layer) || 1))
    set((s) => {
      const next = { ...s.svgElementRules }
      const cur = next[elementId]
      if (!cur) return s
      next[elementId] = { ...cur, layer: n }
      return { svgElementRules: next }
    })
    scheduleGeometryRebuild()
  },

  reparseSvg: async () => {

    await get().rebuildJob({ skipConfirm: true, rebuildGeometryCache: true })

  },



  rebuildJob: async (opts = {}) => {

    const skipConfirm = opts.skipConfirm ?? true

    const gen = ++rebuildGeneration

    const state = get()

    const { svgText, svgElementRules } = state

    if (!svgText) return



    incBusy(set)

    set({ statusMessage: 'Пересчёт полигонов…' })

    await yieldToUi()



    try {

      let importCache = state.geometryImportCache

      let assembleCache = state.assembleCache

      if (opts.rebuildGeometryCache) {

        importCache = null

        assembleCache = null

      }



      const { result, importCache: nextImport, assembleCache: nextAssemble } = await parseSvgGeo(
        svgText,
        svgElementRules,
        importCache,
        assembleCache
      )

      if (gen !== rebuildGeneration) return

      set({

        parseResult: result,

        geometryImportCache: nextImport,

        assembleCache: nextAssemble,

        boardRef: nextImport.boardRef,

        errors: [],

        warnings: result.warnings.map((w) => w.message),

        statusMessage:
          result.polygons.length > 0
            ? `Полигонов: ${result.polygons.length}`
            : 'Отметьте элементы для гравировки (изоляция / ▣ / −)'

      })

    } catch (err) {

      if (gen !== rebuildGeneration) return

      set({

        parseResult: null,

        assembleCache: null,

        moves: [],

        gcode: '',

        gcodeLines: [],

        timeline: null,

        errors: [err instanceof Error ? err.message : 'Ошибка парсинга'],

        statusMessage: 'Нет контуров для обработки'

      })

      return

    } finally {

      decBusy(set)

    }



    if (gen !== rebuildGeneration || opts.skipGenerate) return

    if (get().parseResult?.polygons.length === 0) {
      set({
        moves: [],
        gcode: '',
        gcodeLines: [],
        timeline: null
      })
      return
    }

    await yieldToUi()

    await get().generate({ skipConfirm })

  },



  loadSvg: async (name, text) => {

    incBusy(set)

    try {

      const { svg } = parseSvgDocument(text)

      const svgElementTree = buildSvgElementTree(svg)

      set({

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

        timeline: null,

        statusMessage: `Загружен ${name}, построение кэша…`

      })

      await get().rebuildJob({ skipConfirm: true, rebuildGeometryCache: true, skipGenerate: true })

      set({ statusMessage: `Загружен ${name}. Отметьте элементы для гравировки.` })

    } catch (err) {

      set({

        parseResult: null,

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

      const { svg } = parseSvgDocument(project.svgText)

      const svgElementTree = buildSvgElementTree(svg)

      set({

        svgName: project.svgName,

        svgText: project.svgText,

        settings: project.settings,

        bedLayout: project.bedLayout,

        svgElementRules: project.svgElementRules,

        svgElementTree,

        geometryImportCache: null,

        assembleCache: null,

        boardRef: null,

        parseResult: null,

        moves: [],

        gcode: '',

        gcodeLines: [],

        timeline: null,

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

        parseResult: null,

        errors: [err instanceof Error ? err.message : 'Ошибка проекта'],

        statusMessage: 'Ошибка загрузки проекта'

      })

    } finally {

      decBusy(set)

    }

  },



  generate: async (opts) => {

    const skipConfirm = opts?.skipConfirm ?? false

    const { parseResult, settings, bedLayout, svgText, boardRef } = get()

    if (!parseResult && svgText) {

      await get().rebuildJob({ skipConfirm: true, rebuildGeometryCache: !get().geometryImportCache })

    }

    const fresh = get().parseResult

    if (!fresh) {

      set({ statusMessage: 'Сначала загрузите SVG' })

      return false

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

    try {

      const result = await generateFromParse(fresh, settings, bedLayout, boardRef)

      set({

        moves: result.moves,

        gcode: result.gcode,

        gcodeLines: result.gcodeLines,

        timeline: result.timeline,

        errors: result.errors,

        warnings: result.warnings,

        playerTime: result.timeline.totalTime,

        playerPlaying: false,

        statusMessage: result.ok

          ? `G-code: ${result.gcodeLines.length} строк, колец: ${result.ringsCount}`

          : 'Ошибки генерации'

      })

      return result.ok

    } catch (err) {

      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка генерации'

      set({

        errors: [msg],

        statusMessage: 'Сбой генерации',

        moves: [],

        gcode: '',

        gcodeLines: [],

        timeline: null

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


