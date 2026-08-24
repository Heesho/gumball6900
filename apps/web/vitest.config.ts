import { defineConfig } from 'vitest/config';

export default defineConfig({
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
