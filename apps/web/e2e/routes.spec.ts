import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const ROUTES = ['/', '/mine', '/signal', '/auction', '/govern'] as const;

/**
 * The four inner routes are the future interaction surface, not explainers: every account of how
 * the protocol works lives on the landing page. Each is the same shell.
 */
const MECHANISM_ROUTES = [
  { href: '/mine', name: 'Mine' },
  { href: '/signal', name: 'Signal' },
  { href: '/auction', name: 'Auction' },
  { href: '/govern', name: 'Govern' },
] as const;

/**
 * The hero streams a 90-second film, so the network never goes idle. Waiting for the page's own
 * h1 to be visible is the reliable signal that the document has painted, which matters on the
 * throttled mobile profile where an immediate audit can run against a blank frame.
 */
async function open(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'load' });
  await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 20_000 });
}

test.describe('the cinematic hero', () => {
  test('plays the film muted, looping, and inline', async ({ page }) => {
    await open(page, '/');

    await expect(
      page.getByRole('heading', { level: 1, name: 'An onchain index fund built by its holders.' }),
    ).toBeVisible();
    // At rest the sentence reads as one block; as the film boxes it opens around the picture.
    const halves = () =>
      page.evaluate(() =>
        [...(document.querySelector('h1')?.children ?? [])].map((half) => Math.round(half.getBoundingClientRect().top)),
      );
    const closed = await halves();
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => (await halves())[0] ?? 0, { timeout: 5_000 }).toBeLessThan(closed[0] ?? 0);
    const opened = await halves();
    expect(opened[1] ?? 0, 'the second half drops below the box').toBeGreaterThan(closed[1] ?? 0);
    await page.evaluate(() => window.scrollTo(0, 0));

    const video = page.locator('video').first();
    await expect(video).toHaveAttribute('poster', '/media/gumball6900-cinematic-90s-poster.jpg');
    await expect(video.locator('source')).toHaveAttribute('src', '/media/gumball6900-cinematic-90s.mp4');

    const state = await video.evaluate((element: HTMLVideoElement) => ({
      muted: element.muted,
      loop: element.loop,
      playsInline: element.playsInline,
      hasAudio: (element as HTMLVideoElement & { mozHasAudio?: boolean }).mozHasAudio ?? false,
    }));
    expect(state).toMatchObject({ muted: true, loop: true, playsInline: true, hasAudio: false });

    // The film must actually decode, which fails outright if the CSP blocks same-origin media.
    await expect
      .poll(async () => video.evaluate((element: HTMLVideoElement) => element.readyState), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);
  });

  test('honours reduced motion by holding on a still frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/');

    // Autoplay and the reduced-motion pause race on a cold start, so give the pause room to win.
    const video = page.locator('video').first();
    await expect
      .poll(async () => video.evaluate((element: HTMLVideoElement) => element.paused), { timeout: 15_000 })
      .toBe(true);
  });
});

/**
 * Once the film has boxed, the sentence sits around it — half above, half below — and never on it.
 * Checked at a spread of widths because the failure is a narrow band: the sentence, the type size
 * and the box all scale on different curves, so a composition that clears at 1440 can put ink type
 * on a dark picture at 1024 and paint the whole heading over it on a phone.
 */
test('the boxed film never has the headline on top of it', async ({ page }) => {
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1180, height: 900 },
    { width: 1024, height: 900 },
    { width: 900, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await open(page, '/');
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.waitForTimeout(1_200);

    const overlap = await page.evaluate(() => {
      const film = document.querySelector('[data-film] [class*="__film"]');
      const heading = document.querySelector('h1');
      if (!film || !heading) return null;

      // clip-path does not shrink the border box, so the painted square is derived from it.
      const style = getComputedStyle(film);
      const scale = Number(/matrix\(([-\d.]+)/u.exec(style.transform)?.[1] ?? 1);
      const insets = [...style.clipPath.matchAll(/(-?[\d.]+)px/gu)].map((match) => Number(match[1]));
      const box = film.getBoundingClientRect();
      const width = (box.width - 2 * (insets[1] ?? 0)) * scale;
      const height = (box.height - 2 * (insets[0] ?? 0)) * scale;
      const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const film_ = {
        left: centre.x - width / 2,
        right: centre.x + width / 2,
        top: centre.y - height / 2,
        bottom: centre.y + height / 2,
      };

      /*
       * Each half is measured on its own. The sentence opens around the picture, so the heading's
       * own box legitimately encloses the film — only the halves can collide with it.
       */
      return [...heading.children].map((half) => {
        const rect = half.getBoundingClientRect();
        const x = Math.min(rect.right, film_.right) - Math.max(rect.left, film_.left);
        const y = Math.min(rect.bottom, film_.bottom) - Math.max(rect.top, film_.top);
        return Math.round(Math.min(x, y));
      });
    });

    expect(overlap, `${size.width}x${size.height}`).not.toBeNull();
    for (const inset of overlap ?? []) {
      expect(inset, `${size.width}x${size.height} headline half overlaps the film by ${inset}px`).toBeLessThanOrEqual(
        0,
      );
    }
  }
});

test('the homepage tells the conversion in three stages', async ({ page }) => {
  await open(page, '/');

  // Emissions pull USDG in, USDG becomes what the Fund holds, a burn takes a share back out.
  // Scoped to the dashboard: several contracts share a name with a stage elsewhere on the page.
  const dashboard = page.locator('#mechanisms');
  for (const stage of ['Mine', 'Resonance', 'Fund']) {
    await expect(dashboard.getByRole('heading', { level: 3, name: stage, exact: true })).toBeVisible();
  }

  // Every interaction surface is still reachable from the page.
  for (const mechanism of MECHANISM_ROUTES) {
    await expect(page.locator(`a[href="${mechanism.href}"]`).first()).toBeAttached();
  }
});

for (const mechanism of MECHANISM_ROUTES) {
  test(`${mechanism.name} is an unbuilt interaction surface, not an explainer`, async ({ page }) => {
    await open(page, mechanism.href);

    const headings = page.getByRole('heading', { level: 1 });
    await expect(headings).toHaveCount(1);
    await expect(headings.first()).toHaveText(mechanism.name);

    await expect(page.getByText(/not built yet/i).first()).toBeVisible();
    await expect(page.getByText(/not deployed/i).first()).toBeAttached();

    // The explanation belongs to the landing page, so each shell points back to it.
    await expect(page.locator('a[href="/#mechanisms"]').first()).toBeVisible();

    // No mechanism figure or spec table should have survived here.
    await expect(page.locator('main svg[role="img"]')).toHaveCount(0);
  });
}

test('every route states the development status somewhere on the page', async ({ page }) => {
  for (const route of ROUTES) {
    await open(page, route);
    await expect(page.getByText(/development protocol/i).first()).toBeAttached();
    await expect(page.getByText(/not deployed on any network/i).first()).toBeAttached();
  }
});

test('no route overflows horizontally at mobile or desktop', async ({ page }) => {
  for (const size of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    for (const route of ROUTES) {
      await open(page, route);
      const widths = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(widths.document, `${route} at ${size.width}px`).toBeLessThanOrEqual(widths.viewport);
    }
  }
});

test('keyboard focus stays visible through the primary navigation', async ({ page }) => {
  await open(page, '/mine');

  const outlines: string[] = [];
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      return `${style.outlineStyle}|${style.outlineWidth}`;
    });
    if (focused) outlines.push(focused);
  }

  expect(outlines.length).toBeGreaterThan(3);
  for (const outline of outlines) {
    expect(outline).not.toBe('none|0px');
  }
});

for (const route of ROUTES) {
  test(`${route} has no accessibility violations`, async ({ page }) => {
    await open(page, route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('no route logs a console error', async ({ page }) => {
  for (const route of ROUTES) {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(String(error)));

    await open(page, route);
    await page.waitForTimeout(1500);
    expect(errors, `${route} console`).toEqual([]);
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  }
});

test('liveness stays distinct from protocol readiness', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ service: 'gumball-6900-web', status: 'ok' });
});
