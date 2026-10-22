import type { ParseResult, ParseWarning } from '@shared/types'
import { bboxOfPoints } from '../geometry'
import type { Region } from './types'

export function regionsToParseResult(regions: Region[], warnings: ParseWarning[] = []): ParseResult {
  return {
    polygons: regions.map((r) => ({
      id: r.id,
      outer: r.outer,
      holes: r.holes,
      toolpathKind: r.toolpathKind
    })),

    boardBBox: bboxOfPoints(regions.flatMap((r) => r.outer)),
    warnings
  }
}
