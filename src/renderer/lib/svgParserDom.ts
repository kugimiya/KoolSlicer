import type { ParseResult, SvgElementRules } from '@shared/types'

import { parseSvgGeo } from './geo/pipeline'



export async function parseSvgDom(

  svgText: string,

  elementRules: SvgElementRules = {}

): Promise<ParseResult> {

  const { result } = await parseSvgGeo(svgText, elementRules)

  return result

}


