import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/renderer/lib/__tests__/helpers/setup.ts'],
    include: ['src/renderer/lib/**/*.test.ts', 'src/shared/**/*.test.ts'],
    testTimeout: 120_000
  }
})
