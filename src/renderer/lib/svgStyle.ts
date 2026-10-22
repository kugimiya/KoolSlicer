export type ParsedSvgStyle = {
  fill: string | null
  stroke: string | null
  strokeWidth: number | null
}

function parseStyleAttr(style: string | null): Record<string, string> {
  const map: Record<string, string> = {}
  if (!style) return map
  for (const part of style.split(';')) {
    const idx = part.indexOf(':')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim().toLowerCase()
    const val = part.slice(idx + 1).trim()
    map[key] = val
  }
  return map
}

export function getElementStyle(el: Element): ParsedSvgStyle {
  const styleMap = parseStyleAttr(el.getAttribute('style'))
  const fill = (el.getAttribute('fill') ?? styleMap.fill ?? null)?.toLowerCase() ?? null
  const stroke = (el.getAttribute('stroke') ?? styleMap.stroke ?? null)?.toLowerCase() ?? null
  const swRaw = el.getAttribute('stroke-width') ?? styleMap['stroke-width']
  const strokeWidth = swRaw != null ? parseFloat(swRaw) : null
  return { fill, stroke, strokeWidth }
}

/** PCB/EasyEDA: copper часто белый (#fff). Пустой fill на closed path → считаем заливкой. */
export function shapeHasFill(style: ParsedSvgStyle, closed: boolean, layerid: string | null): boolean {
  if (style.fill === 'none') return false
  if (style.fill && style.fill !== 'none') return true
  if (closed && layerid) return true
  if (closed && !style.stroke) return true
  return false
}

/** EasyEDA/PCB SVG часто задаёт только stroke-width без stroke (по умолчанию чёрный контур). */
export function shapeHasStroke(style: ParsedSvgStyle): boolean {
  const w = style.strokeWidth ?? 0
  if (w <= 0) return false
  if (style.stroke === 'none') return false
  return true
}

export function getSvgFillRule(el: Element): 'evenodd' | 'nonzero' {
  const styleMap = parseStyleAttr(el.getAttribute('style'))
  const raw = (el.getAttribute('fill-rule') ?? styleMap['fill-rule'] ?? 'evenodd').toLowerCase()
  return raw === 'nonzero' ? 'nonzero' : 'evenodd'
}

