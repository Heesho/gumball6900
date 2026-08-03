import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Official Uniswap packages reference unpublished sources in their source maps; suppress that dependency-only noise.
  logLevel: 'error',
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', '.next/**', 'node_modules/**'],
    include: ['tests/minimal/**/*.test.ts', 'tests/minimal/**/*.test.tsx'],
    setupFiles: ['./tests/minimal/setup.ts'],
  },
});
