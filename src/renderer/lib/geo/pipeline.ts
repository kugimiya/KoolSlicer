import type { ParseResult, ParseWarning, SvgElementRules } from '@shared/types'

import { assembleRegions } from './assembleRegions'

import { assembleFingerprint, shapeCacheFingerprint, tryAssembleCache, type AssembleCache } from './cache'

import { importSvgGeometry } from './importSvg'

import type { BoardRef, ElementGeometry } from './types'

import { regionsToParseResult } from './regionsToParseResult'

import { validateRegions } from './validateRegions'
import { hasActiveElementRules } from './elementRules'



export type GeometryImportCache = {

  svgTextHash: string

  elements: ElementGeometry[]

  boardRef: BoardRef

}



function simpleHash(text: string): string {

  let h = 0

  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0

  return String(h)

}



export async function parseSvgGeo(

  svgText: string,

  elementRules: SvgElementRules = {},

  importCache?: GeometryImportCache | null,

  assembleCache?: AssembleCache | null

): Promise<{

  result: ParseResult

  importCache: GeometryImportCache

  assembleCache: AssembleCache | null

}> {

  const hash = simpleHash(svgText)

  let elements: ElementGeometry[]

  let boardRef: BoardRef



  if (importCache && importCache.svgTextHash === hash) {

    elements = importCache.elements

    boardRef = importCache.boardRef

  } else {

    const imported = await importSvgGeometry(svgText)

    elements = imported.elements

    boardRef = imported.boardRef

    importCache = { svgTextHash: hash, elements, boardRef }

  }



  const warnings: ParseWarning[] = []

  if (!hasActiveElementRules(elementRules)) {
    warnings.push({ message: 'Нет выбранных элементов — отметьте изоляцию, заливку или вырез.' })
    return {
      result: {
        polygons: [],
        boardBBox: {
          minX: boardRef.minX,
          minY: boardRef.minY,
          maxX: boardRef.maxX,
          maxY: boardRef.maxY
        },
        warnings
      },
      importCache: importCache!,
      assembleCache: null
    }
  }

  const fp = assembleFingerprint(elements, elementRules)

  const cached = tryAssembleCache(assembleCache, fp)

  let regions = cached

  if (!regions) {
    regions = await assembleRegions(elements, boardRef, elementRules)
    validateRegions(regions, boardRef)
    assembleCache = { fingerprint: fp, regions }
  }

  const fillN = Object.values(elementRules).filter((r) => r.mode === 'fill').length

  const subN = Object.values(elementRules).filter((r) => r.mode === 'subtract').length

  if (fillN > 0) warnings.push({ message: `Заливка: ${fillN} элемент(ов)` })

  if (subN > 0) warnings.push({ message: `Вырез из заливки: ${subN} элемент(ов)` })



  return {

    result: regionsToParseResult(regions, warnings),

    importCache: importCache!,

    assembleCache

  }

}



export async function parseSvgGeoFromImport(

  elements: ElementGeometry[],

  boardRef: BoardRef,

  elementRules: SvgElementRules = {},

  assembleCache?: AssembleCache | null

): Promise<{ result: ParseResult; assembleCache: AssembleCache | null }> {

  if (!hasActiveElementRules(elementRules)) {
    return {
      result: {
        polygons: [],
        boardBBox: {
          minX: boardRef.minX,
          minY: boardRef.minY,
          maxX: boardRef.maxX,
          maxY: boardRef.maxY
        },
        warnings: []
      },
      assembleCache: null
    }
  }

  const fp = assembleFingerprint(elements, elementRules)

  let regions = tryAssembleCache(assembleCache, fp)

  if (!regions) {
    regions = await assembleRegions(elements, boardRef, elementRules)
    validateRegions(regions, boardRef)
    assembleCache = { fingerprint: fp, regions }
  }

  return { result: regionsToParseResult(regions, []), assembleCache }

}



export { shapeCacheFingerprint }


