/// <reference types="vite/client" />

import type { KoolSlicerApi } from '@shared/types'

declare global {
  interface Window {
    koolSlicer?: KoolSlicerApi
  }
}

declare module '*.svg?raw' {
  const content: string
  export default content
}

export {}
