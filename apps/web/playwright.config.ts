import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'routes.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  /*
   * The suite asserts a clean console, and the dev overlay injects its own CSP violations, so the
   * tests run against a production build — which is also the only mode where the nonce path is real.
   */
  webServer: {
    command: 'pnpm build && pnpm start --port 3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    url: 'http://127.0.0.1:3000',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
