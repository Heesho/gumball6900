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
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
});
