import { DOMParser } from '@xmldom/xmldom'
import { beforeAll } from 'vitest'
import { getClipper } from '../../clipperInstance'

if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = DOMParser as unknown as typeof DOMParser
}

beforeAll(async () => {
  await getClipper()
})
