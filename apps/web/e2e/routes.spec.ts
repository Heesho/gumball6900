import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('cinematic mechanism landing page renders without accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'An onchain index fund built by its holders.' }),
  ).toBeVisible();
  await expect(page.locator('.cinematic-hero video')).toHaveAttribute('muted', '');
  await expect(page.getByRole('heading', { level: 2, name: 'Four mechanisms. One holder-built fund.' })).toBeVisible();
  await expect(page.getByText('16', { exact: true })).toBeVisible();
  await expect(page.getByText('1:1', { exact: true })).toBeVisible();
  await expect(page.getByText('80–100%', { exact: true })).toBeVisible();
  await expect(page.getByText(/This is a development protocol with no production addresses configured/i)).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

for (const route of [
  { href: '/mine', heading: 'Mine', metric: '64 GBX/s' },
  { href: '/signal', heading: 'Signal', metric: '1:1' },
  { href: '/auction', heading: 'Auction', metric: '80–100%' },
  { href: '/govern', heading: 'Govern', metric: 'Unresolved' },
]) {
  test(`${route.heading} mechanism page renders`, async ({ page }) => {
    await page.goto(route.href);
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await expect(page.getByText(route.metric, { exact: true })).toBeVisible();
    await expect(page.getByText('Not deployed. No production addresses configured.', { exact: false })).toBeVisible();
  });
}

test('mobile layouts do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/', '/mine', '/signal', '/auction', '/govern']) {
    await page.goto(route);
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  }
});

test('liveness stays distinct from protocol readiness', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ service: 'gumball-6900-web', status: 'ok' });
});
