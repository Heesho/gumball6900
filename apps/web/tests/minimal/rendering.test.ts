import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const read = (relative: string) => readFileSync(path.join(APP_ROOT, relative), 'utf8');

/**
 * The proxy mints a per-request CSP nonce and the policy uses 'strict-dynamic', which makes 'self'
 * inert for scripts. A prerendered document cannot carry that nonce, so static rendering leaves
 * every script blocked and the page unhydrated — while `next build` still reports success.
 */
describe('production rendering safety', () => {
  const layout = read('app/layout.tsx');
  const headers = read('lib/security-headers.ts');

  it('renders every route per request so the CSP nonce can be applied', () => {
    expect(layout).toMatch(/export const dynamic = 'force-dynamic'/u);
  });

  it("keeps 'strict-dynamic' paired with a script nonce", () => {
    expect(headers).toContain("'strict-dynamic'");
    expect(headers).toMatch(/`'nonce-\$\{nonce\}'`/u);
  });

  it('allows same-origin media so the hero film can load', () => {
    expect(headers).toMatch(/"media-src 'self'"/u);
  });

  it('never widens style or script sources to unsafe-inline', () => {
    expect(headers).not.toMatch(/script-src[^\n]*unsafe-inline/u);
    expect(headers).not.toMatch(/"style-src 'self'[^"]*unsafe-inline/u);
  });
});

describe('the hero film', () => {
  const hero = read('components/home/cinematic-hero.tsx');

  it('autoplays muted, loops, and stays inline', () => {
    for (const attribute of ['autoPlay', 'loop', 'muted', 'playsInline']) {
      expect(hero).toContain(attribute);
    }
  });

  it('declares the poster so the first frame is never blank', () => {
    expect(hero).toContain('/media/gumball6900-cinematic-90s-poster.jpg');
    expect(hero).toContain('/media/gumball6900-cinematic-90s.mp4');
  });
});
