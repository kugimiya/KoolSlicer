import { describe, expect, it } from 'vitest'
import { assignScanColumnIds, assignScanStripeIds } from './scanlineStripes'

describe('scanline columns', () => {
  it('splits disjoint columns on the same scan line', () => {
    const segments = [
      { lineIndex: 0, y: 10, x0: 0, x1: 5 },
      { lineIndex: 0, y: 10, x0: 20, x1: 25 },
      { lineIndex: 1, y: 9, x0: 0, x1: 5 },
      { lineIndex: 1, y: 9, x0: 20, x1: 25 }
    ]
    const ids = assignScanColumnIds(segments, 1)
    expect(ids[0]).toBe(ids[2])
    expect(ids[1]).toBe(ids[3])
    expect(ids[0]).not.toBe(ids[1])
  })

  it('does not merge U-notch arms into one column on the same row', () => {
    const segments = [
      { lineIndex: 0, y: 10, x0: 0, x1: 4 },
      { lineIndex: 0, y: 10, x0: 16, x1: 20 },
      { lineIndex: 1, y: 9, x0: 0, x1: 4 },
      { lineIndex: 1, y: 9, x0: 16, x1: 20 },
      { lineIndex: 2, y: 8, x0: 0, x1: 20 }
    ]
    const ids = assignScanColumnIds(segments, 1)
    expect(ids[0]).toBe(ids[2])
    expect(ids[1]).toBe(ids[3])
    expect(ids[0]).not.toBe(ids[1])
  })

  it('links across missing scan lines (void band)', () => {
    const segments = [
      { lineIndex: 0, y: 10, x0: 1, x1: 2 },
      { lineIndex: 5, y: 5, x0: 1.05, x1: 1.95 }
    ]
    const ids = assignScanColumnIds(segments, 1)
    expect(ids[0]).toBe(ids[1])
  })

  it('assignScanStripeIds alias matches columns', () => {
    const segments = [
      { lineIndex: 0, y: 0, x0: 0, x1: 1 },
      { lineIndex: 1, y: -1, x0: 0, x1: 1 }
    ]
    expect(assignScanStripeIds(segments, 1)).toEqual(assignScanColumnIds(segments, 1))
  })
})
