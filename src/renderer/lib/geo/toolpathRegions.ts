import type { LaserSettings, PolygonWithHoles, RingPath } from '@shared/types'

import { generateRings } from '../offset'

import type { BoardRef, Region } from './types'

import { filterContoursForBoard } from './validateContour'



function regionsToPolygons(regions: Region[], board: BoardRef): PolygonWithHoles[] {

  const polys: PolygonWithHoles[] = []

  let id = 0

  for (const r of regions) {

    const outer = filterContoursForBoard([r.outer], board)[0]

    if (!outer) continue

    const holes = r.holes.flatMap((h) => filterContoursForBoard([h], board))

    polys.push({ id: id++, outer, holes, toolpathKind: r.toolpathKind })

  }

  return polys

}



export async function generateRingsFromRegions(

  regions: Region[],

  settings: LaserSettings,

  board: BoardRef

): Promise<RingPath[]> {

  const polygons = regionsToPolygons(regions, board)

  if (polygons.length === 0) return []

  return generateRings(polygons, settings)

}


