import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
  { path: '/', heading: 'A basket directed by signals, not price oracles.' },
  { path: '/mine', heading: 'Mine GBX with USDG' },
  { path: '/manage', heading: 'Manage the basket’s direction' },
  { path: '/vault', heading: 'Inside GumBallVault' },
  { path: '/redeem', heading: 'Redeem your share of the basket' },
  { path: '/trade', heading: 'Trade GBX / USDG' },
  { path: '/liquidity', heading: 'Protocol-owned liquidity' },
  { path: '/activity', heading: 'Protocol activity' },
  { path: '/admin', heading: 'Admin control surface' },
] as const;

function responseNonce(contentSecurityPolicy: string): string {
  const match = /(?:^|;\s*)script-src [^;]*'nonce-([^']+)'/u.exec(contentSecurityPolicy);
  if (match?.[1] === undefined) throw new Error('The document response is missing its script nonce.');
  return match[1];
}

for (const route of routes) {
  test(`${route.path} renders its primary protocol view without WCAG violations`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
    await expect(page.locator('a[aria-label="GUM BALL 6900 home"]:visible')).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    expect(
      accessibility.violations.map(({ help, helpUrl, id, impact, nodes }) => ({
        help,
        helpUrl,
        id,
        impact,
        targets: nodes.map(({ target }) => target),
      })),
      `Automated accessibility violations on ${route.path}`,
    ).toEqual([]);
  });
}

test('mobile navigation exposes every protocol route', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveCount(routes.length);
});

test('canonical brand asset renders and decodes in the responsive shell', async ({ page }) => {
  await page.goto('/');
  const brand = page.locator('a[aria-label="GUM BALL 6900 home"]:visible');
  const logo = brand.locator('img');

  await expect(brand).toBeVisible();
  await expect(logo).toHaveAttribute('src', /gum-ball-6900-logo\.png/u);
  await expect
    .poll(() => logo.evaluate((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0))
    .toBe(true);
  await expect(page.getByText('Logo pending', { exact: true })).toHaveCount(0);
});

test('compact header keeps the brand and wallet action on one line', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  const brand = page.locator('a[aria-label="GUM BALL 6900 home"]:visible');
  const connect = page.getByRole('button', { name: 'Connect wallet', exact: true });

  await expect(brand.getByText('Oracleless basket', { exact: true })).toBeHidden();
  await expect(connect).toHaveCSS('white-space', 'nowrap');
  const [brandBox, connectBox] = await Promise.all([brand.boundingBox(), connect.boundingBox()]);
  expect(brandBox).not.toBeNull();
  expect(connectBox).not.toBeNull();
  expect(brandBox!.x + brandBox!.width).toBeLessThanOrEqual(connectBox!.x);
});

test('mobile navigation reveals the active route', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of routes) {
    await page.goto(route.path);
    const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
    const activeLink = navigation.locator('[aria-current="page"]');

    await expect(activeLink).toHaveCount(1);
    await expect
      .poll(async () => {
        const [navigationBox, activeBox] = await Promise.all([navigation.boundingBox(), activeLink.boundingBox()]);
        if (navigationBox === null || activeBox === null) return false;

        return activeBox.x >= navigationBox.x && activeBox.x + activeBox.width <= navigationBox.x + navigationBox.width;
      })
      .toBe(true);
  }
});

test('every mobile protocol route contains wide cards and tables without document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of routes) {
    await page.goto(route.path);
    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));

    expect(widths.document, `document overflow on ${route.path}`).toBeLessThanOrEqual(widths.viewport);
    expect(widths.body, `body overflow on ${route.path}`).toBeLessThanOrEqual(widths.viewport);
  }
});

test('dense desktop stat cards render complete values without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  for (const path of ['/', '/trade']) {
    await page.goto(path);
    const clippedValues = await page
      .locator('[data-slot="stat-card-value"]')
      .evaluateAll((values) =>
        values
          .filter((value) => value.scrollWidth > value.clientWidth || value.scrollHeight > value.clientHeight)
          .map((value) => value.textContent?.trim() ?? ''),
      );

    expect(clippedValues, `clipped StatCard values on ${path}`).toEqual([]);
  }
});

test('safe demo mode visibly fails closed before any write', async ({ page }) => {
  await page.goto('/mine');
  await expect(page.getByText('Safe demo fallback', { exact: true }).first()).toBeVisible();
  await expect(page.locator('form').getByRole('button', { name: 'Live deployment required' })).toBeDisabled();
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Wallet connection status' })).toBeVisible();
  await expect(page.getByText('Every write is simulated separately', { exact: false })).toBeVisible();
});

test('public auction execution surface is available without an admin role', async ({ page }) => {
  await page.goto('/activity');
  await expect(page.getByRole('heading', { name: 'Reverse Dutch auction fill' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Live deployment required' })).toBeDisabled();
});

test('activity filters expose an operable pressed state', async ({ page }) => {
  await page.goto('/activity');
  const all = page.getByRole('button', { exact: true, name: 'All' });
  const mining = page.getByRole('button', { exact: true, name: 'Mining' });
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(mining).toHaveAttribute('aria-pressed', 'false');
  await mining.click();
  await expect(mining).toHaveAttribute('aria-pressed', 'true');
  await expect(all).toHaveAttribute('aria-pressed', 'false');
});

test('demo Home and Vault keep estimates labeled and never impersonate contract snapshots', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demo buyback burn', { exact: true })).toBeVisible();
  await expect(page.getByText('Demo basket composition', { exact: true })).toBeVisible();
  await expect(page.getByTestId('home-live-vault-balances')).toHaveCount(0);

  await page.goto('/vault');
  await expect(page.getByText('Display estimate', { exact: true })).toBeVisible();
  await expect(page.getByTestId('live-vault-backing')).toHaveCount(0);
});

test('demo Admin keeps static controls explicit and hides live operational claims', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Demo operational status', { exact: true })).toBeVisible();
  await expect(page.getByText('No actions in the deterministic preview', { exact: true })).toBeVisible();
  await expect(page.getByTestId('live-admin-operational-status')).toHaveCount(0);
  await expect(page.getByTestId('live-timelock-queue')).toHaveCount(0);
});

test('document responses enforce a fresh Next.js nonce and the security header baseline', async ({ page }) => {
  const firstResponse = await page.goto('/');
  expect(firstResponse).not.toBeNull();
  const firstHeaders = firstResponse?.headers() ?? {};
  const firstPolicy = firstHeaders['content-security-policy'] ?? '';
  const firstNonce = responseNonce(firstPolicy);

  expect(firstPolicy).toContain(`script-src 'self' 'nonce-${firstNonce}' 'strict-dynamic' 'unsafe-eval'`);
  expect(firstPolicy).toContain("connect-src 'self' ws://127.0.0.1:* ws://localhost:*");
  expect(firstPolicy).toContain("frame-ancestors 'none'");
  expect(firstHeaders['permissions-policy']).toBe('camera=(), geolocation=(), microphone=(), payment=()');
  expect(firstHeaders['referrer-policy']).toBe('no-referrer');
  expect(firstHeaders['x-content-type-options']).toBe('nosniff');
  expect(firstHeaders['x-frame-options']).toBe('DENY');
  expect(firstHeaders['strict-transport-security']).toBeUndefined();

  const renderedNonces = await page
    .locator('script[nonce]')
    .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce));
  expect(renderedNonces.length).toBeGreaterThan(0);
  expect(new Set(renderedNonces)).toEqual(new Set([firstNonce]));

  const secondResponse = await page.reload();
  expect(secondResponse).not.toBeNull();
  const secondNonce = responseNonce(secondResponse?.headers()['content-security-policy'] ?? '');
  expect(secondNonce).not.toBe(firstNonce);
});
