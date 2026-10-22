import { describe, expect, it } from 'vitest'
import { buildSvgElementTree, collectShapeElements, parseSvgDocument } from './svgDomWalk'

describe('svgDomWalk', () => {
  it('builds tree with stable keys', () => {
    const svg = `<svg><g id="g1"><path id="p1" d="M0 0 L1 0 L1 1 Z"/></g><rect id="r1" x="0" y="0" width="1" height="1"/></svg>`
    const { svg: root } = parseSvgDocument(svg)
    const tree = buildSvgElementTree(root)
    expect(tree.tag).toBe('svg')
    expect(tree.children[0].id).toBe('0')
    expect(tree.children[0].label).toBe('g1')
    expect(tree.children[0].children[0].label).toBe('p1')
    expect(tree.children[1].label).toBe('r1')
    const shapes = collectShapeElements(root)
    expect(shapes.map((s) => s.key)).toEqual(['0/0', '1'])
  })
})
