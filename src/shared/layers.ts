/** Physical PCB side (top = engrave from left; bottom = flipped board, align from right). */
export type PcbLayerSide = 'top' | 'bottom'

export type LayerSvgBundle = {
  svgName: string
  svgText: string
  svgElementRules: import('./types').SvgElementRules
}
