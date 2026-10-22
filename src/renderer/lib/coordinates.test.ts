import { describe, expect, it } from 'vitest'
import { bottomLeftToTopLeftY, worldRectRing } from './coordinates'

describe('coordinates convention', () => {
  it('bottom-left rect has min y at bottom edge', () => {
    const ring = worldRectRing({ x: 10, y: 20, widthMm: 5, heightMm: 8 })
    const ys = ring.map((p) => p.y)
    expect(Math.min(...ys)).toBe(20)
    expect(Math.max(...ys)).toBe(28)
  })

  it('top-left y equals bottom + height', () => {
    expect(bottomLeftToTopLeftY(3, 10)).toBe(13)
  })
})
