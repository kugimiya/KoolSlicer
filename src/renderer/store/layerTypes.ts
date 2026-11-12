import type {
  Move,
  ParseResult,
  SvgElementNode,
  SvgElementRules
} from '@shared/types'
import type { SimulationTimeline } from '../lib/simulate'
import type { GeometryImportCache } from '../lib/geo/pipeline'
import type { AssembleCache } from '../lib/geo/cache'
import type { BoardRef } from '../lib/geo/types'

export type PcbLayerJob = {
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
}

export function emptyPcbLayerJob(): PcbLayerJob {
  return {
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
    timeline: null
  }
}
