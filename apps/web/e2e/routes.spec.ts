import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('minimal rebuild status renders without accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'The governance-minimized GBX protocol.' })).toBeVisible();
  await expect(page.getByText('No deployment configured', { exact: true })).toBeVisible();
  await expect(page.getByText('20,000,000 GBX', { exact: true })).toBeVisible();
  await expect(
    page.getByText('This page exposes no wallet connection and submits no transaction.', { exact: false }),
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('mobile layout does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test('liveness stays distinct from protocol readiness', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ service: 'gumball-6900-web', status: 'ok' });
});
