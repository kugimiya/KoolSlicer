import type { Point } from '@shared/types'

function multiply(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ]
}

function parseTransformPart(t: string): number[] {
  const matrix = t.match(/matrix\(([^)]+)\)/)
  if (matrix) {
    const v = matrix[1].split(/[\s,]+/).map(Number)
    if (v.length >= 6) return v.slice(0, 6)
  }
  const translate = t.match(/translate\(([^)]+)\)/)
  if (translate) {
    const parts = translate[1].split(/[\s,]+/).map(Number)
    return [1, 0, 0, 1, parts[0] ?? 0, parts[1] ?? 0]
  }
  return [1, 0, 0, 1, 0, 0]
}

export function parseTransformChain(transform: string | null): number[] {
  if (!transform?.trim()) return [1, 0, 0, 1, 0, 0]
  let m = [1, 0, 0, 1, 0, 0]
  const parts = transform.match(/(matrix\([^)]+\)|translate\([^)]+\))/g) ?? [transform]
  for (const p of parts) {
    m = multiply(m, parseTransformPart(p))
  }
  return m
}

export function applyMatrix(m: number[], p: Point): Point {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5]
  }
}

/** Точка из локальных координат элемента → координаты SVG root. */
export function toRootSvgCoords(el: Element, p: Point): Point {
  let pt = p
  let node: Element | null = el.parentElement
  while (node && node.localName !== 'svg') {
    const m = parseTransformChain(node.getAttribute('transform'))
    pt = applyMatrix(m, pt)
    node = node.parentElement
  }
  return pt
}
