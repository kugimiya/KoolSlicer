import { describe, expect, it } from 'vitest'

import { DEFAULT_LASER_SETTINGS } from '@shared/types'

import { rectPolygon } from './geometry'

import { countDistinctPassIndices, generateRings } from './offset'



describe('offset', () => {

  it('isolation — one ring per contour', async () => {

    const poly = [{ id: 0, outer: rectPolygon(0, 0, 20, 2), holes: [] as never[], toolpathKind: 'isolation' as const }]

    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 0.2, passes: 1 }

    const rings = await generateRings(poly, settings)

    expect(rings.length).toBe(1)

    expect(countDistinctPassIndices(rings, 0)).toBe(1)

  })



  it('fill mode produces multiple rings', async () => {
    const poly = [{ id: 0, outer: rectPolygon(0, 0, 10, 10), holes: [], toolpathKind: 'fill' as const }]
    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 0.1 }
    const rings = await generateRings(poly, settings)
    expect(rings.length).toBeGreaterThan(5)
  })

  it('narrow track isolation fallback', async () => {

    const poly = [{ id: 0, outer: rectPolygon(0, 0, 20, 0.6), holes: [] as never[], toolpathKind: 'isolation' as const }]

    const settings = { ...DEFAULT_LASER_SETTINGS, beamSize: 1, passes: 1 }

    const rings = await generateRings(poly, settings)

    expect(rings.length).toBeGreaterThan(0)

  })

})


