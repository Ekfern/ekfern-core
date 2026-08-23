import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Unit tests for the invitation's pure logic — palette contrast, appearance
 * resolution, and the invariants that keep the look from drifting back apart.
 *
 * Node environment: everything under test here is arithmetic over colour values
 * and config objects. The pieces that touch a canvas are only reached through
 * functions the tests do not call.
 */
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', include: ['lib/**/*.test.ts', 'components/**/*.test.tsx'] },
})
