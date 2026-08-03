import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Official Uniswap packages currently publish source-map paths without the corresponding source files.
  // Keep their harmless dependency warning from drowning out protocol test output.
  logLevel: 'error',
  test: {
    passWithNoTests: false,
  },
});
