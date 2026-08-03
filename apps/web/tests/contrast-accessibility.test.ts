import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
  }, 0);
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe('critical small-text contrast', () => {
  it('keeps sidebar, footer, and financial table disclosures above WCAG AA and bound to the rendered classes', () => {
    const shell = readFileSync(path.join(process.cwd(), 'components/shell/app-shell.tsx'), 'utf8');
    const globals = readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(shell).not.toContain('text-[#536060]');
    expect(shell).not.toContain('text-[#596767]');
    expect(shell).toContain('text-[#879696]');
    expect(shell).toContain('text-[#819090]');
    expect(globals).toMatch(/\.financial-table th[\s\S]*?color: #879696;/u);
    expect(contrast('#879696', '#090e0f')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#819090', '#080c0d')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#879696', '#0b1213')).toBeGreaterThanOrEqual(4.5);
  });
});
