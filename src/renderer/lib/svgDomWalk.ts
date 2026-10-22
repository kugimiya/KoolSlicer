import type { SvgElementNode } from '@shared/types'

const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'])

export function elementPathKey(path: number[]): string {
  return path.length === 0 ? 'svg' : path.join('/')
}

export function elementLabel(el: Element): string {
  const id = el.getAttribute('id')
  if (id) return id
  const title = el.getAttribute('title')
  if (title) return title
  const layer = el.getAttribute('layerid')
  if (layer) return `${el.localName} layer ${layer}`
  return el.localName
}

export function buildSvgElementTree(svg: Element): SvgElementNode {
  const walk = (el: Element, path: number[]): SvgElementNode => {
    const tag = el.localName
    const children: SvgElementNode[] = []
    let idx = 0
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children.item(i)
      if (!child) continue
      children.push(walk(child, [...path, idx]))
      idx++
    }
    return {
      id: elementPathKey(path),
      tag,
      label: elementLabel(el),
      shape: SHAPE_TAGS.has(tag),
      children
    }
  }
  return walk(svg, [])
}

export type ShapeElementRef = { key: string; element: Element }

export function collectShapeElements(svg: Element): ShapeElementRef[] {
  const out: ShapeElementRef[] = []
  const visit = (el: Element, path: number[]): void => {
    const tag = el.localName
    if (SHAPE_TAGS.has(tag)) {
      out.push({ key: elementPathKey(path), element: el })
    }
    let idx = 0
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children.item(i)
      if (!child) continue
      visit(child, [...path, idx])
      idx++
    }
  }
  visit(svg, [])
  return out
}

export function parseSvgDocument(svgText: string): { svg: Element; doc: Document } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const svg =
    doc.documentElement?.localName === 'svg'
      ? doc.documentElement
      : (doc.getElementsByTagName('svg')[0] as Element | undefined)
  if (!svg) throw new Error('SVG root not found')
  return { svg, doc }
}
