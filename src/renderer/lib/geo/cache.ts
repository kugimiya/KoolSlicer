import type { SvgElementRules } from '@shared/types'

import type { ElementGeometry, Region } from './types'



export type AssembleCache = {

  fingerprint: string

  regions: Region[]

}



export function shapeCacheFingerprint(elements: ElementGeometry[]): string {

  let verts = 0

  for (const el of elements) {

    for (const c of el.contours) verts += c.length
    for (const cmp of el.compounds) {
      verts += cmp.outer.length
      for (const h of cmp.holes) verts += h.length
    }

  }

  return `${elements.length}:${verts}`

}



function rulesFingerprint(elementRules: SvgElementRules): string {

  return Object.entries(elementRules)
    .map(([k, r]) => `${k}:${r.mode}@${r.layer ?? 1}${r.subtractInvert ? ':inv' : ''}`)

    .sort()

    .join('|')

}



export function assembleFingerprint(elements: ElementGeometry[], elementRules: SvgElementRules): string {

  return `${shapeCacheFingerprint(elements)}::modes:${rulesFingerprint(elementRules)}`

}



export function tryAssembleCache(

  cache: AssembleCache | null | undefined,

  fingerprint: string

): Region[] | null {

  if (cache && cache.fingerprint === fingerprint) return cache.regions

  return null

}


