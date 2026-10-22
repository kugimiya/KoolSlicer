import { expect } from 'vitest'
import type { Point } from '@shared/types'

export function expectNear(a: number, b: number, tol = 1e-2): void {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)
}

export function expectPointNear(a: Point, b: Point, tol = 1e-2): void {
  expectNear(a.x, b.x, tol)
  expectNear(a.y, b.y, tol)
}
