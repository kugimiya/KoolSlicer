import type { SvgElementRules } from '@shared/types'
import type { ElementGeometry } from './types'

export function hasActiveElementRules(rules: SvgElementRules): boolean {
  return Object.keys(rules).length > 0
}

export function isolationRulesForAllElements(elements: ElementGeometry[]): SvgElementRules {
  const rules: SvgElementRules = {}
  for (const el of elements) {
    rules[el.key] = { mode: 'isolation' }
  }
  return rules
}
