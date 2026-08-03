import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'rehearsal.spec.ts',
  globalTeardown: './e2e/rehearsal/global-teardown.mjs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // The rehearsal mutates one shared Anvil chain. Retrying without snapshot/revert
  // would rerun against dirty state and can turn a real failure into a false pass.
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3100',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/rehearsal/start-rehearsal.mjs',
    reuseExistingServer: false,
    timeout: 180_000,
    url: 'http://127.0.0.1:3100',
  },
  projects: [{ name: 'anvil-chromium', use: { ...devices['Desktop Chrome'] } }],
});
