import type { ParseResult, SvgElementRules } from '@shared/types'

import { isolationRulesForAllElements } from './geo/elementRules'
import { parseSvgGeo } from './geo/pipeline'
import { parseSvgDom } from './svgParserDom'

export async function parseSvg(svgText: string, elementRules: SvgElementRules = {}): Promise<ParseResult> {
  return parseSvgDom(svgText, elementRules)
}

/** Все импортированные элементы → изоляция (тесты, legacy). */
export async function parseSvgAllIsolation(svgText: string): Promise<ParseResult> {
  const { importCache } = await parseSvgGeo(svgText, {})
  const rules = isolationRulesForAllElements(importCache.elements)
  const { result } = await parseSvgGeo(svgText, rules, importCache)
  return result
}

export { buildSvgElementTree, parseSvgDocument } from './svgDomWalk'

export { parseSvgDom }
