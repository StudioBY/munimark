import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pure-logic tests only: no database, no network, no DOM.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['lib/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})
